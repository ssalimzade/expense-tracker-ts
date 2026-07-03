import { useEffect, useState } from "react";
import type { Note, NoteColor } from "../../types/note";
import { NOTE_COLORS, COLOR_KEYS } from "./noteColors";

interface Props {
  note: Partial<Note> | null; // null = closed; {} = new note
  knownTypes: string[];
  saving: boolean;
  onSave: (note: Partial<Note>) => void;
  onClose: () => void;
}

export default function NoteEditor({ note, knownTypes, saving, onSave, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("");
  const [color, setColor] = useState<NoteColor>("yellow");
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!note) return;
    setTitle(note.title ?? "");
    setBody(note.body ?? "");
    setType(note.type ?? "");
    setColor(note.color ?? "yellow");
    setPinned(note.pinned ?? false);
  }, [note]);

  if (!note) return null;
  const isEdit = !!note.id;

  function submit() {
    if (!title.trim() && !body.trim()) {
      onClose();
      return;
    }
    onSave({
      ...(note?.id ? { id: note.id } : {}),
      title: title.trim(),
      body,
      type: type.trim(),
      color,
      pinned,
    });
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh]"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">
            {isEdit ? "Edit note" : "New note"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 p-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            autoFocus
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold dark:border-gray-700 dark:bg-gray-800"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your note…"
            rows={7}
            className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed dark:border-gray-700 dark:bg-gray-800"
          />

          <div className="flex flex-wrap items-center gap-4">
            {/* Type / kind */}
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Kind
              </label>
              <input
                value={type}
                onChange={(e) => setType(e.target.value)}
                list="note-types"
                placeholder="e.g. Idea, To-do, Tax…"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              />
              <datalist id="note-types">
                {knownTypes.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            {/* Colour */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Colour
              </label>
              <div className="flex items-center gap-1.5">
                {COLOR_KEYS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    aria-label={c}
                    className={`h-6 w-6 rounded-full ${NOTE_COLORS[c].swatch} ring-offset-2 transition dark:ring-offset-gray-900 ${
                      color === c ? "ring-2 ring-gray-500 dark:ring-gray-300" : ""
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <label className="flex w-fit items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600"
            />
            Pin to top
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
