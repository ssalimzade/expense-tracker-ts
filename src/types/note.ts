export type NoteColor = "yellow" | "blue" | "green" | "pink" | "purple" | "gray";

export interface Note {
  id: string;
  title: string;
  body: string;
  type: string; // free-form label, e.g. "Idea", "To-do", "Tax", "Reference"
  color: NoteColor;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}
