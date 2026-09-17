import { useEffect, useRef, useState } from "react";

/**
 * Touch has no "pointer moved away", so a chart tooltip opened by a tap stays up
 * until something inside the chart is tapped again. This reports a tap outside
 * the element the ref is put on, letting a chart close its tooltip the way a tap
 * outside a menu closes the menu. Mouse input is left alone — hover handles it.
 */
export function useTouchDismiss<T extends HTMLElement>(onOutside?: () => void) {
  const ref = useRef<T>(null);
  const [dismissed, setDismissed] = useState(false);
  // Kept in a ref so the listener doesn't have to be torn down on every render.
  const outside = useRef(onOutside);
  outside.current = onOutside;

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      const inside = !!ref.current && e.target instanceof Node && ref.current.contains(e.target);
      setDismissed(!inside);
      if (!inside) outside.current?.();
    };
    // Capture, so a tap that a child stops propagating still counts.
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);

  return { ref, dismissed };
}
