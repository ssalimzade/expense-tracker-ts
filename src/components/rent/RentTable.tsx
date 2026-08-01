import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSaveRentMonth } from "../../hooks/useRent";
import { useIsMobile } from "../../hooks/useIsMobile";
import type { RentData, RentItemDef, RentLineItem, RentMonthEntry, RentMatch } from "../../types/rent";
import { gbp0 } from "../../lib/format";
import { potViews } from "../../lib/pots";
import { rentBill, rentCell, rentContribution, rentIsPaid, rentMatch, rentShare } from "../../lib/rent";
import { Card } from "../common";
import MoneyInput from "../MoneyInput";

const mo = (m: string) => new Date(`${m}-01`).toLocaleString("en-GB", { month: "long" });

/** "2026-01-02" → "2 Jan" — a payment date reads better than an ISO string. */
const matchDay = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const currentMonth = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

// Reading order for the mobile card: the housing bills, then the water group
// (matching how the user thinks about them). The two columns are filled from
// this order by count rather than from fixed lists, so they stay even as items
// retire — with the full set that still lands on the original 4/3 split.
const CARD_ORDER = ["flat", "council_tax", "energy", "wifi", "water", "water_savings", "hot_water"];

/**
 * Only rent is shared — the utilities are all yours, so offering to split them
 * would be noise on every cell. Widening this is a one-line change if another
 * bill ever gets divided; the arithmetic behind it is already general.
 */
const SPLITTABLE = new Set(["flat"]);

/**
 * Marks a line item paid / unpaid. When a real transaction was matched the item
 * is auto-paid (link icon) and clicking opens the match menu instead of toggling.
 */
