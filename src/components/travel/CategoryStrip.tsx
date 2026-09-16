import { CATEGORY_COLORS, type TripSummary } from "../../lib/travel";

/** Where the money went: one segmented bar, with a legend underneath. */
export default function CategoryStrip({ summary, money }: { summary: TripSummary; money: (gbp: number) => string }) {
  const { byCategory, total } = summary;
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Where it went</p>
      {byCategory.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">Nothing yet.</p>
      ) : (
        <>
          <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full">
            {byCategory.map((c) => (
              <span
                key={c.category}
                title={`${c.category} ${money(c.total)}`}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(c.total / total) * 100}%`, backgroundColor: CATEGORY_COLORS[c.category] }}
              />
            ))}
          </div>
          <ul className="mt-4 space-y-2">
            {byCategory.map((c) => (
              <li key={c.category} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.category] }} />
                <span className="flex-1 truncate text-gray-600 dark:text-gray-300">{c.category}</span>
                <span className="font-semibold tabular-nums">{money(c.total)}</span>
                <span className="w-9 text-right text-xs tabular-nums text-gray-400">{Math.round((c.total / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
