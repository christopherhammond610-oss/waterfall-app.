import type { ProfileRow } from "./types";

type ProfileLike = Pick<ProfileRow, "display_name" | "handle" | "avatar_url"> | null | undefined;

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function displayName(profile: ProfileLike): string {
  const name = profile?.display_name?.trim();
  if (name) return name;
  return profile ? `@${profile.handle}` : "Creator";
}

/** Strips a leading "@" and lowercases, e.g. "@Marcus" -> "marcus". */
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "").toLowerCase();
}

export const HANDLE_PATTERN = /^[a-z0-9_.]{3,30}$/;

export function isValidHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle);
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

/** Profile photo, or a generated initial on the brand gradient. */
export function avatarSrc(profile: ProfileLike): string {
  if (profile?.avatar_url) return profile.avatar_url;
  const source = (profile?.display_name || profile?.handle || "").trim().charAt(0).toUpperCase();
  const letter = /^[A-Z0-9]$/.test(source) ? source : "W";
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'>" +
    "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
    "<stop offset='0' stop-color='#00f2fe'/><stop offset='1' stop-color='#4facfe'/>" +
    "</linearGradient></defs><rect width='80' height='80' fill='url(#g)'/>" +
    "<text x='50%' y='50%' dy='.35em' text-anchor='middle' font-family='sans-serif' " +
    `font-size='36' font-weight='700' fill='#05131f'>${letter}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Safe value for a CSS url(...). */
export function cssUrl(url: string): string {
  return `url("${url.replace(/["\\\n\r]/g, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)}")`;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}
