"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import { CREATOR_SHARE } from "@/lib/defaults";
import { errorMessage, formatPrice } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";

interface Sale {
  amount_cents: number | null;
  platform_fee_cents: number | null;
}

interface Totals {
  userId: string;
  grossCents: number;
  netCents: number;
}

export default function StreamMetrics() {
  const { userId, profile, salesVersion, signOut } = useAppState();
  const showToast = useToast();
  const router = useRouter();
  const [totals, setTotals] = useState<Totals | null>(null);

  // Completed sales of this creator's drops (written by the Stripe webhook).
  // Re-runs when a new sale arrives over realtime.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getSupabase()
      .from("purchases")
      .select("amount_cents, platform_fee_cents, posts!inner(user_id)")
      .eq("posts.user_id", userId)
      .eq("status", "completed")
      .then(({ data, error }) => {
        if (cancelled) return;
        const sales = error ? [] : ((data ?? []) as unknown as Sale[]);
        let grossCents = 0;
        let netCents = 0;
        for (const sale of sales) {
          const amount = sale.amount_cents ?? 0;
          grossCents += amount;
          netCents += amount - (sale.platform_fee_cents ?? Math.round(amount * (1 - CREATOR_SHARE)));
        }
        setTotals({ userId, grossCents, netCents });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, salesVersion]);

  const current = totals?.userId === userId ? totals : null;

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/");
      showToast("👋 Signed out.");
    } catch (error) {
      showToast(`⚠️ ${errorMessage(error)}`);
    }
  }

  return (
    <div className="composer-card metrics-card">
      <h3 className="metrics-title">Your Stream Metrics</h3>
      <div className="metrics-grid">
        <div className="metric-tile">
          <div className="metric-value">{formatPrice(current?.grossCents ?? 0)}</div>
          <div className="metric-label">Gross Volume</div>
        </div>
        <div className="metric-tile">
          <div className="metric-value green">{formatPrice(current?.netCents ?? 0)}</div>
          <div className="metric-label">{Math.round(CREATOR_SHARE * 100)}% Net Payout</div>
        </div>
        <div className="metric-tile">
          <div className="metric-value cyan">{profile?.follower_count ?? 0}</div>
          <div className="metric-label">Supporters</div>
        </div>
      </div>

      <button className="btn-follow" onClick={handleSignOut}>
        Sign Out
      </button>
    </div>
  );
}
