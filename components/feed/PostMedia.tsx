import type { Post } from "@/lib/types";

interface Props {
  post: Post;
  isUnlocked: boolean;
  onUnlock: () => void;
}

/** Public image, or the blurred paywall gate for locked drops. */
export default function PostMedia({ post, isUnlocked, onUnlock }: Props) {
  if (!post.mediaUrl) return null;

  if (!post.isLocked) {
    return (
      <div className="public-media-box">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.mediaUrl} alt="Post Media Drop" />
      </div>
    );
  }

  return (
    <div className={`gate-container${isUnlocked ? " unlocked" : ""}`}>
      <div
        className={`media-content${isUnlocked ? "" : " blurred"}`}
        style={{ backgroundImage: `url('${post.mediaUrl}')` }}
      />
      <div className="gate-overlay">
        <div className="gate-icon">🔒</div>
        <h3 className="gate-title">Waterfall Exclusive Gate</h3>
        <p className="gate-desc">Unlock direct drop from {post.creatorName}.</p>
        <button className="btn-unlock" onClick={onUnlock}>
          <span>Unlock Flow</span> • {post.price}
        </button>
      </div>
    </div>
  );
}
