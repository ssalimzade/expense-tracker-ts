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
  `divide-y`). Card row = name/label + primary value justified on top row, then
  secondary fields (label→value) below, all justified to the card edges at `px-4`.
  Prefer this over horizontal scrolling for any table with >3 meaningful columns.
- **Stat-card grids:** responsive columns (never a fixed wide `grid-cols-N` on
  mobile — e.g. balances `grid-cols-3 … lg:grid-cols-7`, full-width total via
  `col-span-3 sm:col-span-1`) and reduced `py` (`py-2 sm:py-4`) so cards aren't
  too tall.
- **Charts on mobile** (via `useIsMobile`): drop the legend, use fewer X-axis
  date ticks and fewer Y-axis ticks. Desktop keeps the full chart.
- **Hide desktop-only actions on phones** with `hidden sm:flex` (e.g. Export CSV).
