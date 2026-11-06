import "server-only";
import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabase-admin";

/** Error with an HTTP status that is safe to show to the user. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Converts thrown errors into JSON responses without leaking internals. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error("[api]", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}

/** The signed-in Supabase user from the "Authorization: Bearer <access token>" header. */
export async function requireUser(request: Request): Promise<User> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, "Please sign in first.");
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your session has expired. Please sign in again.");
  return data.user;
}

/** Public base URL for Stripe redirects (SITE_URL in production, else the request origin). */
export function siteUrl(request: Request): string {
  const configured = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  return configured || new URL(request.url).origin;
}

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    throw new HttpError(400, "Invalid request body.");
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
