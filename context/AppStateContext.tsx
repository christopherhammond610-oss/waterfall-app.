"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_POSTS, DEFAULT_PROFILE, LOCKED_PRICE } from "@/lib/defaults";
import { clearStored, readStored, writeStored } from "@/lib/storage";
import type { Post, Profile } from "@/lib/types";

interface NewPostInput {
  text: string;
  mediaUrl: string | null;
  isLocked: boolean;
}

interface AppState {
  hydrated: boolean;
  profile: Profile;
  posts: Post[];
  unlockedPostIds: string[];
  saveProfile: (profile: Profile) => void;
  addPost: (input: NewPostInput) => void;
  toggleFollow: (postId: string) => Post | undefined;
  toggleRipple: (postId: string) => boolean;
  addComment: (postId: string, text: string) => void;
  unlockPost: (postId: string) => void;
  resetAll: () => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [posts, setPosts] = useState<Post[]>(DEFAULT_POSTS);
  const [unlockedPostIds, setUnlockedPostIds] = useState<string[]>([]);

  // Load saved data once on the client (localStorage is not available on the server).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from an external store */
    setProfile(readStored("profile", DEFAULT_PROFILE));
    setPosts(readStored("posts", DEFAULT_POSTS));
    setUnlockedPostIds(readStored("unlocked", [] as string[]));
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Persist changes after the initial load.
  useEffect(() => {
    if (hydrated) writeStored("profile", profile);
  }, [hydrated, profile]);
  useEffect(() => {
    if (hydrated) writeStored("posts", posts);
  }, [hydrated, posts]);
  useEffect(() => {
    if (hydrated) writeStored("unlocked", unlockedPostIds);
  }, [hydrated, unlockedPostIds]);

  const updatePost = useCallback((postId: string, change: (post: Post) => Post) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? change(p) : p)));
  }, []);

  const addPost = useCallback(
    ({ text, mediaUrl, isLocked }: NewPostInput) => {
      const newPost: Post = {
        id: `post-${Date.now()}`,
        creatorName: profile.name,
        creatorHandle: profile.handle,
        avatar: profile.avatar,
        bodyText: text,
        isLocked,
        price: LOCKED_PRICE,
        mediaUrl,
        ripples: 1,
        userRippled: true,
        followersCount: 1,
        isFollowed: false,
        comments: [],
      };
      setPosts((prev) => [newPost, ...prev]);
    },
    [profile],
  );

  const toggleFollow = useCallback(
    (postId: string) => {
      const post = posts.find((p) => p.id === postId);
      if (!post) return undefined;
      const isFollowed = !post.isFollowed;
      const updated = {
        ...post,
        isFollowed,
        followersCount: (post.followersCount || 1) + (isFollowed ? 1 : -1),
      };
      updatePost(postId, () => updated);
      return updated;
    },
    [posts, updatePost],
  );

  /** Returns true when a ripple was added, false when removed. */
  const toggleRipple = useCallback(
    (postId: string) => {
      const post = posts.find((p) => p.id === postId);
      if (!post) return false;
      const adding = !post.userRippled;
      updatePost(postId, (p) => ({
        ...p,
        userRippled: adding,
        ripples: p.ripples + (adding ? 1 : -1),
      }));
      return adding;
    },
    [posts, updatePost],
  );

  const addComment = useCallback(
    (postId: string, text: string) => {
      updatePost(postId, (p) => ({
        ...p,
        comments: [...(p.comments ?? []), { author: profile.name, text, time: "Just now" }],
      }));
    },
    [profile.name, updatePost],
  );

  const unlockPost = useCallback((postId: string) => {
    setUnlockedPostIds((prev) => (prev.includes(postId) ? prev : [...prev, postId]));
  }, []);

  const resetAll = useCallback(() => {
    clearStored();
    setProfile(DEFAULT_PROFILE);
    setPosts(DEFAULT_POSTS);
    setUnlockedPostIds([]);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      hydrated,
      profile,
      posts,
      unlockedPostIds,
      saveProfile: setProfile,
      addPost,
      toggleFollow,
      toggleRipple,
      addComment,
      unlockPost,
      resetAll,
    }),
    [hydrated, profile, posts, unlockedPostIds, addPost, toggleFollow, toggleRipple, addComment, unlockPost, resetAll],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside <AppStateProvider>");
  return ctx;
}
