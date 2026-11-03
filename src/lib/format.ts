export const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

// £ with no decimal places, comma-separated thousands.
export const gbp0 = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

export const shortDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
};

// Returns "YYYY-MM" for the given Date.
export const toMonthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// How many past months a month table keeps on screen before "Show earlier".
const PAST_MONTHS_SHOWN = 2;

// The first month a table opens with when `current` is this month ("YYYY-MM").
export const openingMonth = (current: string) => {
  const [year, month] = current.split("-").map(Number);
  return toMonthKey(new Date(year, month - 1 - PAST_MONTHS_SHOWN, 1));
};

// Builds a list of recent month keys, newest first. Stops at 2025-05 (earliest data).
export function recentMonths(count = 18): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = toMonthKey(d);
    if (key < "2025-05") break;
    months.push(key);
  }
  return months;
}

/** Format "2026-06" → "June 2026" (full month name — used everywhere except graphs) */
export const formatMonthLabel = (m: string): string => {
  const [year, month] = m.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return `${d.toLocaleString("en-GB", { month: "long" })} ${year}`;
};

/** Format "2026-06" → "Jun 2026" (short month, full year) */
export const formatMonthLabelMid = (m: string): string => {
  const [year, month] = m.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return `${d.toLocaleString("en-GB", { month: "short" })} ${year}`;
};

/** Format "2026-06" → "Jun 26" (compact — used where space is tight, e.g. mobile tables) */
export const formatMonthLabelShort = (m: string): string => {
  const [year, month] = m.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return `${d.toLocaleString("en-GB", { month: "short" })} ${year.slice(2)}`;
};
