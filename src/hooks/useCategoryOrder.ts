import { useCallback, useState } from "react";
import { MAIN_CATEGORIES } from "../types/categories";

const STORAGE_KEY = "budget-category-order";
const DEFAULT = [...MAIN_CATEGORIES] as string[];

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const saved = JSON.parse(raw) as string[];
    // Keep only known categories, then append any new ones missing from storage
    // so adding a category in code never silently drops it from the UI.
    const known = saved.filter((c) => DEFAULT.includes(c));
    const missing = DEFAULT.filter((c) => !known.includes(c));
    return [...known, ...missing];
  } catch {
    return DEFAULT;
  }
}

/**
 * Persisted display order for budget categories (frontend-only preference,
 * stored in localStorage). Returns the order plus a `reorder(from, to)` that
 * moves one row to another row's position.
 */
export function useCategoryOrder(): {
  order: string[];
  reorder: (from: number, to: number) => void;
} {
  const [order, setOrder] = useState<string[]>(load);

  const reorder = useCallback((from: number, to: number) => {
    setOrder((prev) => {
      if (from === to || from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { order, reorder };
}
