# Graph Report - .  (2026-07-24)

## Corpus Check
- Corpus is ~42,615 words - fits in a single context window. You may not need a graph.

## Summary
- 670 nodes · 1624 edges · 32 communities (27 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.76)
- Token cost: 59,298 input · 0 output

## Community Hubs (Navigation)
- Worker & Data Access Layer
- Budget, Planner & Archive
- Repayments Feature
- Remuneration, Rent & Tax
- Transactions UI
- Shared Charting Components
- Projections & Savings
- Balance & Bank Sync
- Notes Feature
- Worksheet (Fortune-Sheet)
- TypeScript Config
- Dev Dependencies
- Runtime Dependencies
- Toast & App Entry
- Architecture Overview (README)
- Styling Guidelines
- Vite/Node TS Config
- Top Navbar
- NPM Scripts
- Package Metadata
- Sidebar Navigation
- App Favicon
- React Query Dependency
- React Table Dependency
- Datepicker Types Dependency
- Tailwind CSS Dependency
- Dark Mode Bootstrap

## God Nodes (most connected - your core abstractions)
1. `gbp0()` - 31 edges
2. `kvSet()` - 22 edges
3. `Card()` - 22 edges
4. `useIsMobile()` - 20 edges
5. `gbp()` - 20 edges
6. `tooltipStyle()` - 18 edges
7. `cursorStyle()` - 18 edges
8. `compilerOptions` - 16 edges
9. `api` - 15 edges
10. `Sql` - 14 edges

## Surprising Connections (you probably didn't know these)
- `React root mount (#root + /src/main.tsx)` --references--> `React SPA frontend (Vite, src/)`  [INFERRED]
  index.html → README.md
- `Mobile / responsive conventions` --references--> `Viewport meta (no input-focus zoom)`  [INFERRED]
  STYLING_GUIDELINES.md → index.html
- `sqlOf()` --calls--> `getSql()`  [EXTRACTED]
  worker/index.ts → lib/db.ts
- `useAllPlanner()` --indirect_call--> `fetchAllPlanner()`  [INFERRED]
  src/hooks/usePlanner.ts → src/api/planner.ts
- `BudgetSummaryTable()` --calls--> `gbp()`  [EXTRACTED]
  src/components/dashboard/BudgetSummaryTable.tsx → src/lib/format.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Cloudflare Pages architecture stack (SPA + Hono API + Neon + Access)** — readme_cloudflare_pages_functions, readme_react_spa, readme_hono_api, readme_neon_postgres, readme_cloudflare_access [EXTRACTED 0.90]
- **Shared UI building blocks toolkit** — styling_guidelines_shared_building_blocks, styling_guidelines_lib_format, styling_guidelines_lib_chart, styling_guidelines_useismobile [INFERRED 0.80]
- **Mobile responsive adaptation strategy** — styling_guidelines_mobile_responsive, styling_guidelines_stacked_cards, styling_guidelines_useismobile, index_viewport_meta [INFERRED 0.80]

## Communities (32 total, 5 thin omitted)

### Community 0 - "Worker & Data Access Layer"
Cohesion: 0.06
Nodes (82): categorizeOne(), categorizeRow(), normalizeText(), rentSubcategoryKeywords, Rules, subCategoryKeywords, subcategoryToCategory, addDeletedRepayment() (+74 more)

### Community 1 - "Budget, Planner & Archive"
Cohesion: 0.06
Nodes (55): fetchArchive(), fetchArchiveMonths(), saveArchive(), fetchAllBudgets(), fetchBudget(), fetchCategoryRules(), saveBudget(), saveCategoryRule() (+47 more)

### Community 2 - "Repayments Feature"
Cohesion: 0.07
Nodes (61): addRepaymentCategory(), deleteRepayment(), deleteSyntheticRepayments(), fetchRepaymentCategories(), fetchRepayments(), fetchSyntheticRepayments(), restoreRepayment(), saveRepayment() (+53 more)

### Community 3 - "Remuneration, Rent & Tax"
Cohesion: 0.08
Nodes (40): fetchRemuneration(), saveRemunerationRow(), fetchRent(), saveRentMonth(), Props, RemunerationTab(), computeAuto(), currentYear (+32 more)

### Community 4 - "Transactions UI"
Cohesion: 0.07
Nodes (34): deleteTransactionFlag(), fetchTransactions(), setTransactionFlag(), Props, Coords, Props, SelectOption, Props (+26 more)

### Community 5 - "Shared Charting Components"
Cohesion: 0.15
Nodes (29): recomputeArchive(), Card(), QueryState(), CumulativeSpendChart(), HistoryTab(), AllocationChart(), mo(), SalaryVsCostChart() (+21 more)

