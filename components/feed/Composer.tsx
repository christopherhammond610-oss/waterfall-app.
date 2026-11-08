"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import { LIMITS, LOCKED_PRICE } from "@/lib/defaults";
import { avatarSrc, errorMessage } from "@/lib/format";
import { mediaKind, validateMedia } from "@/lib/media";

export default function Composer() {
  const { authReady, userId, profile, addPost } = useAppState();
  const showToast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showPayoutHint, setShowPayoutHint] = useState(false);
  const [busy, setBusy] = useState(false);

  // Free the local preview when it is replaced or the composer unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!authReady) return null;

  if (!userId) {
    return (
      <div className="composer-card composer-signin">
        <span>Sign in to drop posts into the flow.</span>
        <Link href="/login" className="btn-cascade">
          Sign In
        </Link>
      </div>
    );
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    const invalid = validateMedia(picked);
    if (invalid) {
      showToast(`⚠️ ${invalid}`);
      e.target.value = "";
      return;
    }
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
    showToast("📷 Media attached to drop.");
  }

  function removeMedia() {
    setFile(null);
    setPreviewUrl(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  // The toggle stays clickable and explains what's missing, instead of silently greying out.
  function handleLockToggle(checked: boolean) {
    if (checked && !canSell) {
      setShowPayoutHint(true);
      showToast("💸 Finish your Stripe payout setup in the Creator Hub to sell locked drops.");
      return;
    }
    setIsLocked(checked);
    if (checked && !file) showToast("📷 Now attach the photo or video you want to lock.");
  }

  async function dropPost() {
    if (busy) return;
    if (!text.trim() && !file) {
      showToast("⚠️ Add some text or attach media to drop.");
      return;
    }
    if (isLocked && !file) {
      showToast("📷 Attach a photo or video to lock, or turn off Lock Media.");
      return;
    }
    setBusy(true);
    try {
      await addPost({ text, file, isLocked: isLocked && canSell });
      setText("");
      setIsLocked(false);
      removeMedia();
      showToast("🌊 Dropped new post into the flow!");
    } catch (error) {
      showToast(`⚠️ ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  const isVideo = file ? mediaKind(file) === "video" : false;
  // Selling requires active Stripe payouts (also enforced by the database).
  const canSell = !!profile?.accepts_payments;

  return (
    <div className="composer-card">
      <div className="composer-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="avatar-mini" src={avatarSrc(profile)} alt="Avatar" />
        <textarea
          className="composer-input"
          placeholder="Start a new ripple in the flow..."
          value={text}
          maxLength={LIMITS.post}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*,video/*"
        className="hidden-input"
        onChange={handleFile}
      />

      <div className={`media-preview-box${previewUrl ? " visible" : ""}`}>
        {previewUrl &&
          (isVideo ? (
            <video src={previewUrl} controls muted playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Media Preview" />
          ))}
        <button className="btn-remove-media" onClick={removeMedia} aria-label="Remove media">
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
              <input
                type="checkbox"
                checked={isLocked && canSell}
                onChange={(e) => handleLockToggle(e.target.checked)}
              />
              <span className="slider"></span>
            </div>
            <span>Lock Media ({LOCKED_PRICE})</span>
          </label>
        </div>

        {!canSell && (showPayoutHint || file) && (
          <Link href="/hub" className="composer-hint">
            💸 Finish payout setup to sell locked drops →
          </Link>
        )}

        <button className="btn-cascade" onClick={dropPost} disabled={busy}>
          {busy ? "Dropping..." : "Drop Post"}
        </button>
      </div>
    </div>
  );
}
