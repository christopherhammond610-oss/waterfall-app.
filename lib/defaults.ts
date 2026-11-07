/** Price of a locked drop. Stored per post in posts.price_cents. */
export const LOCKED_PRICE_CENTS = 499;
export const LOCKED_PRICE = "$4.99";

/** Creator's share of each sale (the platform keeps the rest). */
export const CREATOR_SHARE = 0.8;

/** Matches the bucket limit set in the database migration. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const LIMITS = {
  post: 5000,
  comment: 1000,
  bio: 500,
  name: 60,
} as const;