### Community 6 - "Projections & Savings"
Cohesion: 0.10
Nodes (33): fetchProjections(), saveProjectionRow(), fetchSavings(), saveSavingsRow(), currentMonth, monthsOfYear(), ProjectionsTab(), ALLOC_COLS (+25 more)

### Community 7 - "Balance & Bank Sync"
Cohesion: 0.09
Nodes (29): AccountBalances, BalanceData, BalanceValues, fetchAccountBalances(), fetchBalance(), saveBalance(), api, fetchHidden() (+21 more)

### Community 8 - "Notes Feature"
Cohesion: 0.15
Nodes (18): deleteNote(), fetchNotes(), saveNote(), NoteCard(), Props, COLOR_KEYS, NOTE_COLORS, Props (+10 more)

### Community 9 - "Worksheet (Fortune-Sheet)"
Cohesion: 0.18
Nodes (18): fetchWorksheet(), saveWorksheet(), contentSig(), FortuneWorksheet(), hasContent(), VOLATILE_KEYS, blankSheet(), isFortuneSheets() (+10 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.09
Nodes (22): DOM, DOM.Iterable, ES2020, src, compilerOptions, allowImportingTsExtensions, isolatedModules, jsx (+14 more)

### Community 11 - "Dev Dependencies"
Cohesion: 0.11
Nodes (19): autoprefixer, @cloudflare/workers-types, devDependencies, autoprefixer, @cloudflare/workers-types, postcss, @types/react, @types/react-dom (+11 more)

### Community 12 - "Runtime Dependencies"
Cohesion: 0.12
Nodes (17): @fortune-sheet/core, @fortune-sheet/react, hono, @neondatabase/serverless, dependencies, @fortune-sheet/core, @fortune-sheet/react, hono (+9 more)

### Community 13 - "Toast & App Entry"
Cohesion: 0.19
Nodes (12): getSnapshot(), listeners, push(), remove(), subscribe(), Toast, Toaster(), toasts (+4 more)

### Community 14 - "Architecture Overview (README)"
Cohesion: 0.18
Nodes (13): index.html SPA entry point, React root mount (#root + /src/main.tsx), app_config config table, Cloudflare Access (site gate), Cloudflare Pages Functions (Hono backend), expense-tracker-ts (personal finance dashboard), functions/api/[[route]].ts Hono API app, lib/db.ts Neon serverless client (+5 more)

### Community 15 - "Styling Guidelines"
Cohesion: 0.23
Nodes (13): Viewport meta (no input-focus zoom), Budget table ⇄ History table mirror, Charts convention, CumulativeSpendChart component, lib/chart.ts (axis/tooltip styling), lib/format.ts (gbp, gbp0, date helpers), Mobile / responsive conventions, Shared building blocks (common.tsx, MoneyInput, Tooltip) (+5 more)

### Community 16 - "Vite/Node TS Config"
Cohesion: 0.20
Nodes (9): vite.config.ts, compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict (+1 more)

### Community 17 - "Top Navbar"
Cohesion: 0.29
Nodes (7): ICONS, NavBar(), Props, TabGroup, TabKey, TABS, recentMonths()

### Community 18 - "NPM Scripts"
Cohesion: 0.33
Nodes (6): scripts, build, deploy, dev, preview, wdev

### Community 19 - "Package Metadata"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 20 - "Sidebar Navigation"
Cohesion: 0.40
Nodes (3): Props, TabKey, TABS

### Community 21 - "App Favicon"
Cohesion: 1.00
Nodes (3): Expense Tracker App Identity, App Favicon (Indigo £ Tile), Pound Sterling Currency Branding

## Knowledge Gaps
- **153 isolated node(s):** `subCategoryKeywords`, `rentSubcategoryKeywords`, `Dict`, `RENT_DEFAULT_ITEMS`, `BALANCE_KEYS` (+148 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gbp0()` connect `Remuneration, Rent & Tax` to `Budget, Planner & Archive`, `Repayments Feature`, `Shared Charting Components`, `Projections & Savings`, `Balance & Bank Sync`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `useIsMobile()` connect `Shared Charting Components` to `Worksheet (Fortune-Sheet)`, `Repayments Feature`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `api` connect `Balance & Bank Sync` to `Budget, Planner & Archive`, `Repayments Feature`, `Remuneration, Rent & Tax`, `Transactions UI`, `Projections & Savings`, `Notes Feature`, `Worksheet (Fortune-Sheet)`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `subCategoryKeywords`, `rentSubcategoryKeywords`, `Dict` to the rest of the system?**
  _153 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Worker & Data Access Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.05852842809364549 - nodes in this community are weakly interconnected._
- **Should `Budget, Planner & Archive` be split into smaller, more focused modules?**
  _Cohesion score 0.06342342342342343 - nodes in this community are weakly interconnected._
- **Should `Repayments Feature` be split into smaller, more focused modules?**
  _Cohesion score 0.06963470319634703 - nodes in this community are weakly interconnected._