"use client";

import { useState } from "react";
import Modal from "./Modal";

interface Props {
  creatorName: string;
  price: string;
  onClose: () => void;
  /** Called once payment succeeds. Stripe Checkout will plug in here. */
  onPaid: () => void;
}

const SIMULATED_PAYMENT_MS = 700;

export default function PaywallModal({ creatorName, price, onClose, onPaid }: Props) {
  const [processing, setProcessing] = useState(false);

  function pay() {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      onPaid();
    }, SIMULATED_PAYMENT_MS);
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
        <label className="form-label">Integrated Card Terminal</label>
        <input type="text" className="in-app-input" defaultValue="4242 •••• •••• 4242" />
        <div className="card-row">
          <input type="text" className="in-app-input" defaultValue="12/28" />
          <input type="text" className="in-app-input" defaultValue="888" />
        </div>
      </div>

      <p className="modal-fine-print">80% direct transfer to creator; 20% platform infrastructure fee.</p>

      <button className="btn-pay-now" onClick={pay} disabled={processing}>
        {processing ? "Securing on Stripe..." : "Confirm & Unlock Media"}
      </button>
    </Modal>
  );
}
