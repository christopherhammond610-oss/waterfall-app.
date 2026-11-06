"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { LIMITS, LOCKED_PRICE_CENTS } from "@/lib/defaults";
import { avatarSrc, displayName, formatPrice, isHttpUrl, isValidHandle, normalizeHandle } from "@/lib/format";
import { clearLockedMediaCache, createPreview, mediaKind, removeUploads, uploadToBucket, validateMedia, type Upload } from "@/lib/media";
import { getSupabase, LOCKED_BUCKET, PUBLIC_BUCKET, publicMediaUrl } from "@/lib/supabase";
import type { Comment, CommentRow, Post, PostRow, ProfileRow } from "@/lib/types";

const FEED_LIMIT = 50;
const COMMENTS_LIMIT = 200;
const POST_COLUMNS =
  "id, user_id, content, is_locked, price_cents, media_path, media_type, preview_path, ripple_count, comment_count, created_at";
const PROFILE_COLUMNS = "id, display_name, handle, bio, avatar_url, follower_count, accepts_payments";
const COMMENT_COLUMNS = "id, post_id, user_id, body, created_at";
const UNIQUE_VIOLATION = "23505";

export interface NewPostInput {
  text: string;
  file: File | null;
  isLocked: boolean;
}

export interface ProfileInput {
  name: string;
  handle: string;
  bio: string;
  avatarUrl: string;
  avatarFile: File | null;
}

interface FeedStatus {
  ready: boolean;
  error: string | null;
}

/** Per-viewer state; tagged with the user it belongs to so a sign-out can't leak it. */
interface ViewerState {
  userId: string | null;
  ripples: Set<string>;
  follows: Set<string>;
  purchases: Set<string>;
}

interface AppState {
  /** True once the stored session has been checked. */
  authReady: boolean;
  userId: string | null;
  /** The signed-in user's profile (null while loading or signed out). */
  profile: ProfileRow | null;
  feed: FeedStatus;
  posts: Post[];
  /** Comments per post; undefined until that post's comments are loaded. */
  comments: Record<string, Comment[] | undefined>;
  /** Increments whenever a sale of the viewer's drops changes (for live metrics). */
  salesVersion: number;
  profileByHandle: (handle: string) => ProfileRow | undefined;
  loadCreator: (handle: string) => Promise<ProfileRow | null>;
  loadComments: (postId: string) => Promise<void>;
  addPost: (input: NewPostInput) => Promise<void>;
  addComment: (postId: string, text: string) => Promise<void>;
  toggleRipple: (postId: string) => Promise<boolean>;
  toggleFollow: (creatorId: string) => Promise<boolean>;
  saveProfile: (input: ProfileInput) => Promise<ProfileRow>;
  signOut: () => Promise<void>;
}

const EMPTY = new Set<string>();
const NO_VIEWER: ViewerState = { userId: null, ripples: EMPTY, follows: EMPTY, purchases: EMPTY };

const AppStateContext = createContext<AppState | null>(null);

function withItem(set: Set<string>, id: string, present: boolean): Set<string> {
  if (set.has(id) === present) return set;
  const next = new Set(set);
  if (present) next.add(id);
  else next.delete(id);
  return next;
}

