"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import { creatorPath } from "@/lib/routes";
import type { Post } from "@/lib/types";
import CommentsDrawer from "./CommentsDrawer";
import PostMedia from "./PostMedia";

interface Props {
  post: Post;
  isUnlocked: boolean;
  onUnlock: (post: Post) => void;
  onTip: (creatorName: string) => void;
}

export default function PostCard({ post, isUnlocked, onUnlock, onTip }: Props) {
  const router = useRouter();
  const showToast = useToast();
  const { toggleFollow, toggleRipple, addComment } = useAppState();
  const [commentsOpen, setCommentsOpen] = useState(false);

  const handle = post.creatorHandle || "@creator";

  function handleFollow() {
    const updated = toggleFollow(post.id);
    if (!updated) return;
    showToast(updated.isFollowed ? `✨ Following ${post.creatorName}` : `Unfollowed ${post.creatorName}`);
  }

  function handleRipple() {
    if (toggleRipple(post.id)) showToast("💧 Added your ripple to the stream!");
  }

  function handleComment(text: string) {
    addComment(post.id, text);
    setCommentsOpen(true);
    showToast("💬 Comment posted!");
  }

  return (
    <article className="stream-card">
      <div className="card-header">
        <div className="header-left" onClick={() => router.push(creatorPath(handle))}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="avatar-mini" src={post.avatar} alt="Avatar" />
          <div className="creator-info">
            <h4>{post.creatorName}</h4>
            <span>
              {handle} • {post.followersCount || 1} Supporters
            </span>
          </div>
        </div>
        <button className={`btn-follow${post.isFollowed ? " following" : ""}`} onClick={handleFollow}>
          {post.isFollowed ? "Following" : "+ Follow"}
        </button>
      </div>

      <div className="card-body-text">{post.bodyText}</div>

      <PostMedia post={post} isUnlocked={isUnlocked} onUnlock={() => onUnlock(post)} />

      <div className="card-actions">
        <div className={`action-item${post.userRippled ? " rippled" : ""}`} onClick={handleRipple}>
          💧 <span>{post.ripples}</span> Ripples
        </div>
        <div className="action-item" onClick={() => setCommentsOpen((o) => !o)}>
          💬 <span>{post.comments?.length ?? 0}</span> Comments
        </div>
        <div className="action-item" onClick={() => onTip(post.creatorName)}>
          ⚡ Tip Creator
        </div>
      </div>

      <CommentsDrawer open={commentsOpen} comments={post.comments ?? []} onSubmit={handleComment} />
    </article>
  );
}
