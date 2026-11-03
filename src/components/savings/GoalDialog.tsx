import { useId, useState } from "react";
import type { SavingsGoal } from "../../types/savings";
import { gbp0 } from "../../lib/format";
import { addMonths } from "../../lib/savingsGoal";
import TravelDialog, { fieldLabel, secondaryBtn } from "../travel/TravelDialog";
import MonthPicker from "./MonthPicker";

/** Server-side limit (lib/config.ts MAX_GOAL_NAME), applied as `maxLength`. */
const MAX_NAME = 40;

const START_PICKS = [
  { label: "In 2 months", months: 2 },
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
];
const DEADLINE_PICKS = [
  { label: "In 1 year", months: 12 },
  { label: "2 years", months: 24 },
  { label: "5 years", months: 60 },
];

const fieldInput =
  "mt-1 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm font-medium focus:border-[#8fae73] focus:outline-none dark:border-gray-600 dark:[color-scheme:dark]";
const primaryBtn =
  "flex-1 rounded-lg bg-[#5d7a45] px-3 py-2 text-sm font-semibold text-white hover:bg-[#526a44] disabled:opacity-40";

/** Most an amount can be — the server's cap is £100,000,000. */
const MAX_DIGITS = 9;

/**
 * Whole pounds with thousands commas, as typed: "50000" → "50,000". Works on
 * the digits as text, so deleting a leading digit of "1,000" leaves "000" to
 * type in front of rather than collapsing to "0". Pasted pence are dropped.
 */
const withCommas = (raw: string) =>
  raw
    .replace(/\.\d{0,2}$/, "")
    .replace(/[^0-9]/g, "")
    .slice(0, MAX_DIGITS)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Backspace or Delete next to a comma removes the digit beyond it, not just the comma. */
const skipComma = (e: React.KeyboardEvent<HTMLInputElement>) => {
  const el = e.currentTarget;
  const at = el.selectionStart;
  if (at === null || at !== el.selectionEnd) return;
  if (e.key === "Backspace" && el.value[at - 1] === ",") el.setSelectionRange(at - 1, at - 1);
  if (e.key === "Delete" && el.value[at] === ",") el.setSelectionRange(at + 1, at + 1);
};

const parseAmount = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Create or edit a savings goal. */
export default function GoalDialog({
  goal,
  balance,
  current,
  onCancel,
  onSave,
}: {
  goal?: SavingsGoal;
  /** The savings balance now — what a goal counts unless given its own amount. */
  balance: number;
  /** This month, "YYYY-MM". */
  current: string;
  onCancel: () => void;
  /** Resolves once saved; rejects (and the error toast shows) if it didn't. */
  onSave: (goal: Partial<SavingsGoal>) => Promise<void>;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? goal.target.toLocaleString("en-GB") : "");
  // A start that has come round no longer does anything, so it isn't shown.
  const [start, setStart] = useState(goal?.start && goal.start > current ? goal.start : "");
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [ownAmount, setOwnAmount] = useState(goal?.saved != null);
  const [saved, setSaved] = useState(goal?.saved != null ? goal.saved.toLocaleString("en-GB") : "");
  const [saving, setSaving] = useState(false);
  const ids = useId();

  const next = addMonths(current, 1);
  const deadlineBeforeStart = start !== "" && deadline !== "" && deadline < start;
  const valid = name.trim() !== "" && parseAmount(target) >= 1 && !deadlineBeforeStart;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    // On failure the dialog stays open with everything as typed.
    // The plan isn't sent, so an edit keeps whatever the planner last saved.
    await onSave({
      ...(goal ? { id: goal.id } : {}),
      name: name.trim(),
      target: Math.round(parseAmount(target)),
      start: start || null,
      deadline: deadline || null,
      saved: ownAmount ? Math.round(parseAmount(saved)) : null,
    }).catch(() => setSaving(false));
  };
  const onEnter = (e: React.KeyboardEvent) => e.key === "Enter" && save();

  const pounds = (value: string, set: (v: string) => void, placeholder: string, autoFocus = false) => (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-sm text-gray-400">£</span>
      <input
        // Whole pounds, so the keypad without a decimal point.
        inputMode="numeric"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          // Keep the caret after the same digit once the commas move.
          const el = e.target;
          const digitsBefore = el.value.slice(0, el.selectionStart ?? el.value.length).replace(/[^0-9]/g, "").length;
          const next = withCommas(el.value);
          set(next);
          requestAnimationFrame(() => {
            let pos = 0;
            for (let seen = 0; pos < next.length && seen < digitsBefore; pos++) if (/\d/.test(next[pos])) seen++;
            el.setSelectionRange(pos, pos);
          });
        }}
        onKeyDown={(e) => {
          skipComma(e);
          onEnter(e);
        }}
        className={`${fieldInput} pl-7 tabular-nums`}
      />
    </div>
  );

  return (
    <TravelDialog title={goal ? "Edit goal" : "New savings goal"} onClose={onCancel}>
      <label className={fieldLabel}>What it's for</label>
      <input
        autoFocus
        value={name}
        maxLength={MAX_NAME}
        placeholder="e.g. House deposit"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onEnter}
        className={fieldInput}
      />

      <label className={fieldLabel}>Target</label>
      {pounds(target, setTarget, "50,000")}

      <label id={`${ids}-start`} className={fieldLabel}>
        Start saving (optional)
      </label>
      <MonthPicker
        labelledBy={`${ids}-start`}
        value={start}
        onChange={setStart}
        min={next}
        current={current}
        placeholder="From next month"
        quick={START_PICKS}
        clearLabel="From next month"
        className={fieldInput}
      />

      <label id={`${ids}-deadline`} className={fieldLabel}>
        Reach it by (optional)
      </label>
      <MonthPicker
        labelledBy={`${ids}-deadline`}
        value={deadline}
        onChange={setDeadline}
        min={start > next ? start : next}
        current={current}
        placeholder="No deadline"
        quick={DEADLINE_PICKS}
        clearLabel="No deadline"
        className={fieldInput}
      />
      {deadlineBeforeStart && <p className="mt-1 text-[11px] text-rose-500">The deadline is before the start — move one of them.</p>}

      <label className={fieldLabel}>Saved so far</label>
      <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900/60">
        {[
          { own: false, label: "Savings balance", sub: gbp0(balance) },
          { own: true, label: "Own amount", sub: "for this goal only" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => setOwnAmount(o.own)}
            className={`rounded-lg px-2 py-1.5 text-center transition ${
              ownAmount === o.own ? "bg-white shadow-sm dark:bg-gray-700" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <span className="block text-xs font-semibold">{o.label}</span>
            <span className="block text-[11px] tabular-nums text-gray-400">{o.sub}</span>
          </button>
        ))}
      </div>
      {ownAmount ? (
        // Focus it when switched on here, not when the dialog opens with it on.
        <div className="mt-2">{pounds(saved, setSaved, "0", goal?.saved == null)}</div>
      ) : (
        <p className="mt-1.5 text-[11px] text-gray-400">Follows the Savings balance as the months fill in.</p>
      )}

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onCancel} className={secondaryBtn}>
          Cancel
        </button>
        <button type="button" onClick={save} disabled={!valid || saving} className={primaryBtn}>
          {saving ? "Saving…" : goal ? "Save" : "Add goal"}
        </button>
      </div>
    </TravelDialog>
  );
}
