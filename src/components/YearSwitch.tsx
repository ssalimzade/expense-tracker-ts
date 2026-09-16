/** The segmented year picker used across the year-based tabs. */
export default function YearSwitch({
  years,
  year,
  onChange,
}: {
  years: string[];
  year: string;
  onChange: (y: string) => void;
}) {
  return (
    <div className="flex w-fit gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800/70">
      {years.map((y) => (
        <button
          key={y}
          onClick={() => onChange(y)}
          className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${
            y === year
              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          {y}
        </button>
      ))}
    </div>
  );
}
