import { api } from "./client";
import type { Note } from "../types/note";

export const fetchNotes = () => api.get<Note[]>("/notes");

export const saveNote = (note: Partial<Note>) =>
  api.post<Note[]>("/notes", note);

export const deleteNote = (id: string) =>
  api.del<Note[]>(`/notes/${id}`);
