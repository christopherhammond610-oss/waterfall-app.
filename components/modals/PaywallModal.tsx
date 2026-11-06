"use client";

import { useState } from "react";
import { CREATOR_SHARE } from "@/lib/defaults";
import Modal from "./Modal";

interface Props {
  creatorName: string;
  price: string;
  onClose: () => void;
  /** Starts Stripe Checkout (navigates away on success, throws on failure). */
  onCheckout: () => Promise<void>;
}

const CREATOR_PERCENT = Math.round(CREATOR_SHARE * 100);

export default function PaywallModal({ creatorName, price, onClose, onCheckout }: Props) {
  const [redirecting, setRedirecting] = useState(false);

  async function pay() {
    setRedirecting(true);
    try {
      await onCheckout();
    } catch {
      setRedirecting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-emoji">🌊</div>
      <h3 className="modal-title">Direct Flow Checkout</h3>
      <p className="modal-subtitle">
        Support <strong>{creatorName}</strong>
      </p>

      <div className="price-pill">{price}</div>

      <div className="in-app-form">
        <label className="form-label">Secure Payment</label>
        <p className="checkout-note">
          🔒 You&apos;ll pay on Stripe&apos;s secure checkout page. Card details go straight to Stripe and are
          never stored by Waterfall.
        </p>
      </div>

      <p className="modal-fine-print">
        {CREATOR_PERCENT}% direct transfer to creator; {100 - CREATOR_PERCENT}% platform infrastructure fee.
      </p>

      <button className="btn-pay-now" onClick={pay} disabled={redirecting}>
        {redirecting ? "Opening Stripe..." : "Continue to Secure Checkout"}
      </button>
    </Modal>
  );
}
