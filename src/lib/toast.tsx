import { useSyncExternalStore } from "react";

export type ToastType = "success" | "error";

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
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

function push(type: ToastType, message: string) {
  const id = nextId++;
  toasts = [...toasts, { id, type, message }];
  listeners.forEach((l) => l());
  // Errors linger a little longer than confirmations.
  const ttl = type === "error" ? 5000 : 2500;
  setTimeout(() => remove(id), ttl);
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
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
        <button
          key={t.id}
          onClick={() => toast.dismiss(t.id)}
          className={`pointer-events-auto flex max-w-xs items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg transition ${
            t.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          <span>{t.type === "success" ? "✓" : "⚠"}</span>
          <span className="text-left">{t.message}</span>
        </button>
      ))}
    </div>
  );
}
