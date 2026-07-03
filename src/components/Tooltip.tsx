import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Hover tooltip that only appears when the wrapped element is actually
 * truncated (its content overflows). Rendered in a portal with fixed
 * positioning so it is never clipped by a table/card overflow container.
 */
export default function Tooltip({ label, children, className = "" }: Props) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  const show = () => {
    const wrapper = ref.current;
    if (!wrapper || !label) return;
    // Measure the actual content element (the truncating span / the input).
    const target = (wrapper.firstElementChild as HTMLElement | null) ?? wrapper;
    if (document.activeElement === target) return; // don't interrupt editing
    if (target.scrollWidth <= target.clientWidth) return; // not truncated → skip
    const r = target.getBoundingClientRect();
    setCoords({ top: r.bottom + 6, left: r.left });
  };
  const hide = () => setCoords(null);

  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={hide} className={className}>
      {children}
      {coords &&
        createPortal(
          <div
            style={{ position: "fixed", top: coords.top, left: coords.left, maxWidth: 320 }}
            className="pointer-events-none z-[9999] whitespace-normal break-words rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-gray-700"
          >
            {label}
          </div>,
          document.body,
        )}
    </span>
  );
}
