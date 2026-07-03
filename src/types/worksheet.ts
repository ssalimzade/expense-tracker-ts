import type { CellBase, Matrix } from "react-spreadsheet";

// A worksheet cell only needs to persist its raw value (formulas are stored as
// the `=…` string and re-evaluated on load by react-spreadsheet).
export type WorksheetCell = CellBase<string | number | undefined>;
export type WorksheetMatrix = Matrix<WorksheetCell>;

export interface WorksheetDoc {
  data: WorksheetMatrix;
}
