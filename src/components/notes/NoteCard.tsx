import type { Note } from "../../types/note";
import { NOTE_COLORS } from "./noteColors";

interface Props {
  note: Note;
  onEdit: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onDelete: (note: Note) => void;
}

/** Past this many lines a card is cut off with a fade; the editor shows it all. */
const CLAMP_LINES = 14;

const PIN_PATH =
  "M9.5 1.5a1 1 0 0 1 1 0l.5.288a3 3 0 0 1 1.45 2.063l.34 1.7 2.1 2.099a1.5 1.5 0 0 1 .35 1.57l-.2.55a1 1 0 0 1-1.6.39L11.5 11.6V16a.5.5 0 0 1-1 0v-4.4l-1.39 1.39a1 1 0 0 1-1.6-.39l-.2-.55a1.5 1.5 0 0 1 .35-1.57l2.1-2.1.34-1.7A3 3 0 0 1 9 4.79V2.36a1 1 0 0 1 .5-.86Z";

export function editedLabel(iso: string | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/**
 * The body as written, with a light touch of structure for display only: a short
 * line ending in ":" reads as a heading, "- " lines as bullets, "---" as a rule.
 * What's stored is untouched.
 */
export function NoteBody({ body }: { body: string }) {
  const lines = body.replace(/\s+$/, "").split("\n");
  return (
    <div className="space-y-0.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-2" />;
        if (/^[-–—_]{3,}$/.test(t)) return <hr key={i} className="my-2 border-gray-200 dark:border-gray-700/70" />;
        const bullet = t.match(/^[-*•]\s+(.*)$/);
        if (bullet) {
          return (
            <p key={i} className="flex gap-2 break-words">
              <span className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-gray-400 dark:bg-gray-500" />
              <span className="min-w-0">{bullet[1]}</span>
            </p>
          );
        }
        if (t.endsWith(":") && t.length <= 40) {
          // Short labels ("HSBC:") read best as small caps; longer ones stay as written.
          const short = t.length <= 17;
          return (
            <p
              key={i}
              className={`pt-1 font-bold text-gray-800 first:pt-0 dark:text-gray-100 ${
                short ? "text-xs uppercase tracking-wider" : "text-sm"
              }`}
            >
              {t.slice(0, -1)}
            </p>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap break-words">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export default function NoteCard({ note, onEdit, onTogglePin, onDelete }: Props) {
  const c = NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow;
  const long = (note.body ?? "").split("\n").length > CLAMP_LINES;

  return (
    <article
      onClick={() => onEdit(note)}
      className="group relative cursor-pointer break-inside-avoid overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200/80 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-gray-300 dark:bg-gray-900 dark:ring-gray-800 dark:hover:shadow-black/40 dark:hover:ring-gray-700"
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${c.bar}`} />
      <span className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${c.glow} to-transparent`} />

      <div className="relative p-4 pt-5">
        <div className="flex min-h-[1.5rem] items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {note.type && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.badge}`}>
                {note.type}
              </span>
            )}
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{editedLabel(note.updated_at)}</span>
          </div>
          <div className="-mr-1.5 -mt-1 flex shrink-0 items-center">
            <IconButton
              label={note.pinned ? "Unpin" : "Pin to top"}
              onClick={() => onTogglePin(note)}
              className={
                note.pinned
                  ? "text-indigo-500 dark:text-indigo-400"
                  : "text-gray-400 max-md:hidden md:opacity-0 md:group-hover:opacity-100"
              }
            >
              <path d={PIN_PATH} />
            </IconButton>
            <IconButton
              label="Delete"
              onClick={() => onDelete(note)}
              className="text-gray-400 hover:!text-red-500 max-md:hidden md:opacity-0 md:group-hover:opacity-100"
            >
              <path fillRule="evenodd" d="M8.75 1a1 1 0 0 0-.96.713L7.42 3H4a.75.75 0 0 0 0 1.5h.28l.84 11.2A2 2 0 0 0 7.11 17.5h5.78a2 2 0 0 0 1.99-1.8L15.72 4.5H16A.75.75 0 0 0 16 3h-3.42l-.37-1.287A1 1 0 0 0 11.25 1h-2.5ZM8.5 7.25a.75.75 0 0 1 1.5 0v6a.75.75 0 0 1-1.5 0v-6Zm3.25-.75a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 1.5 0v-6a.75.75 0 0 0-.75-.75Z" clipRule="evenodd" />
            </IconButton>
          </div>
        </div>

        {note.title && (
          <h3 className="mt-2 break-words text-base font-bold leading-snug tracking-tight text-gray-900 dark:text-white">
            {note.title}
          </h3>
        )}

        {note.body && (
          <div className={`relative mt-2 ${long ? "max-h-[21rem] overflow-hidden" : ""}`}>
            <NoteBody body={note.body} />
            {long && (
              <div className="absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-gradient-to-t from-white to-transparent dark:from-gray-900">
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  Open to read more
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function IconButton({
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
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`rounded-lg p-1.5 transition hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        {children}
      </svg>
    </button>
  );
}
