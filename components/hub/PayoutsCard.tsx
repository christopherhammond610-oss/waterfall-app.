"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/context/ToastContext";
import { apiPost } from "@/lib/api";
import { DEFAULT_PAYOUT_COUNTRY, PAYOUT_COUNTRIES, type PayoutCountry } from "@/lib/countries";
import { CREATOR_SHARE } from "@/lib/defaults";
import { errorMessage } from "@/lib/format";
import type { PayoutStatus } from "@/lib/types";

const CREATOR_PERCENT = Math.round(CREATOR_SHARE * 100);

/** Stripe Connect onboarding and payout status for the signed-in creator. */
export default function PayoutsCard() {
  const showToast = useToast();
  const [status, setStatus] = useState<PayoutStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [country, setCountry] = useState<PayoutCountry>(DEFAULT_PAYOUT_COUNTRY);

  // Fresh status from Stripe on every visit, including the return from onboarding.
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const returning = params.get("payouts");
    if (returning) window.history.replaceState(null, "", window.location.pathname);

    apiPost<PayoutStatus>("/api/stripe/connect/status").then(
      (result) => {
        if (cancelled) return;
        setStatus(result);
        if (returning === "return") {
          showToast(result.ready ? "✅ Payouts are active!" : "Stripe needs a few more details to finish setup.");
        }
      },
      (error) => !cancelled && setLoadError(errorMessage(error)),
    );
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  async function go(path: string, body?: unknown) {
    if (busy) return;
    setBusy(true);
    try {
      const { url } = await apiPost<{ url: string }>(path, body);
      window.location.assign(url);
    } catch (error) {
      showToast(`⚠️ ${errorMessage(error)}`);
      setBusy(false);
    }
  }

  let body: React.ReactNode;
  if (loadError) {
    body = <p className="payouts-text">Couldn&apos;t load payout status: {loadError}</p>;
  } else if (!status) {
    body = <p className="payouts-text">Checking your payout status...</p>;
  } else if (!status.connected) {
    body = (
      <>
        <p className="payouts-text">
          Connect a Stripe account to sell locked drops. You keep {CREATOR_PERCENT}% of every unlock, paid out by
          Stripe directly to your bank.
        </p>
        <div className="payouts-country">
          <label className="form-label" htmlFor="payout-country">
            Payout country
          </label>
          <select
            id="payout-country"
            className="in-app-input form-field"
            value={country}
            onChange={(e) => setCountry(e.target.value as PayoutCountry)}
            disabled={busy}
          >
            {PAYOUT_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="payouts-note">Where your bank account is. This can&apos;t be changed later.</span>
        </div>
        <button className="btn-cascade" onClick={() => go("/api/stripe/connect", { country })} disabled={busy}>
          {busy ? "Opening Stripe..." : "Connect Stripe Payouts"}
        </button>
      </>
    );
  } else if (!status.ready) {
    body = (
      <>
        <p className="payouts-text">
          Your Stripe account is connected, but Stripe still needs a few details before you can sell locked drops.
        </p>
        <button className="btn-cascade" onClick={() => go("/api/stripe/connect")} disabled={busy}>
          {busy ? "Opening Stripe..." : "Finish Stripe Setup"}
        </button>
      </>
    );
  } else {
    body = (
      <>
        <p className="payouts-text payouts-ready">
          ✓ Payouts active. You keep {CREATOR_PERCENT}% of every unlock.
        </p>
        <button className="btn-follow" onClick={() => go("/api/stripe/connect/dashboard")} disabled={busy}>
          {busy ? "Opening..." : "Open Stripe Dashboard"}
        </button>
      </>
    );
  }

  return (
    <div className="composer-card metrics-card payouts-card">
      <h3 className="metrics-title">Payouts</h3>
      {body}
    </div>
  );
}
