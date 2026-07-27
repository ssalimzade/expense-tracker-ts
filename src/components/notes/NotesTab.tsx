import { useMemo, useState } from "react";
import { useNotes, useSaveNote, useDeleteNote } from "../../hooks/useNotes";
import { toast } from "../../lib/toast";
import { QueryState } from "../common";
import type { Note } from "../../types/note";
import NoteCard from "./NoteCard";
import NoteEditor from "./NoteEditor";
import Worksheet from "./Worksheet";

export default function NotesTab() {
  const notesQuery = useNotes();
  const saveNote = useSaveNote();
  const deleteNote = useDeleteNote();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [editing, setEditing] = useState<Partial<Note> | null>(null);

  const notes = notesQuery.data ?? [];

  const knownTypes = useMemo(
    () => [...new Set(notes.map((n) => n.type).filter(Boolean))].sort(),
    [notes],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes
      .filter((n) => {
        if (typeFilter && n.type !== typeFilter) return false;
        if (q && !`${n.title} ${n.body} ${n.type}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
      });
  }, [notes, search, typeFilter]);

  function handleDelete(note: Note) {
    if (window.confirm(`Delete this note${note.title ? ` "${note.title}"` : ""}?`)) {
      deleteNote.mutate(note.id, {
        onSuccess: () => toast.undo("Note deleted", () => saveNote.mutate(note)),
      });
    }
  }

  function handleSave(note: Partial<Note>) {
    saveNote.mutate(note, { onSuccess: () => setEditing(null) });
  }

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col gap-3">
      {/* ── Notes pane (top) — scrolls independently ─────────── */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-800"
          />
        </div>
        <button
          onClick={() => setEditing({})}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10 3a.75.75 0 0 1 .75.75v5.5h5.5a.75.75 0 0 1 0 1.5h-5.5v5.5a.75.75 0 0 1-1.5 0v-5.5h-5.5a.75.75 0 0 1 0-1.5h5.5v-5.5A.75.75 0 0 1 10 3Z" />
          </svg>
          New note
        </button>
      </div>

      {/* Type filter pills */}
      {knownTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterPill active={typeFilter === ""} onClick={() => setTypeFilter("")}>
            All
          </FilterPill>
          {knownTypes.map((t) => (
            <FilterPill key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
              {t}
            </FilterPill>
          ))}
        </div>
      )}

      <QueryState isLoading={notesQuery.isLoading} error={notesQuery.error}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-20 text-center dark:border-gray-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10 text-gray-300 dark:text-gray-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="mt-3 text-sm text-gray-500">
              {notes.length === 0 ? "No notes yet." : "No notes match your filters."}
            </p>
            {notes.length === 0 && (
              <button
                onClick={() => setEditing({})}
                className="mt-3 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Create your first note
              </button>
            )}
          </div>
        ) : (
          <div className="gap-4 [column-fill:_balance] columns-1 sm:columns-2 lg:columns-3 xl:columns-4 [&>*]:mb-4">
            {filtered.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={setEditing}
                onTogglePin={(n) => saveNote.mutate({ id: n.id, pinned: !n.pinned })}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </QueryState>
      </div>

      {/* ── Worksheet pane (bottom) — its own scroll window ──── */}
      {/* On phones the worksheet takes ~2/3 of the height so the grid is
          actually usable; desktop keeps the even split. */}
      <div className="min-h-0 flex-1 border-t border-gray-200 pt-3 dark:border-gray-800 max-md:flex-[2]">
        <Worksheet />
      </div>

      <NoteEditor
        note={editing}
        knownTypes={knownTypes}
        saving={saveNote.isPending}
        onSave={handleSave}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
