import { useCallback, useEffect, useRef, useState } from "react";
import { Workbook, type WorkbookInstance } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import "./worksheet.css";
import type { Sheet } from "@fortune-sheet/core";
import { useWorksheet, useSaveWorksheet } from "../../hooks/useWorksheet";
import { isLegacyMatrix, toSheets } from "./worksheetMigration";

export default function FortuneWorksheet() {
  const wsQuery = useWorksheet();
  const save = useSaveWorksheet();

  // Fortune-sheet reads `data` once at mount and owns state thereafter, so seed
  // it a single time from the server and never feed the prop again.
  const [initial, setInitial] = useState<Sheet[] | null>(null);
  const wbRef = useRef<WorkbookInstance>(null);
  const needsRecalc = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (wsQuery.data && initial === null) {
      const raw = wsQuery.data.data;
      // Legacy formulas arrive as `{ f }` with no cached value, so they render
      // blank until the calc chain is rebuilt. Already-migrated sheets keep
      // their cached values and need no recompute.
      needsRecalc.current = isLegacyMatrix(raw);
      setInitial(toSheets(raw));
    }
  }, [wsQuery.data, initial]);

  // One-time recompute of migrated formulas, once the Workbook has mounted.
  useEffect(() => {
    if (!initial || !needsRecalc.current) return;
    needsRecalc.current = false;
    const t = setTimeout(() => wbRef.current?.calculateFormula(), 300);
    return () => clearTimeout(t);
  }, [initial]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleChange = useCallback(
    (sheets: Sheet[]) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => save.mutate({ data: sheets }), 700);
    },
    [save],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Worksheet
        </h2>
        {save.isPending && <span className="text-xs text-gray-400">Saving…</span>}
      </div>

      <div className="ws-workbook min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800">
        {initial ? (
          <Workbook ref={wbRef} data={initial} onChange={handleChange} lang="en" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Loading worksheet…
          </div>
        )}
      </div>
    </div>
  );
}
