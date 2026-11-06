/**
 * Local persistence layer (browser localStorage).
 * Keys match the original build so existing demo data carries over.
 * This is the single place to swap for Supabase later.
 */
const KEYS = {
  profile: "waterfall_v5_profile",
  posts: "waterfall_v5_posts",
  unlocked: "waterfall_v5_unlocked",
} as const;

type StorageKey = keyof typeof KEYS;

export function readStored<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(KEYS[key]);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored<T>(key: StorageKey, value: T): void {
  try {
    window.localStorage.setItem(KEYS[key], JSON.stringify(value));
  } catch {
    // Storage full or blocked (e.g. private mode): keep working in memory.
  }
}

export function clearStored(): void {
  try {
    Object.values(KEYS).forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
