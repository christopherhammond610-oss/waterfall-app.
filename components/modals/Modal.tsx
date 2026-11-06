interface Props {
  onClose: () => void;
  children: React.ReactNode;
}

/** Shared backdrop + card shell used by the payment and tip modals. */
export default function Modal({ onClose, children }: Props) {
  return (
    <div className="modal-backdrop open">
      <div className="pay-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
