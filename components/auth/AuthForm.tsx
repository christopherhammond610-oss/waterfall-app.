"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import { LIMITS } from "@/lib/defaults";
import { displayName, errorMessage } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

const MIN_PASSWORD = 6;

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function EyeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.2 3.2" />
      <path d="M6.6 6.6C3.7 8.6 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export default function AuthForm() {
  const router = useRouter();
  const showToast = useToast();
  const { authReady, userId, profile, signOut } = useAppState();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const auth = getSupabase().auth;
      if (mode === "signup") {
        const { data, error } = await auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          showToast("📧 Check your email to confirm your account.");
          return;
        }
        showToast("🌊 Welcome to Waterfall!");
        router.push("/hub");
      } else {
        const { error } = await auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        showToast("👋 Welcome back!");
        router.push("/");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
  }

  if (authReady && userId) {
    return (
      <div className="view-section active">
        <div className="composer-card auth-prompt">
          <h3 className="metrics-title">You&apos;re signed in</h3>
          <p>{profile ? `as ${displayName(profile)} (@${profile.handle})` : "Loading your profile..."}</p>
          <Link href="/" className="btn-cascade">
            Go to the Flow
          </Link>
          <button className="auth-switch" onClick={() => signOut().catch((err) => setError(errorMessage(err)))}>
            Sign out
          </button>
          {error && <p className="auth-error">{error}</p>}
        </div>
      </div>
    );
  }

  const isSignup = mode === "signup";

  return (
    <div className="view-section active">
      <form className="composer-card auth-card" onSubmit={submit}>
        <h3 className="metrics-title">{isSignup ? "Create your creator account" : "Sign in to Waterfall"}</h3>

        {isSignup && (
          <div>
            <label className="form-label" htmlFor="auth-name">
              Display Name
            </label>
            <input
              id="auth-name"
              type="text"
              className="in-app-input form-field"
              value={name}
              maxLength={LIMITS.name}
              autoComplete="name"
              required
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="form-label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            className="in-app-input form-field"
            value={email}
            autoComplete="email"
            required
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label" htmlFor="auth-password">
            Password
          </label>
          <div className="password-field form-field">
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              className="in-app-input"
              value={password}
              minLength={MIN_PASSWORD}
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn-cascade" type="submit" disabled={busy || !authReady}>
          {busy ? "Please wait..." : isSignup ? "Create Account" : "Sign In"}
        </button>

        <button type="button" className="auth-switch" onClick={switchMode}>
          {isSignup ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </form>
    </div>
  );
}
