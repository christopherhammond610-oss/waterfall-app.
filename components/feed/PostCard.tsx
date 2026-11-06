"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import { errorMessage } from "@/lib/format";
import { creatorPath } from "@/lib/routes";
import type { Post } from "@/lib/types";
import { useRequireAuth } from "@/components/useRequireAuth";
import CommentsDrawer from "./CommentsDrawer";
import PostMedia from "./PostMedia";

interface Props {
  post: Post;
  onUnlock: (post: Post) => void;
  onTip: (creatorName: string) => void;
}

export default function PostCard({ post, onUnlock, onTip }: Props) {
  const router = useRouter();
  const showToast = useToast();
  const requireAuth = useRequireAuth();
  const { comments, toggleFollow, toggleRipple, addComment, loadComments } = useAppState();
  const [commentsOpen, setCommentsOpen] = useState(false);

  async function handleFollow() {
    if (!requireAuth("follow creators")) return;
    try {
      const following = await toggleFollow(post.creatorId);
      showToast(following ? `✨ Following ${post.creatorName}` : `Unfollowed ${post.creatorName}`);
    } catch (error) {
      showToast(`⚠️ ${errorMessage(error)}`);
    }
  }

  async function handleRipple() {
    if (!requireAuth("add ripples")) return;
    try {
      if (await toggleRipple(post.id)) showToast("💧 Added your ripple to the stream!");
    } catch (error) {
      showToast(`⚠️ ${errorMessage(error)}`);
    }
  }

  function toggleComments() {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening) {
      loadComments(post.id).catch((error) => showToast(`⚠️ ${errorMessage(error)}`));
    }
  }

  async function handleComment(text: string) {
    if (!requireAuth("comment")) return false;
    try {
      await addComment(post.id, text);
      showToast("💬 Comment posted!");
      return true;
    } catch (error) {
      showToast(`⚠️ ${errorMessage(error)}`);
      return false;
    }
  }

  function openCreator() {
    if (post.creatorHandle) router.push(creatorPath(post.creatorHandle));
  }

  return (
    <article className="stream-card">
      <div className="card-header">
        <div className="header-left" onClick={openCreator}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="avatar-mini" src={post.avatar} alt="Avatar" />
          <div className="creator-info">
            <h4>{post.creatorName}</h4>
            <span>
              {post.creatorHandle ? `@${post.creatorHandle} • ` : ""}
              {post.followersCount} Supporters
            </span>
          </div>
        </div>
        {!post.isOwn && (
          <button className={`btn-follow${post.isFollowed ? " following" : ""}`} onClick={handleFollow}>
            {post.isFollowed ? "Following" : "+ Follow"}
          </button>
        )}
      </div>

      {post.bodyText && <div className="card-body-text">{post.bodyText}</div>}

      <PostMedia post={post} onUnlock={() => onUnlock(post)} />

      <div className="card-actions">
        <div className={`action-item${post.userRippled ? " rippled" : ""}`} onClick={handleRipple}>
          💧 <span>{post.ripples}</span> Ripples
        </div>
        <div className="action-item" onClick={toggleComments}>
          💬 <span>{post.commentsCount}</span> Comments
        </div>
        <div className="action-item" onClick={() => onTip(post.creatorName)}>
          ⚡ Tip Creator
        </div>
      </div>

      <CommentsDrawer open={commentsOpen} comments={comments[post.id]} onSubmit={handleComment} />
    </article>
  );
}
