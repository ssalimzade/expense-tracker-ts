// Pure migration/normalisation for the worksheet payload — no React or
// Fortune-sheet runtime imports (types only), so it's cheap to unit-test.
//
// The persisted `data` is either Fortune-sheet's `Sheet[]` (current) or the
// legacy react-spreadsheet `Matrix<{ value }>` (a 2-D array of rows). `toSheets`
// accepts both and always returns at least one sheet.
import type { Cell, CellWithRowAndCol, Sheet } from "@fortune-sheet/core";

export const DEFAULT_ROWS = 50;
export const DEFAULT_COLS = 26;

// The legacy react-spreadsheet cell shape: `{ value } | null` inside a matrix.
type LegacyCell = { value?: string | number | null } | null;

// Turn a raw legacy value into a Fortune-sheet cell. Formulas (`=…`) are stored
// under `f` so Fortune-sheet re-evaluates them; numbers keep a numeric type so
// they right-align and sum correctly.
export function makeCell(value: string | number): Cell {
  const str = String(value);
  if (str.startsWith("=")) return { f: str };
  const asNum = typeof value === "number" ? value : Number(str);
  if (str.trim() !== "" && !Number.isNaN(asNum)) {
    return { v: asNum, m: str, ct: { fa: "General", t: "n" } };
  }
  return { v: str, m: str };
}

export function blankSheet(): Sheet {
  return {
    name: "Sheet1",
    id: "sheet1",
    order: 0,
    row: DEFAULT_ROWS,
    column: DEFAULT_COLS,
    celldata: [],
  };
}

// Already-migrated payload: an array of sheet objects (not rows).
export function isFortuneSheets(data: unknown): data is Sheet[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    typeof data[0] === "object" &&
    data[0] !== null &&
    !Array.isArray(data[0]) &&
    ("celldata" in data[0] || "data" in data[0] || "name" in data[0])
  );
}

// Legacy payload: an array whose first element is itself a row (array).
export function isLegacyMatrix(data: unknown): data is LegacyCell[][] {
  return Array.isArray(data) && data.length > 0 && Array.isArray(data[0]);
}

function migrateLegacy(matrix: LegacyCell[][]): Sheet[] {
  const celldata: CellWithRowAndCol[] = [];
  let maxR = DEFAULT_ROWS - 1;
  let maxC = DEFAULT_COLS - 1;
  matrix.forEach((row, r) =>
    row?.forEach((cell, c) => {
      const value = cell?.value;
      if (value === undefined || value === null || value === "") return;
      celldata.push({ r, c, v: makeCell(value) });
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    }),
  );
  return [{ ...blankSheet(), row: maxR + 1, column: maxC + 1, celldata }];
}

// Fortune-sheet's `onChange` emits each sheet as a `data` MATRIX (no `celldata`),
// and that's what we persist. But on load the `<Workbook data>` prop is only read
// from `celldata` — a sheet with just a `data` matrix renders BLANK. So rebuild
// `celldata` from the matrix (and drop `data`) for any sheet missing it.
export function withCelldata(sheets: Sheet[]): Sheet[] {
  return (sheets ?? []).map((s) => {
    if (Array.isArray(s.celldata) && s.celldata.length > 0) return s;
    if (!Array.isArray(s.data)) return s;
    const celldata: CellWithRowAndCol[] = [];
    s.data.forEach((row, r) =>
      row?.forEach((cell, c) => {
        if (cell != null) celldata.push({ r, c, v: cell });
      }),
    );
    const { data: _drop, ...rest } = s;
    return { ...rest, celldata };
  });
}

export function toSheets(data: unknown): Sheet[] {
  if (isFortuneSheets(data)) return withCelldata(data);
  if (isLegacyMatrix(data)) return migrateLegacy(data);
  return [blankSheet()];
}
