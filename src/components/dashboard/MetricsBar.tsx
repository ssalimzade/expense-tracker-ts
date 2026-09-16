import type { ReactNode } from "react";
import { gbp0 as gbp, formatMonthLabel, toMonthKey } from "../../lib/format";
import Hero, { HeroChip, HeroProgress } from "../Hero";
import { WalletArt, IN_COLUMN } from "../HeroArt";

interface Props {
  totalBudget: number;
  totalSpent: number;
  month: string;
  /** The pace chart: beside the figures on wide screens, under them on phones. */
  renderChart?: (className: string) => ReactNode;
}

export default function MetricsBar({ totalBudget, totalSpent, month, renderChart }: Props) {
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
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-white/70" aria-hidden>
              <path fillRule="evenodd" d="M4 1.75a.75.75 0 0 1 1.5 0V3h5V1.75a.75.75 0 0 1 1.5 0V3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2V1.75ZM3.5 7v5c0 .28.22.5.5.5h8a.5.5 0 0 0 .5-.5V7h-9Z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold text-white">{todayWeekday},</span>
            <span className="text-white/80">{todayDate}</span>
          </span>
        ) : undefined
      }
      aside={renderChart && <div className="w-[26rem] xl:w-[32rem]">{renderChart("h-32")}</div>}
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
    >
      {renderChart && (
        <div className="mt-6 border-t border-dashed border-white/25 pt-5 lg:hidden">{renderChart("h-24")}</div>
      )}
    </Hero>
  );
}
