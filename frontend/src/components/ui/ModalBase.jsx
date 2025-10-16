import React, { useEffect } from "react";
import Button from "./Button";

export default function ModalBase({ open, onClose, title, children, footer }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onClose?.()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-w-lg w-full rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,0.2)] bg-white dark:bg-darkCard p-6"
      >
        {title && (
          <div className="text-lg font-semibold text-gray-800 dark:text-zinc-100 mb-3">
            {title}
          </div>
        )}
        <div className="mb-4">{children}</div>
        <div className="flex justify-end gap-2">
          {footer ?? <Button variant="secondary" onClick={onClose}>Fechar</Button>}
        </div>
      </div>
    </div>
  );
}