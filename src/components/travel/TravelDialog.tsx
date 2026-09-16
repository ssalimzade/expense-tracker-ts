import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Centered card on desktop, bottom sheet on phones. Escape or a backdrop tap closes it. */
export default function TravelDialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  /** Wider card on desktop, for lists. */
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end justify-center md:items-center md:p-4">
      <div className="animate-backdrop absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-label={title}
        className={`max-md:animate-sheet relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-gray-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl dark:border-gray-700 dark:bg-gray-800 ${wide ? "md:max-w-2xl" : "md:max-w-md"} md:rounded-2xl md:pt-4`}
      >
        <span className="mx-auto mb-2 block h-1 w-9 rounded-full bg-gray-300 dark:bg-gray-600 md:hidden" />
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export const fieldLabel = "mt-3 block text-[10px] font-semibold uppercase tracking-wider text-gray-400";
export const fieldInput =
  "mt-1 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm font-medium focus:border-sky-400 focus:outline-none dark:border-gray-600 dark:[color-scheme:dark]";
export const primaryBtn =
  "flex-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-40";
export const secondaryBtn =
  "flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300";
