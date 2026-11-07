"use client";

import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import { LIMITS } from "@/lib/defaults";
import { avatarSrc, errorMessage, isHttpUrl } from "@/lib/format";
import { validateMedia } from "@/lib/media";
import type { ProfileRow } from "@/lib/types";

interface Props {
  profile: ProfileRow;
}

function formFrom(profile: ProfileRow) {
  return {
    name: profile.display_name ?? "",
    handle: profile.handle,
    bio: profile.bio ?? "",
    avatarUrl: profile.avatar_url ?? "",
  };
}

type Form = ReturnType<typeof formFrom>;

export default function ProfileEditor({ profile }: Props) {
  const { saveProfile } = useAppState();
  const showToast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Form>(() => formFrom(profile));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [urlPreview, setUrlPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const preview = filePreview ?? urlPreview ?? avatarSrc(profile);

  const set = (field: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const invalid = file.type.startsWith("image/") ? validateMedia(file) : "Profile photo must be an image.";
    if (invalid) {
      showToast(`⚠️ ${invalid}`);
      return;
    }
    setAvatarFile(file);
    setFilePreview(URL.createObjectURL(file));
    showToast("📷 Photo loaded. Click 'Save Profile' to lock it in.");
  }

  function handleUrlBlur() {
    const url = form.avatarUrl.trim();
    if (url && !isHttpUrl(url)) return;
    // A typed URL replaces any picked photo.
    setAvatarFile(null);
    setFilePreview(null);
    setUrlPreview(url || null);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await saveProfile({ ...form, avatarFile });
      setForm(formFrom(saved));
      setAvatarFile(null);
      setFilePreview(null);
      setUrlPreview(null);
      showToast("✨ Creator Profile updated!");
    } catch (error) {
      showToast(`⚠️ ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
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
            <label className="form-label" htmlFor="profile-name">
              Display Name
            </label>
            <input
              id="profile-name"
              type="text"
              className="in-app-input form-field"
              value={form.name}
              maxLength={LIMITS.name}
              onChange={set("name")}
            />
          </div>

          <div>
            <label className="form-label" htmlFor="profile-handle">
              Handle
            </label>
            <input
              id="profile-handle"
              type="text"
              className="in-app-input form-field"
              value={form.handle}
              maxLength={31}
              placeholder="yourname"
              autoCapitalize="none"
              spellCheck={false}
              onChange={set("handle")}
            />
          </div>

          <div>
            <label className="form-label" htmlFor="profile-bio">
              Bio / Mission
            </label>
            <textarea
              id="profile-bio"
              className="in-app-input form-field form-field-bio"
              value={form.bio}
              maxLength={LIMITS.bio}
              onChange={set("bio")}
            />
          </div>

          <div>
            <label className="form-label" htmlFor="profile-avatar">
              Avatar Image URL (Optional)
            </label>
            <input
              id="profile-avatar"
              type="text"
              className="in-app-input form-field"
              placeholder={avatarFile ? "Using the uploaded photo" : "https://..."}
              value={form.avatarUrl}
              onChange={set("avatarUrl")}
              onBlur={handleUrlBlur}
            />
          </div>

          <button className="btn-cascade btn-save-profile" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