function mergeComments(existing: CommentRow[] | undefined, incoming: CommentRow[]): CommentRow[] {
  const byId = new Map((existing ?? []).map((c) => [c.id, c]));
  for (const c of incoming) byId.set(c.id, c);
  return [...byId.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

type FeedResult = { rows: PostRow[]; error: null } | { rows: null; error: string };

/** Latest posts for the main flow. Pure fetch; state is applied by the caller. */
async function fetchFeed(): Promise<FeedResult> {
  const { data, error } = await getSupabase()
    .from("posts")
    .select(POST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  return error ? { rows: null, error: error.message } : { rows: data as PostRow[], error: null };
}

function toPost(row: PostRow, creator: ProfileRow | undefined, userId: string | null, viewer: ViewerState): Post {
  const isOwn = row.user_id === userId;
  // Older rows may be flagged locked without media; there is nothing to lock then.
  const isLocked = row.is_locked && !!row.media_path;
  return {
    id: row.id,
    creatorId: row.user_id,
    creatorName: displayName(creator),
    creatorHandle: creator?.handle ?? null,
    avatar: avatarSrc(creator),
    bodyText: row.content ?? "",
    mediaType: row.media_path ? (row.media_type ?? "image") : null,
    mediaUrl: row.media_path && !isLocked ? publicMediaUrl(row.media_path) : null,
    lockedMediaPath: isLocked ? row.media_path : null,
    previewUrl: row.preview_path ? publicMediaUrl(row.preview_path) : null,
    isLocked,
    isUnlocked: !isLocked || isOwn || viewer.purchases.has(row.id),
    creatorAcceptsPayments: creator?.accepts_payments ?? false,
    price: formatPrice(row.price_cents ?? LOCKED_PRICE_CENTS),
    ripples: row.ripple_count ?? 0,
    userRippled: viewer.ripples.has(row.id),
    followersCount: creator?.follower_count ?? 0,
    isFollowed: viewer.follows.has(row.user_id),
    isOwn,
    commentsCount: row.comment_count ?? 0,
    createdAt: row.created_at,
  };
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [postRows, setPostRows] = useState<Record<string, PostRow>>({});
  const [commentRows, setCommentRows] = useState<Record<string, CommentRow[]>>({});
  const [feed, setFeed] = useState<FeedStatus>({ ready: false, error: null });
  const [viewerState, setViewerState] = useState<ViewerState>(NO_VIEWER);
  const [salesVersion, setSalesVersion] = useState(0);

  // Read inside async callbacks / realtime handlers (never during render).
  const userIdRef = useRef<string | null>(null);
  const requestedProfiles = useRef(new Set<string>());
  const requestedComments = useRef(new Set<string>());

  const viewer = viewerState.userId === userId ? viewerState : NO_VIEWER;

  /* ---------------------------- merging helpers ---------------------------- */

  const mergeProfiles = useCallback((rows: ProfileRow[]) => {
    if (!rows.length) return;
    rows.forEach((r) => requestedProfiles.current.add(r.id));
    setProfiles((prev) => {
      const next = { ...prev };
      for (const r of rows) next[r.id] = r;
      return next;
    });
  }, []);

  const ensureProfiles = useCallback(
    async (ids: string[]) => {
      const missing = [...new Set(ids)].filter((id) => id && !requestedProfiles.current.has(id));
      if (!missing.length) return;
      missing.forEach((id) => requestedProfiles.current.add(id));
      const { data, error } = await getSupabase().from("profiles").select(PROFILE_COLUMNS).in("id", missing);
      if (error) {
        missing.forEach((id) => requestedProfiles.current.delete(id));
        return;
      }
      mergeProfiles(data as ProfileRow[]);
    },
    [mergeProfiles],
  );

  const mergePosts = useCallback(
    (rows: PostRow[]) => {
      if (!rows.length) return;
      setPostRows((prev) => {
        const next = { ...prev };
        for (const r of rows) next[r.id] = r;
        return next;
      });
      void ensureProfiles(rows.map((r) => r.user_id));
    },
    [ensureProfiles],
  );

  const appendComments = useCallback((rows: CommentRow[]) => {
    setCommentRows((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const row of rows) {
        // Only keep lists that are open/loaded; others load fresh when opened.
        if (!next[row.post_id]) continue;
        next[row.post_id] = mergeComments(next[row.post_id], [row]);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  const bumpPost = useCallback((postId: string, field: "ripple_count" | "comment_count", delta: number) => {
    setPostRows((prev) => {
      const row = prev[postId];
      if (!row) return prev;
      return { ...prev, [postId]: { ...row, [field]: Math.max(0, (row[field] ?? 0) + delta) } };
    });
  }, []);

  const bumpFollowers = useCallback((creatorId: string, delta: number) => {
    setProfiles((prev) => {
      const row = prev[creatorId];
      if (!row) return prev;
      return { ...prev, [creatorId]: { ...row, follower_count: Math.max(0, row.follower_count + delta) } };
    });
  }, []);

  const setViewerItem = useCallback(
    (key: "ripples" | "follows" | "purchases", id: string, present: boolean) => {
      const uid = userIdRef.current;
      if (!uid) return;
      setViewerState((prev) => {
        const base = prev.userId === uid ? prev : { ...NO_VIEWER, userId: uid };
        const updated = withItem(base[key], id, present);
        return updated === base[key] && base === prev ? prev : { ...base, [key]: updated };
      });
    },
    [],
  );

  /* ------------------------------- loading ------------------------------- */

  const applyFeed = useCallback(
    (result: FeedResult) => {
      if (result.error !== null) {
        const message = result.error;
        // Keep showing an already-loaded feed if a background refresh fails.
        setFeed((prev) => (prev.ready && !prev.error ? prev : { ready: true, error: message }));
        return;
      }
      mergePosts(result.rows);
      setFeed({ ready: true, error: null });
    },
    [mergePosts],
  );

  const loadCreator = useCallback(
    async (handle: string) => {
      const supabase = getSupabase();
      const { data: creator, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("handle", normalizeHandle(handle))
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!creator) return null;
      mergeProfiles([creator as ProfileRow]);

      const { data: rows, error: postsError } = await supabase
        .from("posts")
        .select(POST_COLUMNS)
        .eq("user_id", creator.id)
        .order("created_at", { ascending: false })
        .limit(FEED_LIMIT);
      if (postsError) throw new Error(postsError.message);
      mergePosts(rows as PostRow[]);
      return creator as ProfileRow;
    },
    [mergePosts, mergeProfiles],
  );

  const loadComments = useCallback(
    async (postId: string) => {
      if (requestedComments.current.has(postId)) return;
      requestedComments.current.add(postId);
      const { data, error } = await getSupabase()
        .from("comments")
        .select(COMMENT_COLUMNS)
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(COMMENTS_LIMIT);
      if (error) {
        requestedComments.current.delete(postId);
        throw new Error(error.message);
      }
      const rows = data as CommentRow[];
      setCommentRows((prev) => ({ ...prev, [postId]: mergeComments(prev[postId], rows) }));
      void ensureProfiles(rows.map((r) => r.user_id));
    },
    [ensureProfiles],
  );

  /* ------------------------------ auth session ----------------------------- */

  useEffect(() => {
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null;
      if (id !== userIdRef.current) clearLockedMediaCache();
      userIdRef.current = id;
      setUserId(id);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // The signed-in user's own profile, ripples, follows and purchases.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const supabase = getSupabase();
    void ensureProfiles([userId]);
    Promise.all([
      supabase.from("ripples").select("post_id").eq("user_id", userId),
      supabase.from("follows").select("creator_id").eq("follower_id", userId),
      supabase.from("purchases").select("post_id").eq("user_id", userId).eq("status", "completed"),
    ]).then(([ripples, follows, purchases]) => {
      if (cancelled) return;
      setViewerState({
        userId,
        ripples: new Set((ripples.data ?? []).map((r: { post_id: string }) => r.post_id)),
        follows: new Set((follows.data ?? []).map((r: { creator_id: string }) => r.creator_id)),
        purchases: new Set((purchases.data ?? []).map((r: { post_id: string }) => r.post_id)),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, ensureProfiles]);

  /* ------------------------------- realtime ------------------------------- */

  useEffect(() => {
    const supabase = getSupabase();
    void fetchFeed().then(applyFeed);

    const channel = supabase
      .channel("waterfall-sync")
      .on<PostRow>("postgres_changes", { event: "*", schema: "public", table: "posts" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = payload.old.id;
          if (!id) return;
          setPostRows((prev) => {
            if (!(id in prev)) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
          });
        } else {
          mergePosts([payload.new]);
        }
      })
      .on<CommentRow>("postgres_changes", { event: "*", schema: "public", table: "comments" }, (payload) => {
        if (payload.eventType === "INSERT") {
          appendComments([payload.new]);
          void ensureProfiles([payload.new.user_id]);
        } else if (payload.eventType === "DELETE" && payload.old.id) {
          const id = payload.old.id;
          setCommentRows((prev) => {
            const next: Record<string, CommentRow[]> = {};
            for (const [postId, list] of Object.entries(prev)) next[postId] = list.filter((c) => c.id !== id);
            return next;
          });
        }
      })
      .on<ProfileRow>("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        if (payload.eventType !== "DELETE") mergeProfiles([payload.new]);
      })
      // RLS only delivers the viewer's own ripple/follow inserts; deletes carry the keys.
      .on<{ post_id: string; user_id: string }>(
        "postgres_changes",
        { event: "*", schema: "public", table: "ripples" },
        (payload) => {
          const row = payload.eventType === "DELETE" ? payload.old : payload.new;
          if (row.post_id && row.user_id && row.user_id === userIdRef.current) {
            setViewerItem("ripples", row.post_id, payload.eventType !== "DELETE");
          }
        },
      )
      .on<{ follower_id: string; creator_id: string }>(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows" },
        (payload) => {
          const row = payload.eventType === "DELETE" ? payload.old : payload.new;
          if (row.creator_id && row.follower_id && row.follower_id === userIdRef.current) {
            setViewerItem("follows", row.creator_id, payload.eventType !== "DELETE");
          }
        },
      )
      // RLS delivers a purchase only to its buyer and to the drop's creator.
      .on<{ user_id: string; post_id: string; status: string }>(
        "postgres_changes",
        { event: "*", schema: "public", table: "purchases" },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const row = payload.new;
          if (row.user_id === userIdRef.current) {
            // Webhook confirmed payment -> unlock now; a full refund locks it again.
            if (row.status === "completed") setViewerItem("purchases", row.post_id, true);
            else if (row.status === "refunded") setViewerItem("purchases", row.post_id, false);
          } else {
            setSalesVersion((v) => v + 1);
          }
        },
      )
      .subscribe((status) => {
        // (Re)connected: refetch so nothing missed while offline is lost.
        if (status === "SUBSCRIBED") void fetchFeed().then(applyFeed);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [appendComments, applyFeed, ensureProfiles, mergePosts, mergeProfiles, setViewerItem]);

  /* -------------------------------- actions -------------------------------- */

  const requireUser = useCallback((): string => {
    const uid = userIdRef.current;
    if (!uid) throw new Error("Please sign in first.");
    return uid;
  }, []);

  const addPost = useCallback(
    async ({ text, file, isLocked }: NewPostInput) => {
      const uid = requireUser();
      const content = text.trim().slice(0, LIMITS.post);
      const locked = isLocked && !!file;
      const uploads: Upload[] = [];
      try {
        let mediaPath: string | null = null;
        let mediaType: string | null = null;
        let previewPath: string | null = null;

        if (file) {
          const invalid = validateMedia(file);
          if (invalid) throw new Error(invalid);
          mediaType = mediaKind(file);
          const media = await uploadToBucket(locked ? LOCKED_BUCKET : PUBLIC_BUCKET, uid, file, file.name);
          uploads.push(media);
          mediaPath = media.path;

          if (locked) {
            const preview = await createPreview(file);
            if (preview) {
              const uploaded = await uploadToBucket(PUBLIC_BUCKET, uid, preview);
              uploads.push(uploaded);
              previewPath = uploaded.path;
            }
          }
        }

        const { data, error } = await getSupabase()
          .from("posts")
          .insert({
            content,
            is_locked: locked,
            media_path: mediaPath,
            media_type: mediaType,
            preview_path: previewPath,
          })
          .select(POST_COLUMNS)
          .single();
        if (error) throw new Error(error.message);
        mergePosts([data as PostRow]);
      } catch (error) {
        if (uploads.length) await removeUploads(uploads).catch(() => undefined);
        throw error;
      }
    },
    [mergePosts, requireUser],
  );

  const addComment = useCallback(
    async (postId: string, text: string) => {
      requireUser();
      const body = text.trim().slice(0, LIMITS.comment);
      if (!body) return;
      bumpPost(postId, "comment_count", 1);
      const { data, error } = await getSupabase()
        .from("comments")
        .insert({ post_id: postId, body })
        .select(COMMENT_COLUMNS)
        .single();
      if (error) {
        bumpPost(postId, "comment_count", -1);
        throw new Error(error.message);
      }
      appendComments([data as CommentRow]);
    },
    [appendComments, bumpPost, requireUser],
  );

  const toggleRipple = useCallback(
    async (postId: string) => {
      const uid = requireUser();
      const adding = !viewer.ripples.has(postId);
      setViewerItem("ripples", postId, adding);
      bumpPost(postId, "ripple_count", adding ? 1 : -1);

      const table = getSupabase().from("ripples");
      const { error } = adding
        ? await table.insert({ post_id: postId })
        : await table.delete().eq("post_id", postId).eq("user_id", uid);
      if (error && error.code !== UNIQUE_VIOLATION) {
        setViewerItem("ripples", postId, !adding);
        bumpPost(postId, "ripple_count", adding ? -1 : 1);
        throw new Error(error.message);
      }
      return adding;
    },
    [bumpPost, requireUser, setViewerItem, viewer.ripples],
  );

  const toggleFollow = useCallback(
    async (creatorId: string) => {
      const uid = requireUser();
      if (creatorId === uid) throw new Error("You can't follow yourself.");
      const following = !viewer.follows.has(creatorId);
      setViewerItem("follows", creatorId, following);
      bumpFollowers(creatorId, following ? 1 : -1);

      const table = getSupabase().from("follows");
      const { error } = following
        ? await table.insert({ creator_id: creatorId })
        : await table.delete().eq("follower_id", uid).eq("creator_id", creatorId);
      if (error && error.code !== UNIQUE_VIOLATION) {
        setViewerItem("follows", creatorId, !following);
        bumpFollowers(creatorId, following ? -1 : 1);
        throw new Error(error.message);
      }
      return following;
    },
    [bumpFollowers, requireUser, setViewerItem, viewer.follows],
  );

  const saveProfile = useCallback(
    async (input: ProfileInput) => {
      const uid = requireUser();
      const handle = normalizeHandle(input.handle);
      if (!isValidHandle(handle)) {
        throw new Error("Handle must be 3-30 characters: letters, numbers, _ or .");
      }
      const typedUrl = input.avatarUrl.trim();
      if (typedUrl && !isHttpUrl(typedUrl)) throw new Error("Avatar URL must start with http:// or https://");

      let avatarUrl: string | null = typedUrl || null;
      if (input.avatarFile) {
        if (mediaKind(input.avatarFile) !== "image") throw new Error("Profile photo must be an image.");
        const invalid = validateMedia(input.avatarFile);
        if (invalid) throw new Error(invalid);
        const uploaded = await uploadToBucket(PUBLIC_BUCKET, uid, input.avatarFile, input.avatarFile.name);
        avatarUrl = publicMediaUrl(uploaded.path);
      }

      const { data, error } = await getSupabase()
        .from("profiles")
        .update({
          display_name: input.name.trim().slice(0, LIMITS.name) || null,
          handle,
          bio: input.bio.trim().slice(0, LIMITS.bio),
          avatar_url: avatarUrl,
        })
        .eq("id", uid)
        .select(PROFILE_COLUMNS)
        .single();
      if (error) {
        throw new Error(error.code === UNIQUE_VIOLATION ? "That handle is already taken." : error.message);
      }
      mergeProfiles([data as ProfileRow]);
      return data as ProfileRow;
    },
    [mergeProfiles, requireUser],
  );

  const signOut = useCallback(async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  /* ------------------------------- view model ------------------------------ */

  const posts = useMemo(
    () =>
      Object.values(postRows)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .map((row) => toPost(row, profiles[row.user_id], userId, viewer)),
    [postRows, profiles, userId, viewer],
  );

  const comments = useMemo(() => {
    const out: Record<string, Comment[]> = {};
    for (const [postId, rows] of Object.entries(commentRows)) {
      out[postId] = rows.map((r) => ({
        id: r.id,
        author: displayName(profiles[r.user_id]),
        text: r.body,
        createdAt: r.created_at,
      }));
    }
    return out;
  }, [commentRows, profiles]);

  const profileByHandle = useCallback(
    (handle: string) => {
      const wanted = normalizeHandle(handle);
      return Object.values(profiles).find((p) => p.handle === wanted);
    },
    [profiles],
  );

  const profile = userId ? (profiles[userId] ?? null) : null;

  const value = useMemo<AppState>(
    () => ({
      authReady,
      userId,
      profile,
      feed,
      posts,
      comments,
      salesVersion,
      profileByHandle,
      loadCreator,
      loadComments,
      addPost,
      addComment,
      toggleRipple,
      toggleFollow,
      saveProfile,
      signOut,
    }),
    [
      salesVersion,
      authReady,
      userId,
      profile,
      feed,
      posts,
      comments,
      profileByHandle,
      loadCreator,
      loadComments,
      addPost,
      addComment,
      toggleRipple,
      toggleFollow,
      saveProfile,
      signOut,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside <AppStateProvider>");
  return ctx;
}
