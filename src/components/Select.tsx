import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  capitalize?: boolean;
  /** Shown when no option matches the current value. */
  placeholder?: string;
}

interface Coords {
  top: number;
  left: number;
  width: number;
  openUp: boolean;
  maxHeight: number;
}

const MENU_MAX = 280; // px — desired max menu height

/**
 * Custom dropdown that replaces native <select>. The menu renders in a portal
 * with fixed positioning so it is never clipped by overflow containers and
 * always opens downward (flipping up only when there isn't enough room below).
 */
export default function Select({
  value,
  onChange,
  options,
  className = "",
  capitalize = false,
  placeholder = "Select…",
}: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const reposition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    // Prefer opening downward; flip up only if below can't fit a reasonable
    // menu and above has more room.
    const openUp = spaceBelow < Math.min(MENU_MAX, 200) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(MENU_MAX, (openUp ? spaceAbove : spaceBelow) - 12));
    setCoords({ top: openUp ? r.top : r.bottom, left: r.left, width: r.width, openUp, maxHeight });
  };

  useLayoutEffect(() => {
    if (open) reposition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => reposition();
    const onResize = () => reposition();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-between gap-2 text-left ${capitalize ? "capitalize" : ""} ${className}`}
      >
        <span className={`truncate ${selected ? "" : "text-gray-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {open && coords &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: coords.openUp ? undefined : coords.top + 4,
              bottom: coords.openUp ? window.innerHeight - coords.top + 4 : undefined,
              left: coords.left,
              minWidth: coords.width,
              maxHeight: coords.maxHeight,
            }}
            className={`z-[9999] overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800 ${capitalize ? "capitalize" : ""}`}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-950 ${
                  o.value === value
                    ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    : "text-gray-700 dark:text-gray-200"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
