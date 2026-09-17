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

/**
 * Muted, natural chart colours that sit well on the dark theme. Warm reds,
 * oranges and pinks are deliberately absent; red is kept for "bad" only.
 */
export const CHART = {
  moss: "#8fae73",
  sage: "#a9bf86",
  slate: "#7f9cc0",
  dusk: "#6f9fb8",
  lavender: "#a59bc4",
  sand: "#c8b58f",
  stone: "#9c8f7a",
  teal: "#6fa6a0",
  indigo: "#6f7fd6",
  grey: "#9ca3af",
  /** Placeholder fill for "not yet"/"still to come" — faint in both themes. */
  mist: "rgba(148,163,184,0.28)",
  bad: "#e0786f",
  /** Getting close to a budget — softer than a warning amber. */
  warn: "#d9a86a",
} as const;

/**
 * The same muted pair as the over/under bars, as Tailwind classes: money spent
 * beyond a budget, and money still in hand. Softer than the stock red/emerald,
 * and legible on both themes.
 */
export const STATUS = {
  over: "text-[#c9584f] dark:text-[#e8938a]",
  under: "text-[#5d7a45] dark:text-[#a9c48f]",
  /** The same two as fills, for charts that sit beside those figures. */
  overFill: "#e0786f",
  underFill: "#a9c48f",
  /** Fill for a "share of budget used" bar. */
  bar: (pct: number) => (pct >= 100 ? "bg-[#e0786f]" : pct > 80 ? "bg-[#d9a86a]" : "bg-[#6f7fd6]"),
} as const;

/** Axis label style shared by every chart. */
export const axisTick = { fontSize: 11, fill: "#9ca3af" };

/** Horizontal grid lines — visible but quiet on light and dark. */
export const gridStroke = "rgba(148,163,184,0.14)";

/** Returns Recharts <Tooltip> contentStyle matching the current colour scheme. */
export function tooltipStyle(): React.CSSProperties {
  const dark = document.documentElement.classList.contains("dark");
  return {
    borderRadius: "12px",
    padding: "8px 12px",
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
