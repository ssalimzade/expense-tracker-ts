// The worksheet payload persisted to the server.
//
// Historically this was a react-spreadsheet `Matrix<{ value }>` (a 2-D array of
// rows). It is now Fortune-sheet's `Sheet[]` format. `toSheets()` in
// FortuneWorksheet detects and migrates the legacy shape on load, so both are
// accepted here — hence `unknown`.
export interface WorksheetDoc {
  data: unknown;
}
