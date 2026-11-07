import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Public bucket: avatars, public post media and blurred previews of paid media. */
export const PUBLIC_BUCKET = "feed-media";
/** Private bucket: paid media, readable only by its creator or a buyer (enforced by RLS). */
export const LOCKED_BUCKET = "locked-media";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

let client: SupabaseClient | null = null;

/**
 * Browser Supabase client (publishable key only). Created lazily so it is
 * never instantiated during server prerendering. Data access is protected
 * by Row Level Security in the database, not by hiding this key.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

/** Public URL of a file in the public bucket (no network request). */
export function publicMediaUrl(path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/${encoded}`;
}
