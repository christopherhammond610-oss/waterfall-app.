"use client";

import { useEffect, useRef, useState } from "react";
import type { Comment } from "@/lib/types";

interface Props {
  open: boolean;
  comments: Comment[];
  onSubmit: (text: string) => void;
}

export default function CommentsDrawer({ open, comments, onSubmit }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText("");
  }

  return (
    <div className={`comments-drawer${open ? " open" : ""}`}>
      <div className="comments-list">
        {comments.map((c, i) => (
          <div className="comment-bubble" key={i}>
            <div className="comment-meta">
              <span className="comment-author">{c.author}</span>
              <span className="comment-time">{c.time}</span>
            </div>
            <div className="comment-text">{c.text}</div>
          </div>
        ))}
      </div>
      <div className="comment-form">
        <input
          ref={inputRef}
          type="text"
          className="comment-field"
          placeholder="Write a comment..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn-comment-send" onClick={submit}>
          Send
        </button>
      </div>
    </div>
  );
}