function PaidToggle({
  paid,
  auto,
  hint = "",
  onToggle,
}: {
  paid: boolean;
  auto: boolean;
  /** Appended to the title — surfaces what the icon is hiding. */
  hint?: string;
  onToggle: (anchor: DOMRect) => void;
}) {
  if (auto) {
    return (
      <button
        type="button"
        onClick={(e) => onToggle(e.currentTarget.getBoundingClientRect())}
        title={`Auto-paid${hint} — click for options`}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5">
          <path d="M7.78 3.16a2.75 2.75 0 0 1 3.89 3.89l-1.6 1.6a.75.75 0 0 1-1.06-1.06l1.6-1.6a1.25 1.25 0 0 0-1.77-1.77l-1.6 1.6A.75.75 0 1 1 6.18 4.76l1.6-1.6Zm.5 4.02a.75.75 0 0 1 0 1.06l-1.6 1.6a1.25 1.25 0 0 0 1.77 1.77l1.6-1.6a.75.75 0 1 1 1.06 1.06l-1.6 1.6a2.75 2.75 0 0 1-3.89-3.89l1.6-1.6a.75.75 0 0 1 1.06 0Z" />
        </svg>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => onToggle(e.currentTarget.getBoundingClientRect())}
      title={paid ? `Paid${hint} — click to mark unpaid` : "Unpaid — click to mark paid"}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
        paid
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-gray-300 text-transparent hover:border-emerald-400 dark:border-gray-600"
      }`}
    >
      <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
        <path d="M2.5 6.2 4.7 8.5 9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/**
 * Portalled with fixed positioning so the table's scroll container can't clip
 * it. What clicking away means is the caller's call — a commit for the amount
 * prompts, a dismissal for the menu.
 */
function Popover({
  anchor,
  width,
  padded = true,
  onDismiss,
  children,
}: {
  anchor: DOMRect;
  width: number;
  /** Menus pad their own rows so the hover highlight can reach the edges. */
  padded?: boolean;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const ref = useRef<HTMLDivElement>(null);
  // Measured rather than assumed: the menu's height depends on how many actions
  // it's showing, and a row near the bottom of the table would otherwise open
  // off-screen. Flip above the anchor when it won't fit below.
  const [flip, setFlip] = useState(false);
  useLayoutEffect(() => {
    if (isMobile) return;
    const h = ref.current?.offsetHeight ?? 0;
    setFlip(anchor.bottom + 8 + h > window.innerHeight - 8 && anchor.top - h - 8 >= 8);
  }, [anchor, isMobile]);

  const shell =
    "bg-white/95 shadow-xl shadow-black/10 ring-1 ring-black/5 backdrop-blur-xl dark:bg-gray-800/95 dark:shadow-black/40 dark:ring-white/10";

  if (isMobile) {
    return createPortal(
      <>
        <span
          className="animate-backdrop fixed inset-0 z-[9998] bg-black/40"
          onClick={onDismiss}
        />
        <div
          className={`animate-sheet fixed inset-x-0 bottom-0 z-[9999] rounded-t-3xl pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 ${shell} ${
            padded ? "px-4" : "px-2"
          }`}
        >
          {/* Grab handle — signals the sheet is dismissible. */}
          <span className="mx-auto mb-2 block h-1 w-9 rounded-full bg-gray-300 dark:bg-gray-600" />
          {children}
        </div>
      </>,
      document.body,
    );
  }

  const h = ref.current?.offsetHeight ?? 0;
  const top = flip ? anchor.top - h - 8 : anchor.bottom + 8;
  const left = Math.min(Math.max(8, anchor.left - 8), window.innerWidth - width - 8);
  return createPortal(
    <>
      <span className="fixed inset-0 z-[9998]" onClick={onDismiss} />
      <div
        ref={ref}
        style={{ position: "fixed", top, left, width }}
        className={`animate-popover z-[9999] rounded-2xl ${shell} ${flip ? "animate-popover-up" : ""} ${
          padded ? "p-3" : "p-1.5"
        }`}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

/** 16×16 stroked glyphs for the menu rows — sized and coloured by the row. */
const ICONS = {
  view: "M9.5 2.5h4v4M13.5 2.5 8 8M12 9.5V12A1.5 1.5 0 0 1 10.5 13.5H4A1.5 1.5 0 0 1 2.5 12V5.5A1.5 1.5 0 0 1 4 4h2.5",
  split:
    "M10.5 13.5v-1a2.5 2.5 0 0 0-2.5-2.5H5a2.5 2.5 0 0 0-2.5 2.5v1M6.5 7.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM13.5 13.5v-1a2.5 2.5 0 0 0-1.9-2.4M10.2 3.15a2.25 2.25 0 0 1 0 4.2",
  edit: "M11.1 2.9a1.55 1.55 0 0 1 2.2 2.2L5.6 12.8l-3 .8.8-3 7.7-7.7Z",
  unlink:
    "M6.8 9.2 5.2 10.8a2.55 2.55 0 0 1-3.6-3.6l1.6-1.6M9.2 6.8l1.6-1.6a2.55 2.55 0 0 1 3.6 3.6l-1.6 1.6M6.6 2.2v1.5M2.2 6.6h1.5M9.4 13.8v-1.5M13.8 9.4h-1.5",
} as const;

const MenuIcon = ({ d }: { d: keyof typeof ICONS }) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-3.5 w-3.5 shrink-0 max-md:h-4 max-md:w-4"
  >
    <path d={ICONS[d]} />
  </svg>
);

/**
 * One action in the link menu. Phones get comfortable ~44px tap targets via
 * `max-md:`, leaving the desktop menu's tighter rhythm untouched.
 */
function MenuRow({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: keyof typeof ICONS;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-colors max-md:gap-3 max-md:rounded-2xl max-md:px-3 max-md:py-3 max-md:text-sm ${
        danger
          ? "text-red-600 hover:bg-red-50 active:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40 dark:active:bg-red-950/60"
          : "text-gray-700 hover:bg-gray-100 active:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/70 dark:active:bg-gray-700/70"
      }`}
    >
      <span
        className={
          danger
            ? "text-red-400 group-hover:text-red-500"
            : "text-gray-400 transition-colors group-hover:text-gray-600 dark:group-hover:text-gray-300"
        }
      >
        <MenuIcon d={icon} />
      </span>
      {label}
    </button>
  );
}

