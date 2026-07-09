import { createElement, type ReactElement } from "react";

type TickProps = { x?: number; y?: number; payload?: { value: string; index: number } };

/**
 * Custom XAxis tick renderer that shows a small, **evenly-spaced** set of labels
 * which always includes the first and last category (so a Jan–Dec chart always
 * shows Jan … Dec, e.g. Jan / May / Aug / Dec). Use with `interval={0}`.
 */
export function spacedTicks(count: number, target = 4): (props: TickProps) => ReactElement<SVGElement> {
  const shown = new Set<number>();
  const n = Math.max(1, Math.min(target, count));
  for (let i = 0; i < n; i++) shown.add(Math.round((i * (count - 1)) / Math.max(1, n - 1)));
  return ({ x, y, payload }: TickProps) => {
    const el =
      payload && shown.has(payload.index)
        ? createElement(
            "text",
            { x, y, dy: 12, textAnchor: "middle", fontSize: 11, fill: "#9ca3af" },
            payload.value,
          )
        : createElement("g");
    return el as unknown as ReactElement<SVGElement>;
  };
}

/** Returns Recharts <Tooltip> contentStyle matching the current colour scheme. */
export function tooltipStyle(): React.CSSProperties {
  const dark = document.documentElement.classList.contains("dark");
  return {
    borderRadius: "10px",
    border: `1px solid ${dark ? "#374151" : "#e5e7eb"}`,
    backgroundColor: dark ? "#111827" : "#ffffff",
    color: dark ? "#f9fafb" : "#111827",
    fontSize: "13px",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,.1)",
  };
}

/** Returns Recharts <Tooltip> cursor prop — subtle in dark mode, almost invisible. */
export function cursorStyle(): React.SVGProps<SVGRectElement> {
  const dark = document.documentElement.classList.contains("dark");
  return { fill: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" };
}

/** Tooltip item (series value) text style — neutral grey in both themes. */
export const tooltipItemStyle: React.CSSProperties = { color: "#9ca3af" };

/** Tooltip label (header) text style — slightly lighter grey. */
export const tooltipLabelStyle: React.CSSProperties = { color: "#9ca3af", fontWeight: 600 };
