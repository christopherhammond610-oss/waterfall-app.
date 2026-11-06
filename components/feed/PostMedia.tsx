"use client";

import { useEffect, useState } from "react";
import { cssUrl } from "@/lib/format";
import { getLockedMediaUrl } from "@/lib/media";
import type { MediaType, Post } from "@/lib/types";

interface Props {
  post: Post;
  onUnlock: () => void;
}

/** Signed URL for paid media; only requested once the viewer is allowed to see it. */
function useLockedMediaUrl(path: string | null, allowed: boolean) {
  const [result, setResult] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!path || !allowed) return;
    let cancelled = false;
    getLockedMediaUrl(path).then(
      (url) => !cancelled && setResult({ path, url }),
      () => !cancelled && setResult({ path, url: null }),
    );
    return () => {
      cancelled = true;
    };
  }, [path, allowed]);

  return result?.path === path ? result : null;
}

function MediaFrame({ type, url }: { type: MediaType; url: string }) {
  return (
    <div className="public-media-box">
      {type === "video" ? (
        <video src={url} controls playsInline preload="metadata" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Post Media Drop" />
      )}
    </div>
  );
}

/** Public media, unlocked paid media, or the blurred paywall gate. */
export default function PostMedia({ post, onUnlock }: Props) {
  const signed = useLockedMediaUrl(post.lockedMediaPath, post.isLocked && post.isUnlocked);

  if (!post.mediaType) return null;

  if (!post.isLocked) {
    return post.mediaUrl ? <MediaFrame type={post.mediaType} url={post.mediaUrl} /> : null;
  }

  const preview = post.previewUrl ? { backgroundImage: cssUrl(post.previewUrl) } : undefined;

  if (post.isUnlocked) {
    if (signed?.url) {
      return post.mediaType === "video" ? (
        <MediaFrame type="video" url={signed.url} />
      ) : (
        <div className="gate-container unlocked">
          <div className="media-content" style={{ backgroundImage: cssUrl(signed.url) }} />
        </div>
      );
    }
    return (
      <div className="gate-container">
        <div className="media-content blurred" style={preview} />
        <div className="gate-overlay">
          <p className="gate-desc">{signed ? "Couldn't load this media." : "Loading media..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gate-container">
      <div className="media-content blurred" style={preview} />
      <div className="gate-overlay">
        <div className="gate-icon">🔒</div>
        <h3 className="gate-title">Waterfall Exclusive Gate</h3>
        <p className="gate-desc">Unlock direct drop from {post.creatorName}.</p>
        {post.creatorAcceptsPayments ? (
          <button className="btn-unlock" onClick={onUnlock}>
            <span>Unlock Flow</span> • {post.price}
          </button>
        ) : (
          <button className="btn-unlock" disabled>
            Creator is setting up payouts
          </button>
        )}
      </div>
    </div>
  );
}
