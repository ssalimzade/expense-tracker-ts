import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Note, NoteColor } from "../../types/note";
import { NOTE_COLORS, COLOR_KEYS } from "./noteColors";
import { editedLabel } from "./NoteCard";

interface Props {
  note: Partial<Note>; // {} = new note
  knownTypes: string[];
  /** Resolves once saved; rejects if it didn't (the editor then stays open). */
  onSave: (note: Partial<Note>) => Promise<void>;
  onDelete?: (note: Note) => void;
  onClose: () => void;
}

/**
 * A side panel on desktop, a full-height sheet on phones. Closing it any way —
 * Done, ✕, Escape, a tap outside — keeps what was typed: changes are saved
 * first, and it only closes once they're in.
 */
export default function NoteEditor({ note, knownTypes, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(note.title ?? "");
  const [body, setBody] = useState(note.body ?? "");
  const [type, setType] = useState(note.type ?? "");
  const [color, setColor] = useState<NoteColor>(note.color ?? "yellow");
  const [pinned, setPinned] = useState(note.pinned ?? false);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const isEdit = !!note.id;

  const dirty =
    title !== (note.title ?? "") ||
    body !== (note.body ?? "") ||
    type !== (note.type ?? "") ||
    color !== (note.color ?? "yellow") ||
    pinned !== (note.pinned ?? false);
  const empty = !title.trim() && !body.trim();

  const close = async () => {
    if (saving) return;
    // Nothing to keep: untouched, or a new note left blank.
    if (!dirty || (empty && !isEdit)) return onClose();
    setSaving(true);
    try {
      await onSave({ ...(note.id ? { id: note.id } : {}), title: title.trim(), body, type: type.trim(), color, pinned });
    } catch {
      setSaving(false); // Stay open with everything as typed; the toast says why.
      return;
    }
    onClose();
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Grow the body with its text, so long notes read like a page, not a box.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 240)}px`;
  }, [body]);

  const c = NOTE_COLORS[color];
  const kinds = knownTypes.filter((k) => k !== type.trim()).slice(0, 8);

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end justify-end md:items-stretch">
      <div className="animate-backdrop absolute inset-0 bg-black/40 md:bg-black/30" onClick={close} />
      <div
        role="dialog"
        aria-label={isEdit ? "Edit note" : "New note"}
        className="max-md:animate-sheet md:animate-slide relative flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-gray-900 md:h-full md:max-w-xl md:rounded-none md:border-l md:border-gray-200 md:dark:border-gray-800"
      >
        <span className={`absolute inset-x-0 top-0 h-1 ${c.bar}`} />
        <span className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${c.glow} to-transparent`} />

        {/* Top bar */}
        <div className="relative flex items-center gap-2 px-5 pb-2 pt-4">
          <p className="flex-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
            {isEdit ? `Edited ${editedLabel(note.updated_at)}` : "New note"}
          </p>
          {saving && <span className="text-xs text-gray-400">Saving…</span>}
          <button
            type="button"
            onClick={() => setPinned((p) => !p)}
            aria-pressed={pinned}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
              pinned
                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M9.5 1.5a1 1 0 0 1 1 0l.5.288a3 3 0 0 1 1.45 2.063l.34 1.7 2.1 2.099a1.5 1.5 0 0 1 .35 1.57l-.2.55a1 1 0 0 1-1.6.39L11.5 11.6V16a.5.5 0 0 1-1 0v-4.4l-1.39 1.39a1 1 0 0 1-1.6-.39l-.2-.55a1.5 1.5 0 0 1 .35-1.57l2.1-2.1.34-1.7A3 3 0 0 1 9 4.79V2.36a1 1 0 0 1 .5-.86Z" />
            </svg>
            {pinned ? "Pinned" : "Pin"}
          </button>
          <button
            type="button"
            onClick={close}
            disabled={saving}
            className="rounded-lg bg-gray-900 px-3 py-1 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Done
          </button>
        </div>

        {/* Page */}
        <div className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            autoFocus={!isEdit}
            className="w-full bg-transparent py-1 text-2xl font-extrabold tracking-tight text-gray-900 placeholder:text-gray-300 focus:outline-none dark:text-white dark:placeholder:text-gray-600"
          />
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Write anything…\n\nTip: a line ending in “:” becomes a heading, “- ” a bullet, “---” a divider."}
            className="mt-2 w-full resize-none overflow-hidden bg-transparent text-[15px] leading-relaxed text-gray-700 placeholder:text-gray-300 focus:outline-none dark:text-gray-200 dark:placeholder:text-gray-600"
          />
        </div>

        {/* Details */}
        <div className="relative space-y-3 border-t border-gray-100 bg-gray-50/80 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-gray-800 dark:bg-gray-950/40">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Kind</span>
            <input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="e.g. Balance"
              maxLength={30}
              className={`w-28 rounded-full border-0 px-2.5 py-1 text-xs font-bold uppercase tracking-wider placeholder:font-medium placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-indigo-400 ${c.badge}`}
            />
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setType(k)}
                className="rounded-full px-2.5 py-1 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 transition hover:bg-white hover:text-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              >
                {k}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Colour</span>
            <div className="flex flex-1 items-center gap-2">
              {COLOR_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setColor(k)}
                  aria-label={k}
                  aria-pressed={color === k}
                  className={`h-6 w-6 rounded-full ${NOTE_COLORS[k].swatch} ring-offset-2 ring-offset-gray-50 transition dark:ring-offset-gray-900 ${
                    color === k ? "ring-2 ring-gray-500 dark:ring-gray-300" : "hover:scale-110"
                  }`}
                />
              ))}
            </div>
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(note as Note)}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
