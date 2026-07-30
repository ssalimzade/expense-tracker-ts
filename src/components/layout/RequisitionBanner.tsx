import { useRequisitionStatus } from "../../hooks/useRequisitionStatus";

// Warn this many days before a GoCardless consent expires.
const WARN_DAYS = 7;

const LABELS: Record<string, string> = {
  amex: "Amex",
  chase: "Chase",
  hsbc: "HSBC",
};

/**
 * Top-of-app banner that warns when a bank connection (GoCardless requisition)
 * is within WARN_DAYS of expiring, so transactions don't silently stop syncing.
 * Hidden entirely when nothing is expiring soon.
 */
export default function RequisitionBanner() {
  const { data } = useRequisitionStatus();
  if (!data) return null;

  const expiring = data.filter(
    (r) => r.days_left !== null && r.days_left <= WARN_DAYS,
  );
  if (expiring.length === 0) return null;

  const anyExpired = expiring.some((r) => (r.days_left ?? 0) <= 0);

  const summary = expiring
    .map((r) => {
      const label = LABELS[r.source] ?? r.source;
      const d = r.days_left ?? 0;
      return d <= 0 ? `${label} (expired)` : `${label} (in ${d} day${d === 1 ? "" : "s"})`;
    })
    .join(", ");

  const tone = anyExpired
    ? "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200";

  // One source → targeted command; several → renew them all in one go.
  const command =
    expiring.length === 1
      ? `python -m gocardless.renew ${expiring[0].source}`
      : "python renew_all.py";

  return (
    <div role="alert" className={`border-b px-5 py-2 text-sm ${tone}`}>
      ⚠️ Bank connection{expiring.length > 1 ? "s" : ""} need renewing: {summary}. Run{" "}
      <code className="rounded bg-black/5 px-1 font-mono dark:bg-white/10">{command}</code> to
      reconnect.
    </div>
  );
}
