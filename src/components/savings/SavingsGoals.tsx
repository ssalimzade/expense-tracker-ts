import { useState } from "react";
import type { SavingsGoal, SavingsRow } from "../../types/savings";
import { useDeleteSavingsGoal, useSaveSavingsGoal, useSavingsGoals } from "../../hooks/useSavings";
import { formatMonthLabelMid, gbp0, toMonthKey } from "../../lib/format";
import { MAX_MONTHS, addMonths, averageSaved, balanceNow, goalOutlook, monthlyFor, monthsToGoal, reachMonth, spanLabel } from "../../lib/savingsGoal";
import { QueryState } from "../common";
import { HeroProgress } from "../Hero";
import MoneyInput from "../MoneyInput";
import GoalDialog from "./GoalDialog";

const GOAL_STORAGE_KEY = "savings-goal";
const STEP = 10;
/** Where the hero's goal strip scrolls to. */
export const GOALS_ANCHOR = "savings-goals";

const roundUpTo = (n: number, step: number) => Math.max(step, Math.ceil(n / step) * step);
/** Rounds up to a figure that reads well at the end of the slider: £4,000, £12,000, £25,000. */
const niceCeil = (n: number) => roundUpTo(n, n <= 1_000 ? 100 : n <= 5_000 ? 500 : n <= 20_000 ? 1_000 : 5_000);

const surface = "rounded-3xl bg-white ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800";
const sectionLabel = "text-xs font-bold uppercase tracking-[0.14em] text-gray-400";
const primaryBtn =
  "rounded-2xl bg-gray-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200";

const storedId = () => {
  try {
    return localStorage.getItem(GOAL_STORAGE_KEY);
  } catch {
    return null;
  }
};

/** The goal on show, remembered across visits. Shared by the hero and the planner. */
export function useSelectedGoal() {
  const [id, setId] = useState(storedId);
  const select = (next: string) => {
    setId(next);
    try {
      localStorage.setItem(GOAL_STORAGE_KEY, next);
    } catch {
      // Not remembered, but the switch still works.
    }
  };
  return [id, select] as const;
}

/**
 * Savings goals: pick one, see how far along it is, and drag a monthly amount
 * to see how long it'd take — or type a number of months to see what it needs.
 */
