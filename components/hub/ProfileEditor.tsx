"use client";

import { useRef, useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import { DEFAULT_PROFILE } from "@/lib/defaults";
import { readFileAsDataUrl } from "@/lib/files";
import type { Profile } from "@/lib/types";

export default function ProfileEditor() {
  const { profile, saveProfile } = useAppState();
  const showToast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Profile>(profile);
  const [preview, setPreview] = useState(profile.avatar);

  const set = (field: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setPreview(dataUrl);
    setForm((f) => ({ ...f, avatar: dataUrl }));
    showToast("📷 Photo loaded. Click 'Save Profile' to lock it in.");
  }

  function handleSave() {
    const updated: Profile = {
      name: form.name.trim() || DEFAULT_PROFILE.name,
      handle: form.handle.trim() || DEFAULT_PROFILE.handle,
      bio: form.bio.trim(),
      avatar: preview,
    };
    saveProfile(updated);
    setForm(updated);
    showToast("✨ Creator Profile updated!");
  }

  return (
    <div className="profile-hero">
      <div className="profile-banner"></div>
      <div className="profile-details-wrapper">
        <div className="avatar-large-container" onClick={() => fileInput.current?.click()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="avatar-large" src={preview} alt="Avatar" />
          <div className="avatar-edit-badge">📷</div>
          <input ref={fileInput} type="file" accept="image/*" className="hidden-input" onChange={handlePhoto} />
        </div>

        <div className="edit-form-grid">
          <div>
            <label className="form-label">Display Name</label>
            <input type="text" className="in-app-input form-field" value={form.name} onChange={set("name")} />
          </div>

          <div>
            <label className="form-label">Handle</label>
            <input type="text" className="in-app-input form-field" value={form.handle} onChange={set("handle")} />
          </div>

          <div>
            <label className="form-label">Bio / Mission</label>
            <textarea className="in-app-input form-field form-field-bio" value={form.bio} onChange={set("bio")} />
          </div>

          <div>
            <label className="form-label">Avatar Image URL (Optional)</label>
            <input
              type="text"
              className="in-app-input form-field"
              placeholder="https://..."
              value={form.avatar}
              onChange={set("avatar")}
              onBlur={(e) => e.target.value.trim() && setPreview(e.target.value)}
            />
          </div>

          <button className="btn-cascade btn-save-profile" onClick={handleSave}>
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}
