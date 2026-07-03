import type { Note } from "../../types/note";
import { NOTE_COLORS } from "./noteColors";
import { shortDate } from "../../lib/format";

interface Props {
  note: Note;
  onEdit: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onDelete: (note: Note) => void;
}

export default function NoteCard({ note, onEdit, onTogglePin, onDelete }: Props) {
  const c = NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow;

  return (
    <div
      className={`group relative flex break-inside-avoid flex-col rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${c.card}`}
    >
      {/* Hover actions */}
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
        <ActionButton
          label={note.pinned ? "Unpin" : "Pin to top"}
          onClick={() => onTogglePin(note)}
          className={`hover:bg-black/5 dark:hover:bg-white/10 ${
            note.pinned ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"
          }`}
        >
          <path d="M9.5 1.5a1 1 0 0 1 1 0l.5.288a3 3 0 0 1 1.45 2.063l.34 1.7 2.1 2.099a1.5 1.5 0 0 1 .35 1.57l-.2.55a1 1 0 0 1-1.6.39L11.5 11.6V16a.5.5 0 0 1-1 0v-4.4l-1.39 1.39a1 1 0 0 1-1.6-.39l-.2-.55a1.5 1.5 0 0 1 .35-1.57l2.1-2.1.34-1.7A3 3 0 0 1 9 4.79V2.36a1 1 0 0 1 .5-.86Z" />
        </ActionButton>
        <ActionButton
          label="Edit"
          onClick={() => onEdit(note)}
          className="text-gray-400 hover:bg-black/5 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
        >
          <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-8.5 8.5a1 1 0 0 1-.464.263l-3 .75a.5.5 0 0 1-.606-.606l.75-3a1 1 0 0 1 .263-.464l8.5-8.5Z" />
        </ActionButton>
        <ActionButton
          label="Delete"
          onClick={() => onDelete(note)}
          className="text-gray-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
        >
          <path fillRule="evenodd" d="M8.75 1a1 1 0 0 0-.96.713L7.42 3H4a.75.75 0 0 0 0 1.5h.28l.84 11.2A2 2 0 0 0 7.11 17.5h5.78a2 2 0 0 0 1.99-1.8L15.72 4.5H16A.75.75 0 0 0 16 3h-3.42l-.37-1.287A1 1 0 0 0 11.25 1h-2.5ZM8.5 7.25a.75.75 0 0 1 1.5 0v6a.75.75 0 0 1-1.5 0v-6Zm3.25-.75a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 1.5 0v-6a.75.75 0 0 0-.75-.75Z" clipRule="evenodd" />
        </ActionButton>
      </div>

      {/* Header: type badge + pin marker */}
      {(note.type || note.pinned) && (
        <div className="mb-1.5 flex items-center gap-1.5 pr-16">
          {note.pinned && (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400">
              <path d="M9.5 1.5a1 1 0 0 1 1 0l.5.288a3 3 0 0 1 1.45 2.063l.34 1.7 2.1 2.099a1.5 1.5 0 0 1 .35 1.57l-.2.55a1 1 0 0 1-1.6.39L11.5 11.6V16a.5.5 0 0 1-1 0v-4.4l-1.39 1.39a1 1 0 0 1-1.6-.39l-.2-.55a1.5 1.5 0 0 1 .35-1.57l2.1-2.1.34-1.7A3 3 0 0 1 9 4.79V2.36a1 1 0 0 1 .5-.86Z" />
            </svg>
          )}
          {note.type && (
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.badge}`}>
              {note.type}
            </span>
          )}
        </div>
      )}

      {note.title && (
        <h3 className="pr-16 text-sm font-bold text-gray-800 dark:text-gray-100">{note.title}</h3>
      )}

      {note.body && (
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          {note.body}
        </p>
      )}

      <span className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
        {shortDate(note.updated_at)}
      </span>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group/act relative">
      <button onClick={onClick} aria-label={label} className={`rounded-lg p-1.5 ${className}`}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          {children}
        </svg>
      </button>
      <span className="pointer-events-none absolute -bottom-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 shadow-sm transition group-hover/act:opacity-100 dark:bg-gray-700">
        {label}
      </span>
    </div>
  );
}
