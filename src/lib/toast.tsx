import { useSyncExternalStore } from "react";

export type ToastType = "success" | "error";

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  action?: ToastAction;
}

// Module-level store so toasts can be fired from anywhere — including the
// QueryClient's MutationCache, which lives outside the React tree.
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

function remove(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  listeners.forEach((l) => l());
}

function push(type: ToastType, message: string, action?: ToastAction, ttl?: number) {
  const id = nextId++;
  toasts = [...toasts, { id, type, message, action }];
  listeners.forEach((l) => l());
  // Errors linger a little longer than confirmations.
  setTimeout(() => remove(id), ttl ?? (type === "error" ? 5000 : 2500));
  return id;
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  /**
   * A confirmation you can take back. Stays up longer than a plain toast, since
   * it is only useful for as long as it is on screen.
   */
  undo: (message: string, run: () => void) => {
    const id = push("success", message, {
      label: "Undo",
      run: () => {
        remove(id);
        run();
      },
    }, 8000);
    return id;
  },
  dismiss: remove,
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

export function Toaster() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-md:bottom-20">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex max-w-xs items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg transition ${
            t.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          <button onClick={() => toast.dismiss(t.id)} className="flex flex-1 items-center gap-2 text-left">
            <span>{t.type === "success" ? "✓" : "⚠"}</span>
            <span>{t.message}</span>
          </button>
          {t.action && (
            <button
              onClick={t.action.run}
              className="shrink-0 rounded-md bg-white/20 px-2 py-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-white/30"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
