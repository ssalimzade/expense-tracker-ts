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

## Travel tab (deliberate exception)

The Travel tab intentionally does **not** follow the stat-card / table layout
above, so it doesn't feel like every other tab:

- The trip is a gradient **boarding-pass ticket** (`TripTicket`): details on the
  left, spend + budget ring on a perforated stub (stub drops below on phones).
- Expenses are a **day-by-day itinerary timeline** (`Itinerary`) grouped into
  Before you go / Day N / After, not a table — same on desktop and mobile.
- Category split is one **segmented bar** with a legend (`CategoryStrip`).
- Surfaces use `rounded-2xl`/`rounded-3xl` with `ring-1` instead of `Card`.

## Hero-style tabs (every tab)

All tabs now share this look, and each one gets its own palette so they don't
blur into each other. The hero replaces the old "Summary stat cards" row above.
The table rules still apply inside the tables.

- **Shared pieces:** `components/Hero.tsx` (`Hero`, `HeroField`, `HeroChip`,
  `HeroProgress`), `components/YearSwitch.tsx`, and `Card` in `common.tsx`,
  which already carries the `rounded-3xl ring-1` surface.
- **Budget ⇄ History mirror:** both breakdown tables keep a plain header row
  (small uppercase label, `border-b`), with no coloured band.

- **Page width:** content sits in `mx-auto max-w-7xl` (Travel uses `max-w-6xl`).
- **Hero:** one `rounded-3xl` gradient header with a faint decorative SVG behind
  the text, instead of rows of tinted stat cards. Inside it: a pill label, then
  the key figure (`text-4xl sm:text-5xl font-extrabold`), then small
  uppercase-label fields in `text-white/60`. Palettes: Travel sky→violet,
  Salary emerald→cyan, Savings moss green, Planner dusty slate blue, Budget
  indigo→sky, History slate→indigo, Projections violet→indigo, Rent sky→teal,
  Repayments warm stone. Avoid red, orange and pink as theme colours; the user
  prefers natural, muted tones that suit the dark design. Red is only for
  meaning (negative, over budget, delete).
- **Corner icon:** every hero carries one large faint line icon from
  `components/HeroArt.tsx` (wallet, clock, trend, house, card, banknotes, coins,
  calendar, plane), all drawn with the same stroke so they read as a set. Notes and Transactions have no hero; they are
  working lists, so they use a large page title instead.
- **Surfaces:** `rounded-3xl bg-white ring-1 ring-gray-100
  dark:bg-gray-900 dark:ring-gray-800`, used instead of `Card`. Section labels
  are `text-xs font-bold uppercase tracking-[0.14em] text-gray-400`. Section
  titles above a list are `text-lg font-extrabold tracking-tight` with a muted
  one-line subtitle.
- **Switches:** segmented controls use `rounded-2xl bg-gray-100 p-1` with a
  white active pill. Picker strips (trips, months) are horizontally scrolling
  `rounded-2xl` tiles; the active tile is filled `bg-gray-900` (white in dark
  mode).
- **Primary buttons:** `rounded-2xl bg-gray-900 text-white` (inverted in dark
  mode). An action sitting on a hero is a white button.
- **Lists over tables:** history reads as a timeline (Travel itinerary, Salary
  history), months as a ledger (Savings), categories as bar rows (Planner).
- **Layout:** main column plus a sticky `lg:` sidebar of `22rem`. On phones the
  sidebar comes after the main content, unless it holds the page's main
  actions.

## Phone sections (every tab with more than one block)

Below `lg`, a tab shows its hero and then one section at a time, picked with
`PhoneSectionTabs` (same look as Travel's Journal / Plan / Summary). Use
`usePhoneSection("<tab>-section", SECTIONS)` and put `section.show("<value>")`
on each block. It only adds `max-lg:hidden`, so wide screens are unchanged and
hidden components stay mounted (their effects and saves keep working). Phone
month lists (Projections, Rent) open at the current month with a "Show N
earlier months" button.

## Chart style

- Colours come from `CHART` in `lib/chart.ts`: muted moss, slate, dusk, lavender,
  sand, stone and teal. No red, orange or pink, except `CHART.bad` for bad news.
  "Not yet / still to come" uses `CHART.mist` or a lower `fillOpacity`.
- Use `axisTick` and `gridStroke`. Put a `ChartLegend` (grey labels, coloured
  dots) under the card title instead of Recharts' `<Legend>`.
- One scale per chart. When one value would flatten the rest (rent next to
  bills, a bonus month), leave it out or cap the axis and name it in the header.
- Don't chart what a table next to it already shows. Prefer a view the table
  can't give (over/under, left after costs, due dates).
