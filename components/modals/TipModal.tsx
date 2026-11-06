import Modal from "./Modal";

const TIP_AMOUNTS = [1, 3, 5, 10];

interface Props {
  creatorName: string;
  amount: number;
  onAmountChange: (amount: number) => void;
  onClose: () => void;
  onSend: () => void;
}

export default function TipModal({ creatorName, amount, onAmountChange, onClose, onSend }: Props) {
  return (
    <Modal onClose={onClose}>
      <div className="modal-emoji">⚡</div>
      <h3 className="modal-title">Tip Creator</h3>
      <p className="modal-subtitle">
        Send instant ripple to <strong>{creatorName}</strong>
      </p>

      <div className="tip-chips">
        {TIP_AMOUNTS.map((amt) => (
          <button
            key={amt}
            className={`tip-chip${amt === amount ? " active" : ""}`}
            onClick={() => onAmountChange(amt)}
          >
            ${amt}
          </button>
        ))}
      </div>

      <button className="btn-pay-now" onClick={onSend}>
        Send Tip Now
      </button>
    </Modal>
  );
}