/**
 * Asks for a single figure, pre-filled with the sensible default so the common
 * case is one Enter. Enter or clicking away commits; Escape leaves it unchanged.
 */
function AmountPrompt({
  anchor,
  title,
  footnote,
  initial,
  onConfirm,
  onCancel,
}: {
  anchor: DOMRect;
  title: string;
  footnote: string;
  initial: number;
  onConfirm: (n: number) => void;
  onCancel: () => void;
}) {
  const [raw, setRaw] = useState(String(Math.round(initial)));
  const commit = () => onConfirm(parseFloat(raw.replace(/[^0-9.-]/g, "")) || 0);

  return (
    <Popover anchor={anchor} width={176} onDismiss={commit}>
      <p className="mb-2 truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400 max-md:text-xs">
        {title}
      </p>
      <input
        autoFocus
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onCancel();
        }}
        className="w-full rounded-xl bg-gray-100/70 px-3 py-2 text-center text-sm font-semibold tabular-nums ring-1 ring-transparent transition focus:bg-transparent focus:outline-none focus:ring-indigo-400 dark:bg-gray-900/50 max-md:rounded-2xl max-md:py-3 max-md:text-base"
      />
      <p className="mt-2 text-[10px] text-gray-400 max-md:mb-1 max-md:text-xs">{footnote}</p>
    </Popover>
  );
}

/** What you can do with a matched transaction: inspect it, or reject the match. */
function LinkMenu({
  anchor,
  match,
  canSplit,
  onView,
  onSplit,
  onAllocate,
  onUnlink,
  onClose,
}: {
  anchor: DOMRect;
  match: RentMatch;
  /** Splitting is offered for shared bills only — see SPLITTABLE. */
  canSplit: boolean;
  onView: () => void;
  onSplit: () => void;
  onAllocate: () => void;
  onUnlink: () => void;
  onClose: () => void;
}) {
  const rule = "my-1 h-px bg-gray-100 dark:bg-gray-700/60";
  return (
    <Popover anchor={anchor} width={244} padded={false} onDismiss={onClose}>
      <div className="flex items-center gap-2.5 px-2.5 pb-1 pt-2 max-md:gap-3 max-md:px-3 max-md:pb-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 max-md:h-9 max-md:w-9 max-md:rounded-xl">
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 max-md:h-4 max-md:w-4">
            <path d="M7.78 3.16a2.75 2.75 0 0 1 3.89 3.89l-1.6 1.6a.75.75 0 0 1-1.06-1.06l1.6-1.6a1.25 1.25 0 0 0-1.77-1.77l-1.6 1.6A.75.75 0 1 1 6.18 4.76l1.6-1.6Zm.5 4.02a.75.75 0 0 1 0 1.06l-1.6 1.6a1.25 1.25 0 0 0 1.77 1.77l1.6-1.6a.75.75 0 1 1 1.06 1.06l-1.6 1.6a2.75 2.75 0 0 1-3.89-3.89l1.6-1.6a.75.75 0 0 1 1.06 0Z" />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-tight tabular-nums text-gray-800 dark:text-gray-100 max-md:text-base">
            {gbp0(match.amount)}
          </span>
          <span
            className="block truncate text-[10px] leading-tight text-gray-400 max-md:text-xs"
            title={match.description}
          >
            {matchDay(match.date)} · {match.description}
          </span>
        </span>
      </div>
      <div className={rule} />
      <MenuRow icon="view" label="View in transactions" onClick={onView} />
      {canSplit && <MenuRow icon="split" label="Split with someone…" onClick={onSplit} />}
      <MenuRow icon="edit" label="Edit allocation…" onClick={onAllocate} />
      <div className={rule} />
      <MenuRow icon="unlink" label="Unlink this month" danger onClick={onUnlink} />
    </Popover>
  );
}

/** The active popover — at most one at a time. */
type Pop =
  | { kind: "paid"; month: string; key: string; label: string; allocated: number; anchor: DOMRect }
  | { kind: "split"; month: string; key: string; label: string; bill: number; current: number; anchor: DOMRect }
  | { kind: "alloc"; month: string; key: string; label: string; current: number; paidLabel: string; anchor: DOMRect }
  | { kind: "link"; month: string; key: string; match: RentMatch; anchor: DOMRect };

