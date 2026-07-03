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
