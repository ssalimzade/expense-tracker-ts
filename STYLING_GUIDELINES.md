# Styling Guidelines

Conventions for building tabs/components in this dashboard. **Consult this file
before building any new tab or visual component**, and keep it updated as new
conventions are agreed. It is a living document.

## Summary stat cards

- Card content is **center-aligned** (`text-center`). Applies to every summary
  stat card across all tabs (Dashboard metrics, Projections, Rent, Salary,
  History, Savings, …).
- Standard structure: small uppercase label, large bold value, optional muted
  sub-line.
- Use the rounded tinted card pattern: `rounded-2xl border px-5 py-4` with a
  colour-matched `bg-*` / `border-*` and a coloured value.

## Tables

- **Edge padding = `px-6`** on the title header, the **first** column, and the
  **last** column, so the table content lines up with the card title. Inner
  columns use a tighter `px-3` (or `px-4`).
- **Alignment:** every column and its values are **center-aligned**
  (`text-center`) **except** lengthy label columns — Description, Period, Month,
  Category, Notes — which stay **left-aligned** (`text-left`).
- **No decimals** on monetary values — always whole pounds (`gbp0` / `MoneyInput`).
- **Always show the `£` sign on monetary amounts in tables.**
- Reuse the shared inline editors: `MoneyInput` / `CurrencyInput` and `Tooltip`.
- **Budget table ⇄ History table mirror:** the Dashboard/Budget breakdown table
  and the History category-breakdown table must stay visually identical (desktop
  **and** mobile). Any change to one is applied to the other.

## Charts

- **Every line chart gets a gradient shade** under the line (see
  `CumulativeSpendChart`).
- **Actual vs future:** solid + shaded for year-to-date, dashed + unshaded for
  the future/projected part.
- Keep axis/tooltip styling consistent via `lib/chart.ts`.
- Always wrap recharts in `ResponsiveContainer width="100%"`.

## Shared building blocks

- `components/common.tsx` — `Card`, `SectionTitle`, `QueryState`.
- `components/MoneyInput.tsx` / `CurrencyInput.tsx` — inline editors.
- `components/Tooltip.tsx` — truncation-only hover tooltip.
- `lib/format.ts` — `gbp` (2dp), `gbp0` (no decimals), date helpers.
- `hooks/useIsMobile.ts` — `< 768px` matcher for JS-driven components (recharts).

## Mobile / responsive

Desktop-first with mobile overrides. **Mobile = below the `md` breakpoint
(768px)** — that's where the bottom nav shows. All mobile changes must leave the
desktop (`md:`+) layout exactly as-is.

- **Global scale:** `:root { font-size: 14px }` under `max-width: 767px`
  (`index.css`) shrinks all rem sizes together. Page padding is `p-3` on phones,
  `md:p-5` on desktop (`App.tsx`).
- **Navigation:** desktop = top tab bar (`hidden md:flex`); mobile = a fixed,
  horizontally-scrollable bottom bar (`md:hidden`, active tab auto-scrolls into
  view) plus a slim top strip carrying the brand + month picker. Main content
  reserves `pb-20` for the bottom bar.
- **Cards with a full-width header** (Budget, Planner, Savings, Rent, Salary,
  Projections, Repayments, …): make them edge-to-edge on phones with
  `Card className="p-0 overflow-hidden max-md:!p-0"`, and the header
  `px-4 py-3 sm:px-6 sm:py-4`, so content reaches the card edges.
- **Data tables → stacked cards on mobile.** Wrap the table in
  `hidden overflow-x-auto md:block` and add a `md:hidden` card list (`<ul>` with
  `divide-y`). Card row = name/label + primary value on the top row (the primary
  value is a right-aligned labelled stat block, e.g. Buffer / Ending / Total),
  then a `grid grid-cols-2` of `label → value` fields below.
  Prefer this over horizontal scrolling for any table with >3 meaningful columns.
- **Right-align the editable values** inside those 2-column field grids so numbers
  form clean columns. The shared inline inputs default to `text-center`/`w-20`, so
  override per-cell with important utilities: `className="!w-16 !px-1 !text-right"`
  (add a `className` passthrough to any local input that lacks one). Read-only
  derived cells get `inline-block w-16 text-right tabular-nums`.
- **Reference/label pairs** (e.g. Planner "Average £x / July £y"): use
  `grid grid-cols-2` with each cell `flex gap-1.5` (label then value, grouped left)
  — **not** `justify-between`, which flings the two apart. The fixed columns keep
  the second label aligned across every row.
- **Summary stat cards → one compact row on phones.** Put all cards in a single
  row (`grid-cols-N` matching the count) with tight padding (`px-1.5 py-2` →
  `sm:px-5 sm:py-4`), a smaller value (`text-sm sm:text-2xl`), a `short` responsive
  label (`<span className="sm:hidden">{short}</span>` + `hidden sm:inline` full
  label), and the sub-line hidden on mobile (`hidden … sm:block`). Preserve the
  desktop grid via `sm:grid-cols-2 lg:grid-cols-N`.
- **Charts on mobile** (via `useIsMobile`): **disable the `<Tooltip>`**
  (`{!isMobile && <Tooltip/>}`) — on touch it sticks open while scrolling; the
  tables below carry the numbers. Thin the X ticks with `interval={isMobile ? 2 : undefined}`
  (≈ every 3rd month), hide dense (5-6 item) legends, and give money Y-axes even
  whole-thousand `ticks` instead of ragged auto ticks. Desktop keeps the full chart.
- **Month-name axes:** format `YYYY-MM` X ticks as `MMM 'YY` (e.g. `Jun '26`) on
  both web and mobile; never show raw `2026-06`.
- **Hide desktop-only actions on phones** with `hidden sm:flex` (e.g. Export CSV).
- **No input-focus zoom:** the viewport meta carries `maximum-scale=1,
  user-scalable=no` so tapping an inline input doesn't zoom the page on iOS.
  (Viewport meta is ignored on desktop, so this is mobile-only.)
