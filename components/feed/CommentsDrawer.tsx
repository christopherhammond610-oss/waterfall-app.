"use client";

import { useEffect, useRef, useState } from "react";
import { LIMITS } from "@/lib/defaults";
import { timeAgo } from "@/lib/format";
import type { Comment } from "@/lib/types";

interface Props {
  open: boolean;
  /** Undefined while loading. */
  comments: Comment[] | undefined;
  /** Resolves true when the comment was saved. */
  onSubmit: (text: string) => Promise<boolean>;
}

export default function CommentsDrawer({ open, comments, onSubmit }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const saved = await onSubmit(trimmed);
    setSending(false);
    if (saved) setText("");
  }

  return (
    <div className={`comments-drawer${open ? " open" : ""}`}>
      <div className="comments-list">
        {comments === undefined ? (
          <p className="comment-time">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="comment-time">No comments yet. Start the conversation.</p>
        ) : (
          comments.map((c) => (
            <div className="comment-bubble" key={c.id}>
              <div className="comment-meta">
                <span className="comment-author">{c.author}</span>
                <span className="comment-time">{timeAgo(c.createdAt)}</span>
              </div>
              <div className="comment-text">{c.text}</div>
            </div>
          ))
        )}
      </div>
      <div className="comment-form">
        <input
          ref={inputRef}
          type="text"
          className="comment-field"
          placeholder="Write a comment..."
          value={text}
          maxLength={LIMITS.comment}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn-comment-send" onClick={submit} disabled={sending}>
          Send
        </button>
      </div>
    </div>
  );
}
