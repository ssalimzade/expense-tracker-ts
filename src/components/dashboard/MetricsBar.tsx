import type { ReactNode } from "react";
import { gbp0 as gbp, formatMonthLabel, toMonthKey } from "../../lib/format";
import Hero, { HeroChip, HeroProgress } from "../Hero";
import { WalletArt, IN_COLUMN } from "../HeroArt";

interface Props {
  totalBudget: number;
  totalSpent: number;
  month: string;
  /** Shown beside the figures on wide screens (the pace chart). */
  aside?: ReactNode;
}

export default function MetricsBar({ totalBudget, totalSpent, month, aside }: Props) {
  const remaining = totalBudget - totalSpent;
  const pct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Days left only means something for the month you're in.
  const isCurrent = month === toMonthKey(new Date());
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const daysLeft = isCurrent ? daysInMonth - new Date().getDate() + 1 : 0;
  const perDay = daysLeft > 0 && remaining > 0 ? remaining / daysLeft : 0;
  const now = new Date();
  const todayDate = now.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  const todayWeekday = now.toLocaleDateString("en-GB", { weekday: "long" });

  return (
    <Hero
      gradient="from-indigo-500 via-blue-600 to-sky-600 dark:from-indigo-700 dark:via-blue-800 dark:to-sky-900"
      badge={formatMonthLabel(month)}
      badgeNote={
        isCurrent ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-black/15 py-0.5 pl-1 pr-3">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-extrabold tabular-nums text-indigo-700">
              {now.getDate()}
            </span>
            <span className="font-semibold text-white">{todayWeekday}</span>
            <span className="text-white/70">{todayDate}</span>
          </span>
        ) : undefined
      }
      aside={aside}
      asideFrom="lg"
      label="Spent so far"
      value={gbp(totalSpent)}
      decoration={
        <WalletArt className={IN_COLUMN} />
      }
      under={
        <div className="max-w-xl space-y-1.5">
          <HeroProgress pct={pct} danger={pct >= 100} />
          <div className="flex justify-between text-xs text-white/80 tabular-nums">
            <span>{Math.round(pct)}% of {gbp(totalBudget)}</span>
            {remaining < 0 && <HeroChip>Over by {gbp(-remaining)}</HeroChip>}
          </div>
        </div>
      }
      fields={[
        { label: "Budget", value: gbp(totalBudget) },
        { label: remaining < 0 ? "Over budget" : "Remaining", value: gbp(Math.abs(remaining)), warn: remaining < 0 },
        ...(isCurrent
          ? [
              { label: "Days left", value: String(daysLeft), sub: `of ${daysInMonth}` },
              { label: "Per day", value: perDay > 0 ? gbp(perDay) : "—", sub: "to stay on budget" },
            ]
          : []),
      ]}
    />
  );
}
