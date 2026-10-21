import { useEffect, useRef, type ReactNode } from "react";

/** A modal built on the native <dialog> element, which handles focus and Escape. */
export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="dialog-title">
      <header className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
      </header>
      {open && children}
    </dialog>
  );
}
