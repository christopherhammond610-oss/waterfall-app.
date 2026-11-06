"use client";

import { useRouter } from "next/navigation";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import { CREATOR_SHARE, LOCKED_PRICE_VALUE } from "@/lib/defaults";

export default function StreamMetrics() {
  const { unlockedPostIds, resetAll } = useAppState();
  const showToast = useToast();
  const router = useRouter();

  const gross = unlockedPostIds.length * LOCKED_PRICE_VALUE;
  const net = gross * CREATOR_SHARE;

  function handleReset() {
    resetAll();
    router.push("/");
    showToast("Reset all demo data to a clean state.");
  }

  return (
    <div className="composer-card metrics-card">
      <h3 className="metrics-title">Your Stream Metrics</h3>
      <div className="metrics-grid">
        <div className="metric-tile">
          <div className="metric-value">${gross.toFixed(2)}</div>
          <div className="metric-label">Gross Volume</div>
        </div>
        <div className="metric-tile">
          <div className="metric-value green">${net.toFixed(2)}</div>
          <div className="metric-label">80% Net Payout</div>
        </div>
        <div className="metric-tile">
          <div className="metric-value cyan">1</div>
          <div className="metric-label">Supporters</div>
        </div>
      </div>

      <button className="btn-follow" onClick={handleReset}>
        Reset All Demo Data
      </button>
    </div>
  );
}
