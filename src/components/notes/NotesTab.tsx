import { useMemo, useRef, useState } from "react";
import { useNotes, useSaveNote, useDeleteNote } from "../../hooks/useNotes";
import { toast } from "../../lib/toast";
import { QueryState } from "../common";
import type { Note } from "../../types/note";
import NoteCard from "./NoteCard";
import NoteEditor from "./NoteEditor";
import Worksheet from "./Worksheet";

const VIEW_STORAGE_KEY = "notes-view";
type View = "notes" | "worksheet";

const newNoteId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

function readView(): View {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "worksheet" ? "worksheet" : "notes";
  } catch {
    return "notes";
  }
}

export default function NotesTab() {
  const notesQuery = useNotes();
  const saveNote = useSaveNote();
  const deleteNote = useDeleteNote();

  const [view, setView] = useState<View>(readView);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [editing, setEditing] = useState<Partial<Note> | null>(null);

  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      // Only a convenience.
    }
  };

  const notes = notesQuery.data ?? [];

  const kinds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) if (n.type) counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [notes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes
      .filter((n) => {
        if (typeFilter && n.type !== typeFilter) return false;
        if (q && !`${n.title} ${n.body} ${n.type}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  }, [notes, search, typeFilter]);

  const pinned = filtered.filter((n) => n.pinned);
  const others = filtered.filter((n) => !n.pinned);
  const pinnedCount = notes.filter((n) => n.pinned).length;

  function handleDelete(note: Note) {
    if (!window.confirm(`Delete this note${note.title ? ` "${note.title}"` : ""}?`)) return;
    setEditing(null);
    deleteNote.mutate(note.id, {
      onSuccess: () => toast.undo("Note deleted", () => saveNote.mutate(note)),
    });
  }

  // New notes get their id up front, so saving the same draft twice (a double
  // tap, a retry after a dropped connection) updates it rather than duplicating.
  const draftId = useRef(newNoteId());
  const openNew = () => {
    draftId.current = newNoteId();
    setEditing({ type: typeFilter || undefined });
  };
  const handleSave = async (note: Partial<Note>) => {
    await saveNote.mutateAsync(note.id ? note : { ...note, id: draftId.current });
  };

  const card = (note: Note) => (
    <NoteCard
      key={note.id}
      note={note}
      onEdit={setEditing}
      onTogglePin={(n) => saveNote.mutate({ id: n.id, pinned: !n.pinned })}
      onDelete={handleDelete}
    />
  );
  const grid = (list: Note[]) => (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4 [&>*]:mb-4">{list.map(card)}</div>
  );

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {view === "notes" ? "Notes" : "Worksheet"}
          </h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {view === "notes"
              ? `${notes.length} note${notes.length === 1 ? "" : "s"}${pinnedCount ? ` · ${pinnedCount} pinned` : ""}`
              : "Saves as you type"}
          </p>
        </div>
        <div className="flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800/70 max-sm:w-full">
          {(["notes", "worksheet"] as const).map((v) => (
            <button
              key={v}
              onClick={() => changeView(v)}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-semibold capitalize transition max-sm:flex-1 ${
                view === v
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-70">
                {v === "notes" ? (
                  <path d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8.586A2 2 0 0 0 14 16.414L17.414 13A2 2 0 0 0 18 11.586V5a2 2 0 0 0-2-2H4Zm2 4.25a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 7.25Zm.75 2.25a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" />
                ) : (
                  <path fillRule="evenodd" d="M2 4.75A2.75 2.75 0 0 1 4.75 2h10.5A2.75 2.75 0 0 1 18 4.75v10.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25V4.75ZM3.5 8v3h4.25V8H3.5Zm5.75 0v3h7.25V8H9.25ZM16.5 6.5V4.75c0-.69-.56-1.25-1.25-1.25H9.25v3h7.25Zm-8.75-3H4.75c-.69 0-1.25.56-1.25 1.25V6.5h4.25v-3Zm-4.25 9v2.75c0 .69.56 1.25 1.25 1.25h3V12.5H3.5Zm5.75 4h6c.69 0 1.25-.56 1.25-1.25V12.5H9.25v4Z" clipRule="evenodd" />
                )}
              </svg>
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "worksheet" ? (
        <div className="mt-4 h-[calc(100dvh-16.5rem)] min-h-[24rem] md:h-[calc(100dvh-12rem)]">
          <Worksheet />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes…"
                className="w-full rounded-2xl bg-white py-2.5 pl-10 pr-3 text-sm ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-900 dark:ring-gray-800"
              />
            </div>
            <button
              onClick={openNew}
              className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
            >
              <span className="text-lg leading-none">+</span> New note
            </button>
          </div>

          {kinds.length > 0 && (
            <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
              <FilterPill active={typeFilter === ""} onClick={() => setTypeFilter("")} count={notes.length}>
                All
              </FilterPill>
              {kinds.map(([t, n]) => (
                <FilterPill key={t} active={typeFilter === t} onClick={() => setTypeFilter(typeFilter === t ? "" : t)} count={n}>
                  {t}
                </FilterPill>
              ))}
            </div>
          )}

          <QueryState isLoading={notesQuery.isLoading} error={notesQuery.error}>
            {filtered.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-gray-200 px-6 py-16 text-center dark:border-gray-800">
                <p className="text-3xl">🗒️</p>
                <p className="mt-3 font-semibold">{notes.length === 0 ? "No notes yet" : "Nothing matches"}</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-gray-400">
                  {notes.length === 0
                    ? "Jot down balances, reminders, or anything you want to keep handy."
                    : "Try a different search or kind."}
                </p>
                {notes.length === 0 && (
                  <button
                    onClick={openNew}
                    className="mt-4 rounded-2xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-gray-900"
                  >
                    Write your first note
                  </button>
                )}
              </div>
            ) : (
              <>
                {pinned.length > 0 && (
                  <section>
                    {others.length > 0 && <SectionLabel>Pinned</SectionLabel>}
                    {grid(pinned)}
                  </section>
                )}
                {others.length > 0 && (
                  <section>
                    {pinned.length > 0 && <SectionLabel>Everything else</SectionLabel>}
                    {grid(others)}
                  </section>
                )}
              </>
            )}
          </QueryState>
        </div>
      )}

      {editing && (
        <NoteEditor
          key={editing.id ?? "new"}
          note={editing}
          knownTypes={kinds.map(([t]) => t)}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-gray-400">{children}</p>;
}

function FilterPill({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
          : "bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-800 dark:hover:ring-gray-700"
      }`}
    >
      {children}
      <span className={`tabular-nums ${active ? "opacity-60" : "text-gray-400"}`}>{count}</span>
    </button>
  );
}
