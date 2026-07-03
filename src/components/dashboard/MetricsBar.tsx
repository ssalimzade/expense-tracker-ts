import { gbp0 as gbp } from "../../lib/format";

interface Props {
  totalBudget: number;
  totalSpent: number;
}

export default function MetricsBar({ totalBudget, totalSpent }: Props) {
  const remaining = totalBudget - totalSpent;
  const pct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

  const metrics = [
    {
      label: "Total Budget",
      value: totalBudget,
      color: "text-gray-900 dark:text-white",
      bg: "bg-gray-50 dark:bg-gray-800/60",
      border: "border-gray-200 dark:border-gray-700",
    },
    {
      label: "Spent",
      value: totalSpent,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50/60 dark:bg-indigo-950/40",
      border: "border-indigo-100 dark:border-indigo-900",
    },
    {
      label: "Remaining",
      value: remaining,
      color: remaining < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
      bg: remaining < 0 ? "bg-red-50/60 dark:bg-red-950/40" : "bg-emerald-50/60 dark:bg-emerald-950/40",
      border: remaining < 0 ? "border-red-100 dark:border-red-900" : "border-emerald-100 dark:border-emerald-900",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`rounded-2xl border ${m.border} ${m.bg} px-2.5 py-3 text-center sm:px-5 sm:py-4`}
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:text-xs">
              {m.label}
            </p>
            <p className={`mt-1 text-lg font-bold tracking-tight sm:mt-1.5 sm:text-2xl ${m.color}`}>
              {gbp(m.value)}
            </p>
          </div>
        ))}
      </div>
      {/* Spend progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-indigo-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
