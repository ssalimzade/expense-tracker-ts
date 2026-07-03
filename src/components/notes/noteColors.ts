import type { NoteColor } from "../../types/note";

// Sticky-note palette. `card` styles the note body; `swatch` is the solid dot
// shown in the colour picker; `badge` tints the type label.
export const NOTE_COLORS: Record<
  NoteColor,
  { card: string; swatch: string; badge: string }
> = {
  yellow: {
    card: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/60",
    swatch: "bg-amber-400",
    badge: "bg-amber-200/70 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
  },
  blue: {
    card: "bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-900/60",
    swatch: "bg-sky-400",
    badge: "bg-sky-200/70 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200",
  },
  green: {
    card: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/60",
    swatch: "bg-emerald-400",
    badge: "bg-emerald-200/70 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
  },
  pink: {
    card: "bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/60",
    swatch: "bg-rose-400",
    badge: "bg-rose-200/70 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200",
  },
  purple: {
    card: "bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-900/60",
    swatch: "bg-violet-400",
    badge: "bg-violet-200/70 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200",
  },
  gray: {
    card: "bg-gray-50 border-gray-200 dark:bg-gray-800/60 dark:border-gray-700",
    swatch: "bg-gray-400",
    badge: "bg-gray-200/80 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  },
};

export const COLOR_KEYS = Object.keys(NOTE_COLORS) as NoteColor[];
