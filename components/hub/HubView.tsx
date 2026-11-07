"use client";

import Link from "next/link";
import { useAppState } from "@/context/AppStateContext";
import PayoutsCard from "./PayoutsCard";
import ProfileEditor from "./ProfileEditor";
import StreamMetrics from "./StreamMetrics";

export default function HubView() {
  const { authReady, userId, profile } = useAppState();

  if (!authReady || (userId && !profile)) {
    return (
      <div className="view-section active">
        <p className="feed-empty">Loading your Creator Hub...</p>
      </div>
    );
  }

  if (!userId || !profile) {
    return (
      <div className="view-section active">
        <div className="composer-card auth-prompt">
          <h3 className="metrics-title">Your Creator Hub</h3>
          <p>Sign in to edit your profile and see your stream metrics.</p>
          <Link href="/login" className="btn-cascade">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="view-section active">
      {/* Keyed by user so the form resets if a different account signs in. */}
      <ProfileEditor key={profile.id} profile={profile} />
      <PayoutsCard key={`payouts-${profile.id}`} />
      <StreamMetrics />
    </div>
  );
}
