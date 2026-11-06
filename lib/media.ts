import { MAX_UPLOAD_BYTES } from "./defaults";
import { getSupabase, LOCKED_BUCKET } from "./supabase";
import type { MediaType } from "./types";

export interface Upload {
  bucket: string;
  path: string;
}

const PREVIEW_WIDTH = 48;
const PREVIEW_TIMEOUT_MS = 6000;
const SIGNED_URL_TTL_S = 60 * 60;

export function mediaKind(file: File): MediaType | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

/** Returns an error message, or null when the file can be uploaded. */
export function validateMedia(file: File): string | null {
  if (!mediaKind(file)) return "Only images and videos can be attached.";
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB).`;
  }
  return null;
}

/** crypto.randomUUID needs a secure context; fall back for http:// LAN testing. */
function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function extensionFor(blob: Blob, name?: string): string {
  const fromName = name?.split(".").pop()?.toLowerCase() ?? "";
  if (/^[a-z0-9]{1,5}$/.test(fromName) && fromName !== name?.toLowerCase()) return fromName;
  const fromType = blob.type.split("/")[1]?.split(/[+;]/)[0]?.toLowerCase() ?? "";
  return /^[a-z0-9]{1,5}$/.test(fromType) ? fromType : "bin";
}

/** Uploads into "<userId>/<random>.<ext>" (the folder RLS checks ownership against). */
export async function uploadToBucket(
  bucket: string,
  userId: string,
  blob: Blob,
  name?: string,
): Promise<Upload> {
  const path = `${userId}/${randomId()}.${extensionFor(blob, name)}`;
  const { error } = await getSupabase()
    .storage.from(bucket)
    .upload(path, blob, {
      contentType: blob.type || undefined,
      cacheControl: "31536000",
      upsert: false,
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { bucket, path };
}

/** Best-effort cleanup of files whose post could not be created. */
export async function removeUploads(uploads: Upload[]): Promise<void> {
  const byBucket = new Map<string, string[]>();
  for (const u of uploads) byBucket.set(u.bucket, [...(byBucket.get(u.bucket) ?? []), u.path]);
  await Promise.all(
    [...byBucket].map(([bucket, paths]) => getSupabase().storage.from(bucket).remove(paths)),
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

function drawPreview(source: CanvasImageSource, width: number, height: number): Promise<Blob | null> {
  if (!width || !height) return Promise.resolve(null);
  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_WIDTH;
  canvas.height = Math.max(1, Math.round((height / width) * PREVIEW_WIDTH));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.6));
}

async function videoFrame(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    const loaded = new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video"));
    });
    video.src = url;
    await loaded;
    const seeked = new Promise<void>((resolve) => (video.onseeked = () => resolve()));
    video.currentTime = Math.min(1, (video.duration || 0) / 2);
    await seeked;
    return await drawPreview(video, video.videoWidth, video.videoHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function imageFrame(file: File): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file);
  try {
    return await drawPreview(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/**
 * Tiny (48px wide) JPEG of the media, shown blurred behind the paywall so the
 * real file never has to be public. Returns null if the browser can't decode it.
 */
export async function createPreview(file: File): Promise<Blob | null> {
  try {
    const kind = mediaKind(file);
    const job = kind === "video" ? videoFrame(file) : kind === "image" ? imageFrame(file) : null;
    return job ? await withTimeout(job, PREVIEW_TIMEOUT_MS) : null;
  } catch {
    return null;
  }
}

const signedCache = new Map<string, { url: string; expiresAt: number }>();

/** Short-lived URL for paid media. Storage RLS only signs it for the creator or a buyer. */
export async function getLockedMediaUrl(path: string): Promise<string> {
  const cached = signedCache.get(path);
  if (cached && cached.expiresAt - Date.now() > 5 * 60 * 1000) return cached.url;
  const { data, error } = await getSupabase()
    .storage.from(LOCKED_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_S);
  if (error || !data) throw new Error(error?.message ?? "Could not load media.");
  signedCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_TTL_S * 1000 });
  return data.signedUrl;
}

export function clearLockedMediaCache(): void {
  signedCache.clear();
}
