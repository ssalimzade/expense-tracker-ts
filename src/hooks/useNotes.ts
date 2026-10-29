import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchNotes, saveNote, deleteNote } from "../api/notes";
import type { Note } from "../types/note";
import { toast } from "../lib/toast";

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

type ArchiveVars = { id: string; archived: boolean; undo?: boolean };

/**
 * Archives or restores a note, then offers an Undo. The toast is raised here,
 * not per call, so archiving several notes in quick succession gives each one
 * its own Undo.
 */
export function useArchiveNote() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, archived }: ArchiveVars) => saveNote({ id, archived }),
    scope: { id: "notes" },
    meta: { error: "Couldn't archive note" },
    onSuccess: (notes, { id, archived, undo }) => {
      qc.setQueryData(["notes"], notes);
      if (undo) return;
      toast.undo(archived ? "Note archived" : "Note restored", () =>
        mutation.mutate({ id, archived: !archived, undo: true }),
      );
    },
  });
  return mutation;
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
