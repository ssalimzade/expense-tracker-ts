export interface ArchiveRow {
  Category: string;
  "Budget (£)": number;
  "Spent (£)": number;
  "Remaining (£)": number;
}

export type Archive = ArchiveRow[];
