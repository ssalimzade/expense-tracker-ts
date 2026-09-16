import type { NoteColor } from "../../types/note";

// Note palette. Cards stay neutral; the colour shows as `bar` (the strip along
// the top of a card), `glow` (a faint wash beneath it), `swatch` (the picker
// dot) and `badge` (the kind label).
export const NOTE_COLORS: Record<
  NoteColor,
  { bar: string; glow: string; swatch: string; badge: string }
> = {
  yellow: {
    bar: "bg-amber-400",
    glow: "from-amber-400/10",
    swatch: "bg-amber-400",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  },
  blue: {
    bar: "bg-sky-400",
    glow: "from-sky-400/10",
    swatch: "bg-sky-400",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300",
  },
  green: {
    bar: "bg-emerald-400",
    glow: "from-emerald-400/10",
    swatch: "bg-emerald-400",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
  },
  pink: {
    bar: "bg-rose-400",
    glow: "from-rose-400/10",
    swatch: "bg-rose-400",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300",
  },
  purple: {
    bar: "bg-violet-400",
    glow: "from-violet-400/10",
    swatch: "bg-violet-400",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300",
  },
  gray: {
    bar: "bg-gray-400",
    glow: "from-gray-400/10",
    swatch: "bg-gray-400",
    badge: "bg-gray-100 text-gray-700 dark:bg-gray-400/15 dark:text-gray-300",
  },
};

export const COLOR_KEYS = Object.keys(NOTE_COLORS) as NoteColor[];
