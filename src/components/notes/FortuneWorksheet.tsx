import { useCallback, useEffect, useRef, useState } from "react";
import { Workbook, type WorkbookInstance } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import "./worksheet.css";
import type { Sheet } from "@fortune-sheet/core";
import { useQueryClient } from "@tanstack/react-query";
import { useWorksheet, useSaveWorksheet } from "../../hooks/useWorksheet";
import { useDarkMode } from "../../hooks/useDarkMode";
import { useIsMobile } from "../../hooks/useIsMobile";
import { isLegacyMatrix, toSheets } from "./worksheetMigration";

export default function FortuneWorksheet() {
  const dark = useDarkMode();
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const wsQuery = useWorksheet();
  const save = useSaveWorksheet();

  // Fortune-sheet reads `data` once at mount and owns state thereafter, so seed
  // it a single time from the server and never feed the prop again.
  const [initial, setInitial] = useState<Sheet[] | null>(null);
  const wbRef = useRef<WorkbookInstance>(null);
  const needsRecalc = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pending = useRef<Sheet[] | null>(null);

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

  // Persist the latest sheets. Held in a ref and behind a `flushRef` so an
  // unmount (e.g. switching tabs) can push a pending save instead of dropping
  // the debounced edit.
  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    if (pending.current == null) return;
    const data = pending.current;
    pending.current = null;
    save.mutate({ data });
  };

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      flushRef.current();
    },
    [],
  );

  const handleChange = useCallback(
    (sheets: Sheet[]) => {
      // Keep the query cache in sync so re-opening the tab reseeds from the
      // current sheet, not the pre-edit snapshot.
      qc.setQueryData(["worksheet"], { data: sheets });
      pending.current = sheets;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => flushRef.current(), 700);
    },
    [qc],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Worksheet
        </h2>
        {save.isPending && <span className="text-xs text-gray-400">Saving…</span>}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <div
          className={`ws-workbook h-full w-full ${dark ? "ws-dark" : "bg-white"} ${
            isMobile ? "ws-mobile" : ""
          }`}
        >
          {initial ? (
            <Workbook
              ref={wbRef}
              data={initial}
              onChange={handleChange}
              lang="en"
              // Taller rows are easier to tap on a phone; desktop keeps the default.
              {...(isMobile ? { defaultRowHeight: 26 } : {})}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Loading worksheet…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