interface Props {
  data: RentData;
  months: string[]; // months in the selected year, ascending
  onOpenMatch?: (match: RentMatch) => void;
}

export default function RentTable({ data, months, onOpenMatch }: Props) {
  const save = useSaveRentMonth();
  const items = data.items;

  const get = (month: string): RentMonthEntry => data.months[month] ?? {};
  const cell = (month: string, key: string): RentLineItem => rentCell(data, month, key);

  // A settled pot with nothing left in it stops appearing for later months — the
  // months it actually funded keep showing it, so history reads unchanged.
  const settledAt = new Map(
    potViews(data, months[months.length - 1] ?? currentMonth)
      .filter((p) => p.lastSettled)
      .map((p) => [p.key, p.lastSettled as string]),
  );
  const isRetired = (month: string, key: string) => {
    const settled = settledAt.get(key);
    return settled != null && month > settled && (get(month)[key]?.amount ?? 0) === 0;
  };
  // A column can only be dropped when it is retired for every month on screen.
  const visibleItems = items.filter((it) => months.some((m) => !isRetired(m, it.key)));

  const match = (month: string, key: string) => rentMatch(data, month, key);
  /** A match this month has rejected — kept so it can be put back. */
  const dropped = (month: string, key: string) => data.unlinked_matches?.[month]?.[key];
  // What the bank moved, vs what it actually cost you once someone else's share
  // is netted off. The table reports the latter throughout.
  const bill = (month: string, key: string) => rentBill(data, month, key);
  const share = (month: string, key: string) => rentShare(data, month, key);
  const contribution = (month: string, key: string) => rentContribution(data, month, key);
  const isPaid = (month: string, key: string) => rentIsPaid(data, month, key);
  // Ticked by hand with no matching transaction — here the cell's number is what
  // was paid, so edits land on `paid_amount` rather than the allocation.
  const isManualPaid = (month: string, key: string) =>
    cell(month, key).paid && !match(month, key);
  // Reminds you what the icon is hiding: the allocation, and anyone else's share.
  const paidHint = (month: string, key: string) => {
    const c = cell(month, key);
    const covered = contribution(month, key);
    const parts: string[] = [];
    if (c.paid_amount != null) parts.push(`${gbp0(c.paid_amount)} of ${gbp0(c.amount)} allocated`);
    else if (match(month, key)) parts.push(gbp0(bill(month, key)));
    if (covered > 0) parts.push(`${gbp0(covered)} covered by someone else`);
    return parts.length ? ` ${parts.join(", ")}` : "";
  };

  const update = (month: string, key: string, patch: Partial<RentLineItem>) => {
    const entry: RentMonthEntry = {};
    for (const it of items) {
      const existing = cell(month, it.key);
      entry[it.key] = it.key === key ? { ...existing, ...patch } : { ...existing };
    }
    save.mutate({ month, entry });
  };

  // Equal-to-allocated is stored as null so the paid figure keeps tracking
  // `amount` if the allocation is edited later.
  const savePaidAmount = (month: string, key: string, n: number) =>
    update(month, key, { paid_amount: n === cell(month, key).amount ? null : n });

  // Someone else's share can't exceed the bill, and "nothing" is null rather
  // than 0 so an unsplit cell keeps tracking the bill on its own.
  const saveContribution = (month: string, key: string, n: number) => {
    const capped = Math.min(Math.max(0, Math.round(n)), Math.round(bill(month, key)));
    update(month, key, { contribution: capped > 0 ? capped : null });
  };

  /**
   * The cell shows your share, so a typed figure is read as your share too.
   *
   * On a shared bill with a matched transaction the total is already fixed by
   * the bank, so the only thing an edit can mean is how much of it someone else
   * covered — which is what makes "rent is £1,900 but £1,700 of it is mine"
   * expressible without moving the allocation away from what Diff in bills
   * reconciles against. Matched cells that can't be split are read-only, so
   * they never reach this at all; their allocation is edited from the menu.
   */
  const commitAmount = (month: string, key: string, typed: number) => {
    const m = match(month, key);
    if (m) return saveContribution(month, key, m.amount - typed);
    const full = typed + contribution(month, key);
    if (isManualPaid(month, key)) return savePaidAmount(month, key, full);
    update(month, key, { amount: full });
  };

  // Editable in place unless the bank already fixed the figure and there's no
  // share to carve out of it.
  const canSplit = (key: string) => SPLITTABLE.has(key);
  const isLocked = (month: string, key: string) => !!match(month, key) && !canSplit(key);

  const [pop, setPop] = useState<Pop | null>(null);

  // Ticking asks what actually left the account; unticking drops that figure so
  // it can't linger as a stale diff. A matched row opens the link menu instead.
  const onToggle = (month: string, it: RentItemDef, anchor: DOMRect) => {
    const m = match(month, it.key);
    if (m) return setPop({ kind: "link", month, key: it.key, match: m, anchor });
    const c = cell(month, it.key);
    if (c.paid) return update(month, it.key, { paid: false, paid_amount: null });
    setPop({ kind: "paid", month, key: it.key, label: it.label, allocated: c.amount, anchor });
  };

  const openSplit = (month: string, it: RentItemDef, anchor: DOMRect) =>
    setPop({
      kind: "split",
      month,
      key: it.key,
      label: it.label,
      bill: bill(month, it.key),
      current: contribution(month, it.key),
      anchor,
    });

  const openAlloc = (month: string, key: string, anchor: DOMRect) =>
    setPop({
      kind: "alloc",
      month,
      key,
      label: items.find((i) => i.key === key)?.label ?? key,
      current: cell(month, key).amount,
      paidLabel: gbp0(bill(month, key)),
      anchor,
    });

  const confirmPop = (n: number) => {
    if (!pop) return;
    if (pop.kind === "paid") {
      update(pop.month, pop.key, {
        paid: true,
        paid_amount: n === pop.allocated ? null : n,
      });
    } else if (pop.kind === "split") {
      saveContribution(pop.month, pop.key, n);
    } else if (pop.kind === "alloc") {
      update(pop.month, pop.key, { amount: n });
    }
    setPop(null);
  };

  const monthTotal = (month: string) => items.reduce((s, it) => s + share(month, it.key), 0);
  const monthPaid = (month: string) =>
    items.reduce((s, it) => s + (isPaid(month, it.key) ? share(month, it.key) : 0), 0);

  // Items in reading order, with anything unrecognised kept at the end.
  const rank = (key: string) => {
    const i = CARD_ORDER.indexOf(key);
    return i === -1 ? CARD_ORDER.length : i;
  };
  const orderedItems = [...items].sort((a, b) => rank(a.key) - rank(b.key));

  /**
   * Split a month's live items across the card's two columns. Balancing by
   * count keeps the columns even however many items a month actually has, so a
   * retired pot doesn't leave one side short.
   */
  const cardColumns = (month: string) => {
    const visible = orderedItems.filter((it) => !isRetired(month, it.key));
    const split = Math.ceil(visible.length / 2);
    return [visible.slice(0, split), visible.slice(split)];
  };

  /**
   * The line under a desktop amount: an offer to put back a rejected match
   * (any item — a wrong match can happen to any bill), the full bill when
   * someone else covers part of it, else a hover-only handle to split. The slot
   * is always reserved so rows don't jump.
   */
  const splitNote = (month: string, it: RentItemDef) => {
    const drop = dropped(month, it.key);
    if (drop) {
      return (
        <button
          type="button"
          onClick={() => update(month, it.key, { unlinked: false })}
          title={`Unlinked from ${gbp0(drop.amount)} on ${drop.date} (${drop.description}) — click to relink`}
          className="text-[10px] leading-none text-sky-500 hover:underline"
        >
          relink
        </button>
      );
    }
    if (!canSplit(it.key)) return null;
    const covered = contribution(month, it.key);
    return (
      <button
        type="button"
        onClick={(e) => openSplit(month, it, e.currentTarget.getBoundingClientRect())}
        title={
          covered > 0
            ? `${gbp0(covered)} of ${gbp0(bill(month, it.key))} covered by someone else — click to edit`
            : "Part of this bill covered by someone else? Click to split"
        }
        className={
          covered > 0
            ? "text-[10px] leading-none text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            : "text-[10px] leading-none text-gray-300 opacity-0 transition-opacity hover:text-gray-500 group-hover:opacity-100 dark:text-gray-600"
        }
      >
        {covered > 0 ? `of ${gbp0(bill(month, it.key))}` : "split"}
      </button>
    );
  };

  // One category row in a mobile card: paid/linked toggle on the left, then the
  // label (tap to split), then the amount aligned right.
  const renderRow = (month: string, it: RentItemDef) => {
    if (isRetired(month, it.key)) return null;
    const c = cell(month, it.key);
    const covered = contribution(month, it.key);
    const drop = dropped(month, it.key);
    return (
      <div key={it.key} className="flex items-center gap-1.5">
        <PaidToggle
          paid={c.paid}
          auto={!!match(month, it.key)}
          hint={paidHint(month, it.key)}
          onToggle={(anchor) => onToggle(month, it, anchor)}
        />
        {/* Tapping the label relinks a rejected match, or splits a shared bill;
            with neither on offer it's plain text, not a dead tap target. */}
        {drop || canSplit(it.key) ? (
          <button
            type="button"
            onClick={(e) =>
              drop
                ? update(month, it.key, { unlinked: false })
                : openSplit(month, it, e.currentTarget.getBoundingClientRect())
            }
            className={`min-w-0 flex-1 truncate text-left ${it.saved ? "text-amber-600 dark:text-amber-400" : "text-gray-400"}`}
          >
            {it.label}
            {drop ? (
              <span className="ml-1 text-[9px] text-sky-500">relink</span>
            ) : covered > 0 ? (
              <span className="ml-1 text-[9px] text-gray-400">of {gbp0(bill(month, it.key))}</span>
            ) : null}
          </button>
        ) : (
          <span className={`min-w-0 flex-1 truncate ${it.saved ? "text-amber-600 dark:text-amber-400" : "text-gray-400"}`}>
            {it.label}
          </span>
        )}
        <MoneyInput
          value={share(month, it.key)}
          onCommit={(n) => commitAmount(month, it.key, n)}
          readOnly={isLocked(month, it.key)}
          color={it.saved ? "#d97706" : undefined}
          className="!w-14 !px-1 !text-right"
        />
      </div>
    );
  };

  return (
    <Card className="p-0 overflow-hidden max-md:!p-0">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-6 sm:py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Rent &amp; Utilities (Wyndham)
        </h2>
        <div className="hidden items-center gap-3 text-xs text-gray-400 sm:flex">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> set aside to savings
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> paid
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> auto-paid
          </span>
        </div>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Month</th>
              {visibleItems.map((it: RentItemDef) => (
                <th key={it.key} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                  <span className={it.saved ? "text-amber-600 dark:text-amber-400" : "text-gray-600 dark:text-white"}>
                    {it.label}
                  </span>
                </th>
              ))}
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {months.map((month) => {
              const isFuture = month > currentMonth;
              const isCurrent = month === currentMonth;
              const total = monthTotal(month);
              const paid = monthPaid(month);
              const fullyPaid = total > 0 && paid >= total - 0.001;
              return (
                <tr
                  key={month}
                  className={`group hover:bg-gray-50 dark:hover:bg-gray-800/40 ${isFuture ? "opacity-50" : ""} ${
                    isCurrent ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""
                  }`}
                >
                  <td className="px-6 py-2.5 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {mo(month)}
                  </td>
                  {visibleItems.map((it) => {
                    const c = cell(month, it.key);
                    // Keep the column aligned, but leave the cell blank for
                    // months after this pot was settled.
                    if (isRetired(month, it.key)) {
                      return (
                        <td key={it.key} className="px-3 py-2.5 text-center text-gray-300 dark:text-gray-700">
                          —
                        </td>
                      );
                    }
                    return (
                      <td key={it.key} className="px-3 py-2.5">
                        <div className="flex flex-col items-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <MoneyInput
                              value={share(month, it.key)}
                              onCommit={(n) => commitAmount(month, it.key, n)}
                              readOnly={isLocked(month, it.key)}
                              color={it.saved ? "#d97706" : undefined}
                            />
                            <PaidToggle
                              paid={c.paid}
                              auto={!!match(month, it.key)}
                              hint={paidHint(month, it.key)}
                              onToggle={(anchor) => onToggle(month, it, anchor)}
                            />
                          </div>
                          <div className="flex h-3.5 items-center">{splitNote(month, it)}</div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-6 py-2.5 text-center whitespace-nowrap">
                    <div className="font-bold tabular-nums text-gray-800 dark:text-gray-100">{gbp0(total)}</div>
                    <div className={`text-[11px] font-medium ${fullyPaid ? "text-emerald-500" : "text-gray-400"}`}>
                      {fullyPaid ? "paid" : `${gbp0(total - paid)} left`}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-gray-50 dark:divide-gray-800/60 md:hidden">
        {months.map((month) => {
          const isFuture = month > currentMonth;
          const isCurrent = month === currentMonth;
          const total = monthTotal(month);
          const paid = monthPaid(month);
          const fullyPaid = total > 0 && paid >= total - 0.001;
          return (
            <li
              key={month}
              className={`px-4 py-3 ${isFuture ? "opacity-50" : ""} ${isCurrent ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{mo(month)}</span>
                <span className="flex items-baseline gap-2 pr-1">
                  <span className={`text-[11px] font-medium ${fullyPaid ? "text-emerald-500" : "text-gray-400"}`}>
                    {fullyPaid ? "paid" : `${gbp0(total - paid)} left`}
                  </span>
                  <span className="font-bold tabular-nums text-gray-800 dark:text-gray-100">{gbp0(total)}</span>
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {cardColumns(month).map((column, i) => (
                  <div key={i} className="space-y-1">
                    {column.map((it) => renderRow(month, it))}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      {pop?.kind === "paid" && (
        <AmountPrompt
          anchor={pop.anchor}
          title={`${pop.label} — paid`}
          footnote={`Allocated ${gbp0(pop.allocated)}`}
          initial={pop.allocated}
          onConfirm={confirmPop}
          onCancel={() => setPop(null)}
        />
      )}
      {pop?.kind === "split" && (
        <AmountPrompt
          anchor={pop.anchor}
          title={`${pop.label} — covered by others`}
          footnote={`Bill ${gbp0(pop.bill)} · yours ${gbp0(pop.bill - pop.current)}`}
          initial={pop.current}
          onConfirm={confirmPop}
          onCancel={() => setPop(null)}
        />
      )}
      {pop?.kind === "alloc" && (
        <AmountPrompt
          anchor={pop.anchor}
          title={`${pop.label} — allocated`}
          footnote={`Paid ${pop.paidLabel}`}
          initial={pop.current}
          onConfirm={confirmPop}
          onCancel={() => setPop(null)}
        />
      )}
      {pop?.kind === "link" && (
        <LinkMenu
          anchor={pop.anchor}
          match={pop.match}
          canSplit={canSplit(pop.key)}
          onView={() => {
            onOpenMatch?.(pop.match);
            setPop(null);
          }}
          onSplit={() =>
            setPop({
              kind: "split",
              month: pop.month,
              key: pop.key,
              label: items.find((i) => i.key === pop.key)?.label ?? pop.key,
              bill: bill(pop.month, pop.key),
              current: contribution(pop.month, pop.key),
              anchor: pop.anchor,
            })
          }
          onAllocate={() => openAlloc(pop.month, pop.key, pop.anchor)}
          onUnlink={() => {
            update(pop.month, pop.key, { unlinked: true });
            setPop(null);
          }}
          onClose={() => setPop(null)}
        />
      )}
    </Card>
  );
}
