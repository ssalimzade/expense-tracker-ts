import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchNotes, saveNote, deleteNote } from "../api/notes";
import type { Note } from "../types/note";

export function useNotes() {
  return useQuery({
    queryKey: ["notes"],
    queryFn: fetchNotes,
  });
}

export function useSaveNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: Partial<Note>) => saveNote(note),
    // One at a time, in order — the server rewrites the whole list on each save.
    scope: { id: "notes" },
    meta: { success: "Note saved", error: "Couldn't save note" },
    onSuccess: (notes) => qc.setQueryData(["notes"], notes),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNote(id),
    scope: { id: "notes" },
    meta: { error: "Couldn't delete note" },
    onSuccess: (notes) => qc.setQueryData(["notes"], notes),
  });
}
