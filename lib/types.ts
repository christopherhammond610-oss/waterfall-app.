/* ------------------------------------------------------------------
   Database rows (Supabase, public schema). Only the columns we select.
------------------------------------------------------------------ */

export type MediaType = "image" | "video";

export interface ProfileRow {
  id: string;
  display_name: string | null;
  handle: string;
  bio: string | null;
  avatar_url: string | null;
  follower_count: number;
  /** Set by the server once the creator's Stripe payouts are active. */
  accepts_payments: boolean;
}

/** Creator's Stripe Connect status, as returned by /api/stripe/connect/status. */
export interface PayoutStatus {
  connected: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  /** True when the creator can receive the 80% transfer, i.e. can sell locked drops. */
  ready: boolean;
}

export interface PostRow {
  id: string;
  user_id: string;
  content: string;
  is_locked: boolean;
  price_cents: number | null;
  media_path: string | null;
  media_type: MediaType | null;
  preview_path: string | null;
  ripple_count: number;
  comment_count: number;
  created_at: string;
}

export interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

/* ------------------------------------------------------------------
   View models the UI renders (rows joined with the viewer's state).
------------------------------------------------------------------ */

export interface Post {
  id: string;
  creatorId: string;
  creatorName: string;
  /** Without the leading "@". Null until the creator's profile has loaded. */
  creatorHandle: string | null;
  avatar: string;
  bodyText: string;
  mediaType: MediaType | null;
  /** Public media URL (unlocked posts only). */
  mediaUrl: string | null;
  /** Storage path of paid media; resolved to a signed URL only for allowed viewers. */
  lockedMediaPath: string | null;
  /** Tiny public preview shown blurred behind the paywall. */
  previewUrl: string | null;
  isLocked: boolean;
  isUnlocked: boolean;
  /** False while the creator's Stripe payouts aren't set up (nothing can be bought yet). */
  creatorAcceptsPayments: boolean;
  price: string;
  ripples: number;
  userRippled: boolean;
  followersCount: number;
  isFollowed: boolean;
  isOwn: boolean;
  commentsCount: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}
