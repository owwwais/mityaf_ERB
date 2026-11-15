"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "./ui";

const CloseContext = createContext<(() => void) | null>(null);

/** يغلق النافذة المحيطة إن وُجدت (تستخدمه النماذج بعد الحفظ). */
export function useCloseModal(): (() => void) | null {
  return useContext(CloseContext);
}

export function Modal({
  trigger,
  triggerClassName = "btn btn-primary",
  triggerLabel,
  title,
  description,
  wide,
  children,
}: {
  trigger: ReactNode;
  triggerClassName?: string;
  /** نص بديل لقارئات الشاشة إن كان الزر أيقونة فقط. */
  triggerLabel?: string;
  title: string;
  description?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => ref.current?.close(), []);

  useEffect(() => {
    if (open && ref.current && !ref.current.open) ref.current.showModal();
  }, [open]);

  return (
    <>
      <button type="button" className={triggerClassName} aria-label={triggerLabel} title={triggerLabel} onClick={() => setOpen(true)}>
        {trigger}
      </button>
      {open && (
        <dialog
          ref={ref}
          className={cx("modal", wide && "modal-wide")}
          onClose={() => setOpen(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-base font-bold">{title}</h2>
              {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
            </div>
            <button type="button" className="btn btn-ghost btn-icon -me-1.5" onClick={close} aria-label="إغلاق">
              <X size={18} />
            </button>
          </div>
          <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(100dvh - 8rem)" }}>
            <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
          </div>
        </dialog>
      )}
    </>
  );
}