export default function SavingsGoals({
  rows,
  selectedId,
  onSelect: select,
}: {
  rows: SavingsRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const goalsQuery = useSavingsGoals();
  const saveGoal = useSaveSavingsGoal();
  const removeGoal = useDeleteSavingsGoal();
  const [editor, setEditor] = useState<{ goal?: SavingsGoal } | null>(null);

  const current = toMonthKey(new Date());
  const balance = balanceNow(rows, current);
  const average = averageSaved(rows, current);
  const goals = goalsQuery.data ?? [];
  const selected = goals.find((g) => g.id === selectedId) ?? goals[0];

  const onSave = async (goal: Partial<SavingsGoal>) => {
    const before = new Set(goals.map((g) => g.id));
    const after = await saveGoal.mutateAsync(goal);
    // A new goal gets its id from the server; open it once it's there.
    const id = goal.id ?? after.find((g) => !before.has(g.id))?.id;
    if (id) select(id);
    setEditor(null);
  };

  const onDelete = (goal: SavingsGoal) => {
    if (window.confirm(`Delete the "${goal.name}" goal?`)) removeGoal.mutate(goal);
  };

  const savedFor = (g: SavingsGoal) => g.saved ?? balance;
  const pctOf = (g: SavingsGoal) => Math.min(100, Math.max(0, Math.floor((savedFor(g) / g.target) * 100)));

  return (
    <section id={GOALS_ANCHOR} className="scroll-mt-20">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold tracking-tight">Savings goal{goals.length > 1 ? "s" : ""}</h2>
          <p className="text-xs text-gray-400">Pick a monthly amount and see when you'll get there</p>
        </div>
        {goals.length > 0 && (
          <button type="button" onClick={() => setEditor({})} className={`${primaryBtn} shrink-0`}>
            + New goal
          </button>
        )}
      </div>

      {/* Goals kept from an earlier visit still show if a refresh fails. */}
      <QueryState isLoading={goalsQuery.isLoading} error={goalsQuery.data ? null : goalsQuery.error}>
        {goals.length > 1 && (
          <div className="-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
            {goals.map((g) => {
              const active = g.id === selected?.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => select(g.id)}
                  className={`min-w-[8.5rem] max-w-[13rem] shrink-0 rounded-2xl px-4 py-2.5 text-left transition ${
                    active
                      ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                      : "bg-white ring-1 ring-gray-100 hover:bg-gray-50 dark:bg-gray-900 dark:ring-gray-800 dark:hover:bg-gray-800/60"
                  }`}
                >
                  <p className="truncate text-sm font-bold">{g.name}</p>
                  <p className={`mt-0.5 text-[11px] tabular-nums ${active ? "opacity-70" : "text-gray-400"}`}>
                    {pctOf(g)}% of {gbp0(g.target)}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {selected ? (
          <GoalCard
            // A fresh planner per goal, so the slider starts from that goal's numbers.
            key={selected.id}
            goal={selected}
            saved={savedFor(selected)}
            average={average}
            current={current}
            savingPlan={saveGoal.isPending}
            onEdit={() => setEditor({ goal: selected })}
            onDelete={() => onDelete(selected)}
            // Only the plan, so it can't undo an edit saved a moment before.
            onSavePlan={(monthly) => saveGoal.mutate({ id: selected.id, monthly })}
          />
        ) : (
          <div className={`${surface} flex flex-col items-center px-6 py-10 text-center`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8fae73]/15 text-[#5d7a45] dark:text-[#a9c48f]">
              <FlagIcon className="h-6 w-6" />
            </span>
            <p className="mt-3 text-base font-bold">No savings goal yet</p>
            <p className="mt-1 max-w-sm text-sm text-gray-400">
              Set a target — a house deposit, a car, a rainy-day fund — and see how long it takes at different monthly amounts.
            </p>
            <button type="button" onClick={() => setEditor({})} className={`${primaryBtn} mt-4`}>
              + Set a goal
            </button>
          </div>
        )}
      </QueryState>

      {editor && (
        <GoalDialog goal={editor.goal} balance={balance} current={current} onCancel={() => setEditor(null)} onSave={onSave} />
      )}
    </section>
  );
}

function GoalCard({
  goal,
  saved,
  average,
  current,
  savingPlan,
  onEdit,
  onDelete,
  onSavePlan,
}: {
  goal: SavingsGoal;
  saved: number;
  average: number | null;
  current: string;
  savingPlan: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSavePlan: (monthly: number) => void;
}) {
  const { remaining, pct, first, monthsLeft, deadlineState, needed, plan } = goalOutlook(goal, saved, current);
  // Saving starts after next month, so say when.
  const later = first > addMonths(current, 1);
  const usual = average && average >= 1 ? Math.round(average) : null;

  // Start from the saved plan, else what the deadline needs, else the usual pace.
  const [monthly, setMonthly] = useState(() => plan ?? needed ?? usual ?? 500);
  // A typed number of months stays on screen as typed — whole pounds can't
  // always land on it exactly — until the amount is changed some other way.
  const [pinnedMonths, setPinnedMonths] = useState<number | null>(null);
  // Only typing or a preset raises the slider's top, never dragging, so the
  // scale can't shift under a finger.
  const [ceiling, setCeiling] = useState(() => roundUpTo(monthly, STEP));

  // The slider reaches the pace that clears the goal in about three months —
  // at least twice every suggestion, at most five times (a bigger amount can
  // still be typed) — and never past clearing it all next month.
  const reference = Math.max(usual ?? 0, needed ?? 0, plan ?? 0);
  const fast = Math.min(Math.max(remaining / 3, 1_000, reference * 2), Math.max(5_000, reference * 5));
  const sliderMax = Math.max(Math.min(niceCeil(fast), roundUpTo(remaining, STEP)), ceiling);

  const choose = (n: number) => {
    setMonthly(n);
    setPinnedMonths(null);
    if (n > sliderMax) setCeiling(roundUpTo(n, STEP));
  };

  // A pin only holds while it still matches the amount — the goal or balance
  // may have moved since it was typed.
  const months =
    pinnedMonths !== null && monthlyFor(remaining, pinnedMonths) === monthly
      ? pinnedMonths
      : monthsToGoal(remaining, Math.max(1, monthly));
  const far = months > MAX_MONTHS;
  const reach = reachMonth(first, far ? 0 : months);
  const early = monthsLeft !== null && !far ? monthsLeft - months : null;

  const presets = [
    usual !== null ? { label: "Your average", value: usual, title: "Average monthly savings over the last 12 months" } : null,
    needed !== null && goal.deadline ? { label: `Hit ${formatMonthLabelMid(goal.deadline)}`, value: needed } : null,
    plan !== null ? { label: "Your plan", value: plan } : null,
  ].filter((p): p is { label: string; value: number; title?: string } => p !== null);

  const rounded = Math.round(monthly);
  const planChanged = rounded !== plan;

  return (
    <div className={`${surface} grid overflow-hidden lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]`}>
      {/* Where the goal stands */}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={sectionLabel}>
              {later && goal.deadline
                ? `${formatMonthLabelMid(first)} – ${formatMonthLabelMid(goal.deadline)}`
                : later
                  ? `From ${formatMonthLabelMid(first)}`
                  : goal.deadline
                    ? `By ${formatMonthLabelMid(goal.deadline)}`
                    : "No deadline"}
            </p>
            <h3 className="mt-1 truncate text-xl font-extrabold tracking-tight">{goal.name}</h3>
          </div>
          <div className="-mr-2 -mt-1.5 flex shrink-0">
            <IconButton label={`Edit the ${goal.name} goal`} onClick={onEdit}>
              <path d="M11.5 2.5l2 2L6 12l-2.75.75L4 10l7.5-7.5Z" />
            </IconButton>
            <IconButton label={`Delete the ${goal.name} goal`} onClick={onDelete} danger>
              <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5" />
            </IconButton>
          </div>
        </div>

        <p className="mt-4 text-3xl font-extrabold tabular-nums tracking-tight">
          {gbp0(saved)}
          <span className="ml-1.5 text-base font-semibold text-gray-400">of {gbp0(goal.target)}</span>
        </p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div className="h-full rounded-full bg-[#8fae73] transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-xs tabular-nums text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-[#5d7a45] dark:text-[#a9c48f]">{Math.floor(pct)}% there</span>
          <span>{remaining > 0 ? `${gbp0(remaining)} to go` : "Target reached"}</span>
        </div>
        <p className="mt-4 text-[11px] text-gray-400">
          {goal.saved == null ? "Counts your whole savings balance, as of this month." : "Counts the amount you set for it — edit the goal to update it."}
        </p>
      </div>

      {/* The planner */}
      <div className="border-t border-gray-100 p-5 dark:border-gray-800 sm:p-6 lg:border-l lg:border-t-0">
        {remaining <= 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#8fae73]/15 text-[#5d7a45] dark:text-[#a9c48f]">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M3.5 8.5l3 3 6-7" />
              </svg>
            </span>
            <p className="mt-3 text-base font-bold">Goal reached</p>
            <p className="mt-1 text-sm text-gray-400">
              {saved > goal.target ? `${gbp0(saved - goal.target)} past the target.` : "Right on the target."} Raise it, or set a new goal.
            </p>
          </div>
        ) : (
          <>
            {deadlineState && goal.deadline && monthsLeft !== null && (
              <div
                className={`mb-5 rounded-2xl px-4 py-3 text-sm ${
                  deadlineState === "ok"
                    ? "bg-[#8fae73]/10 text-gray-600 dark:bg-[#8fae73]/[0.08] dark:text-gray-300"
                    : deadlineState === "now"
                      ? "bg-gray-50 text-gray-600 dark:bg-gray-800/50 dark:text-gray-300"
                      : "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300"
                }`}
              >
                {needed !== null ? (
                  <p>
                    To reach it by <span className="font-semibold">{formatMonthLabelMid(goal.deadline)}</span>, save{" "}
                    <span className="font-extrabold tabular-nums text-[#5d7a45] dark:text-[#a9c48f]">{gbp0(needed)}</span> a month for{" "}
                    {spanLabel(monthsLeft)}
                    {later && <> from {formatMonthLabelMid(first)}</>}.
                  </p>
                ) : deadlineState === "now" ? (
                  <p>Your deadline is this month — anything new you save counts from next month. Edit the goal to move it.</p>
                ) : deadlineState === "beforeStart" ? (
                  <p>
                    The {formatMonthLabelMid(goal.deadline)} deadline comes before you start saving in {formatMonthLabelMid(first)} — edit the goal to
                    move one of them.
                  </p>
                ) : (
                  <p>The {formatMonthLabelMid(goal.deadline)} deadline has passed — edit the goal to pick a new one.</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className={sectionLabel}>Save each month</p>
              <MoneyInput
                value={monthly}
                ariaLabel="Monthly saving"
                // A blank or £0 entry isn't a plan — keep what was there.
                onCommit={(n) => n >= 1 && choose(Math.round(n))}
                className="!w-32 !px-1 !text-right !text-2xl font-extrabold text-[#5d7a45] dark:text-[#a9c48f]"
              />
            </div>
            <input
              type="range"
              aria-label="Monthly saving"
              aria-valuetext={`${gbp0(monthly)} a month`}
              min={STEP}
              max={sliderMax}
              step={STEP}
              value={monthly}
              onChange={(e) => {
                setMonthly(Number(e.target.value));
                setPinnedMonths(null);
              }}
              style={{ "--fill": `${((Math.min(monthly, sliderMax) - STEP) / Math.max(1, sliderMax - STEP)) * 100}%` } as React.CSSProperties}
              className="goal-range mt-2 w-full cursor-pointer"
            />
            <div className="flex justify-between text-[11px] tabular-nums text-gray-400">
              <span>{gbp0(STEP)}</span>
              <span>{gbp0(sliderMax)}</span>
            </div>

            {presets.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {presets.map((p) => {
                  const on = rounded === p.value;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      title={p.title}
                      aria-pressed={on}
                      onClick={() => choose(p.value)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold tabular-nums transition ${
                        on
                          ? "bg-[#5d7a45] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      {p.label} · {gbp0(p.value)}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-gray-800/50">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Time to goal</p>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <MoneyInput
                    value={months}
                    pound={false}
                    ariaLabel="Months to reach the goal"
                    onCommit={(n) => {
                      // A blank or 0 isn't a timeframe — keep what was there.
                      if (n < 1) return;
                      const m = Math.min(MAX_MONTHS, Math.round(n));
                      choose(monthlyFor(remaining, m));
                      setPinnedMonths(m);
                    }}
                    className={`${months < 10 ? "!w-9" : months < 100 ? "!w-12" : months < 1_000 ? "!w-16" : "!w-24"} !rounded-lg !bg-gray-200/70 !px-1 !py-0 !text-2xl font-extrabold focus:!w-20 focus:!border-[#8fae73] dark:!bg-gray-700/60`}
                  />
                  <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">month{months === 1 ? "" : "s"}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-gray-400">
                  {far ? "over 100 years" : later ? `saving from ${formatMonthLabelMid(first)}` : months >= 12 ? spanLabel(months) : (
                    <>
                      <span className="md:hidden">tap to change</span>
                      <span className="hidden md:inline">click to change</span>
                    </>
                  )}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-gray-800/50">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">You'd get there</p>
                <p className="mt-0.5 text-2xl font-extrabold tabular-nums tracking-tight">{far ? "—" : formatMonthLabelMid(reach)}</p>
                <p
                  className={`mt-0.5 truncate text-[11px] ${
                    early === null ? "text-gray-400" : early >= 0 ? "font-semibold text-[#5d7a45] dark:text-[#a9c48f]" : "font-semibold text-rose-500"
                  }`}
                >
                  {far
                    ? "save more a month"
                    : early === null
                      ? "no deadline set"
                      : early > 0
                        ? `${spanLabel(early)} early`
                        : early === 0
                          ? "right on the deadline"
                          : `${spanLabel(-early)} late`}
                </p>
              </div>
            </div>

            <div className="mt-4 flex min-h-[2.5rem] flex-wrap items-center justify-between gap-2">
              {planChanged ? (
                <>
                  <p className="text-xs text-gray-400">{plan === null ? "Like this pace? Keep it with the goal." : `Your plan is ${gbp0(plan)} a month.`}</p>
                  <button type="button" disabled={savingPlan} onClick={() => onSavePlan(rounded)} className={primaryBtn}>
                    {savingPlan ? "Saving…" : `Save ${gbp0(rounded)} a month as plan`}
                  </button>
                </>
              ) : (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#5d7a45] dark:text-[#a9c48f]">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                  This is your plan
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function IconButton({ label, onClick, danger = false, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-lg p-2 text-gray-400 transition dark:text-gray-500 ${
        danger ? "hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40" : "hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      }`}
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        {children}
      </svg>
    </button>
  );
}

const FlagIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </svg>
);

/** The two lines the hero strip ends on: when it'll be reached, and on what. */
function heroOutlook(goal: SavingsGoal, saved: number, current: string): { headline: string; sub: string; late?: boolean } {
  const { remaining, first, monthsLeft, deadlineState, needed, plan, months } = goalOutlook(goal, saved, current);
  const from = first > addMonths(current, 1) ? ` from ${formatMonthLabelMid(first)}` : "";
  if (remaining <= 0) {
    return { headline: "Reached", sub: saved > goal.target ? `${gbp0(saved - goal.target)} past the target` : "right on the target" };
  }
  if (plan !== null && months !== null) {
    if (months > MAX_MONTHS) return { headline: "100+ years", sub: `at ${gbp0(plan)} a month${from}`, late: monthsLeft !== null };
    const early = monthsLeft !== null ? monthsLeft - months : null;
    const vs = early === null ? "" : early >= 0 ? " · on time" : ` · ${spanLabel(-early)} late`;
    return { headline: formatMonthLabelMid(reachMonth(first, months)), sub: `at ${gbp0(plan)} a month${from}${vs}`, late: early !== null && early < 0 };
  }
  if (needed !== null && goal.deadline) return { headline: `${gbp0(needed)} a month`, sub: `${from.trim() ? `${from.trim()} ` : ""}to make ${formatMonthLabelMid(goal.deadline)}` };
  if (deadlineState && deadlineState !== "ok") {
    const headline = deadlineState === "now" ? "Due this month" : deadlineState === "beforeStart" ? "Deadline before start" : "Deadline passed";
    return { headline, sub: "edit the goal to move it", late: true };
  }
  return { headline: "No plan yet", sub: "pick a monthly amount" };
}

/**
 * The goal on the Savings hero: how far along it is and when it lands at the
 * saved plan. The whole strip opens the planner.
 */
export function HeroGoal({
  goal,
  saved,
  current,
  position,
  count,
  onOpen,
}: {
  goal: SavingsGoal;
  saved: number;
  current: string;
  /** Where this goal sits among `count`, for the "2 of 3" note. */
  position: number;
  count: number;
  onOpen: () => void;
}) {
  const { pct } = goalOutlook(goal, saved, current);
  const { headline, sub, late } = heroOutlook(goal, saved, current);
  const label = `Goal${count > 1 ? ` · ${position} of ${count}` : ""}`;
  const amounts = (
    <span className="tabular-nums">
      {gbp0(saved)} of {gbp0(goal.target)}
    </span>
  );
  const subLine = <span className={late ? "font-semibold text-rose-100" : ""}>{sub}</span>;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${goal.name}: ${Math.floor(pct)}% there, ${headline} ${sub}. Open the goal planner.`}
      className="group w-full rounded-2xl bg-white/10 px-4 py-3 text-left ring-1 ring-white/10 transition hover:bg-white/[0.15] sm:px-5"
    >
      <div className="flex items-center gap-3 lg:gap-6">
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 sm:flex">
          <FlagIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 lg:w-56 lg:flex-none">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">{label}</p>
          <p className="truncate text-base font-bold">{goal.name}</p>
        </div>
        <p className="shrink-0 text-xl font-extrabold tabular-nums lg:hidden">{Math.floor(pct)}%</p>

        {/* Wide screens: bar, then the outlook, on one line. */}
        <div className="hidden min-w-0 flex-1 lg:block">
          <HeroProgress pct={pct} />
          <div className="mt-1.5 flex justify-between gap-3 text-xs text-white/70">
            {amounts}
            <span className="font-semibold text-white">{Math.floor(pct)}% there</span>
          </div>
        </div>
        <div className="hidden w-72 shrink-0 text-right lg:block">
          <p className="text-lg font-extrabold tabular-nums">{headline}</p>
          <p className="truncate text-xs text-white/70">{subLine}</p>
        </div>
        <svg viewBox="0 0 16 16" fill="currentColor" className="hidden h-4 w-4 shrink-0 text-white/60 transition group-hover:translate-x-0.5 group-hover:text-white sm:block">
          <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </div>

      {/* Phones and tablets: bar underneath. */}
      <div className="mt-2.5 lg:hidden">
        <HeroProgress pct={pct} />
        <div className="mt-1.5 flex justify-between gap-3 text-[11px] text-white/70">
          {amounts}
          <span className="min-w-0 truncate text-right">
            <span className="font-semibold text-white">{headline}</span> {subLine}
          </span>
        </div>
      </div>
    </button>
  );
}
