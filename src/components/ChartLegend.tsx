/**
 * A quiet legend for chart card headers: coloured marks, grey labels. Used in
 * place of Recharts' <Legend>, whose labels take the series colour and wrap
 * awkwardly on phones.
 */
export default function ChartLegend({
  items,
  className = "",
}: {
  items: { label: string; color: string; dashed?: boolean }[];
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400 ${className}`}>
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 whitespace-nowrap">
          {it.dashed ? (
            <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: it.color }} />
          ) : (
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}
