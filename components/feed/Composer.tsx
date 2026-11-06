"use client";

import { useRef, useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import { LOCKED_PRICE } from "@/lib/defaults";
import { readFileAsDataUrl } from "@/lib/files";

export default function Composer() {
  const { profile, addPost } = useAppState();
  const showToast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [media, setMedia] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMedia(await readFileAsDataUrl(file));
    showToast("📷 Media attached to drop.");
  }

  function removeMedia() {
    setMedia(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function dropPost() {
    const trimmed = text.trim();
    if (!trimmed && !media) {
      showToast("⚠️ Add some text or attach media to drop.");
      return;
    }
    addPost({ text: trimmed, mediaUrl: media, isLocked });
    setText("");
    removeMedia();
    setIsLocked(false);
    showToast("🌊 Dropped new post into the flow!");
  }

  return (
    <div className="composer-card">
      <div className="composer-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="avatar-mini" src={profile.avatar} alt="Avatar" />
        <textarea
          className="composer-input"
          placeholder="Start a new ripple in the flow..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <input ref={fileInput} type="file" accept="image/*" className="hidden-input" onChange={handleFile} />

      <div className={`media-preview-box${media ? " visible" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {media && <img src={media} alt="Media Preview" />}
        <button className="btn-remove-media" onClick={removeMedia}>
          ×
        </button>
      </div>

      <div className="composer-footer">
        <div className="composer-tools">
          <button className="btn-attach-media" onClick={() => fileInput.current?.click()}>
            📷 <span>Add Photo / Media</span>
          </button>

          <label className="monetize-toggle-group">
            <div className="toggle-switch">
              <input type="checkbox" checked={isLocked} onChange={(e) => setIsLocked(e.target.checked)} />
              <span className="slider"></span>
            </div>
            <span>Lock Media ({LOCKED_PRICE})</span>
          </label>
        </div>

        <button className="btn-cascade" onClick={dropPost}>
          Drop Post
        </button>
      </div>
    </div>
  );
}
