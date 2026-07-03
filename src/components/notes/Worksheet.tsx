import { useCallback, useEffect, useRef, useState } from "react";
import Spreadsheet, { createEmptyMatrix } from "react-spreadsheet";
import "./spreadsheet.css";
import { useWorksheet, useSaveWorksheet } from "../../hooks/useWorksheet";
import { useDarkMode } from "../../hooks/useDarkMode";
import type { WorksheetCell, WorksheetMatrix } from "../../types/worksheet";

const DEFAULT_ROWS = 50;
const DEFAULT_COLS = 30;

function hasContent(cell: WorksheetCell | undefined): boolean {
  return !!cell && cell.value !== undefined && cell.value !== "";
}

// Server stores empty cells as null (JSON has no `undefined`); react-spreadsheet
// wants `undefined`. Re-hydrate keeping only the raw value, then normalise the
// grid to the default size — trimming empty trailing rows/cols, but never
// dropping any row/col that still holds data.
function hydrate(raw: unknown): WorksheetMatrix {
  if (!Array.isArray(raw) || raw.length === 0) {
    return createEmptyMatrix<WorksheetCell>(DEFAULT_ROWS, DEFAULT_COLS);
  }
  const rows = (raw as (WorksheetCell | null)[][]).map((row) =>
    row.map((cell) => (cell == null ? undefined : { value: cell.value })),
  );

  let maxR = -1;
  let maxC = -1;
  rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (hasContent(cell)) {
        if (r > maxR) maxR = r;
        if (c > maxC) maxC = c;
      }
    }),
  );

  const targetRows = Math.max(DEFAULT_ROWS, maxR + 1);
  const targetCols = Math.max(DEFAULT_COLS, maxC + 1);
  return Array.from({ length: targetRows }, (_, r) =>
    Array.from({ length: targetCols }, (_, c) => rows[r]?.[c]),
  );
}

export default function Worksheet() {
  const dark = useDarkMode();
  const wsQuery = useWorksheet();
  const save = useSaveWorksheet();

  const [data, setData] = useState<WorksheetMatrix>([]);
  const initialized = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Seed local state from the server once.
  useEffect(() => {
    if (wsQuery.data && !initialized.current) {
      setData(hydrate(wsQuery.data.data));
      initialized.current = true;
    }
  }, [wsQuery.data]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const persist = useCallback(
    (next: WorksheetMatrix) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => save.mutate({ data: next }), 700);
    },
    [save],
  );

  const handleChange = useCallback(
    (next: WorksheetMatrix) => {
      setData(next);
      persist(next);
    },
    [persist],
  );

  function addRow() {
    const cols = data[0]?.length ?? DEFAULT_COLS;
    const next = [...data, Array.from({ length: cols }, () => undefined)];
    setData(next);
    persist(next);
  }

  function addColumn() {
    const next = data.map((row) => [...row, undefined]);
    setData(next);
    persist(next);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Worksheet
        </h2>
        <div className="flex items-center gap-2">
          {save.isPending && <span className="text-xs text-gray-400">Saving…</span>}
          <button
            onClick={addRow}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            + Row
          </button>
          <button
            onClick={addColumn}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            + Column
          </button>
        </div>
      </div>

      <div className="ws-scroll min-h-0 flex-1 overflow-auto rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
        <Spreadsheet data={data} onChange={handleChange} darkMode={dark} />
      </div>
    </div>
  );
}
