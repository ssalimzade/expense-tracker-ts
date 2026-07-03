import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "hiddenTransactions";

type HiddenMap = Map<string, Set<string>>;

/** localStorage stores a plain { [month]: string[] } since Map/Set aren't JSON. */
function load(): HiddenMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, string[]>;
    return new Map(Object.entries(obj).map(([m, ids]) => [m, new Set(ids)]));
  } catch {
    return new Map();
  }
}

function save(map: HiddenMap) {
  const obj: Record<string, string[]> = {};
  for (const [month, ids] of map) {
    if (ids.size) obj[month] = [...ids];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

/**
 * Per-month set of hidden transaction flag_ids, persisted to localStorage so
 * hidden rows survive page reloads and browser restarts.
 */
export function useHiddenTransactions() {
  const [hiddenByMonth, setHiddenByMonth] = useState<HiddenMap>(load);

  useEffect(() => {
    save(hiddenByMonth);
  }, [hiddenByMonth]);

  const hide = useCallback((month: string, flagId: string) => {
    setHiddenByMonth((prev) => {
      const next = new Map(prev);
      next.set(month, new Set([...(next.get(month) ?? []), flagId]));
      return next;
    });
  }, []);

  const restore = useCallback((month: string, flagId: string) => {
    setHiddenByMonth((prev) => {
      const next = new Map(prev);
      const s = new Set(next.get(month) ?? []);
      s.delete(flagId);
      next.set(month, s);
      return next;
    });
  }, []);

  const restoreAll = useCallback((month: string) => {
    setHiddenByMonth((prev) => {
      const next = new Map(prev);
      next.set(month, new Set());
      return next;
    });
  }, []);

  const hiddenFor = useCallback(
    (month: string) => hiddenByMonth.get(month) ?? new Set<string>(),
    [hiddenByMonth],
  );

  const pruneStale = useCallback((month: string, validIds: Set<string>) => {
    setHiddenByMonth((prev) => {
      const s = prev.get(month);
      if (!s) return prev;
      const pruned = new Set([...s].filter((id) => validIds.has(id)));
      if (pruned.size === s.size) return prev;
      const next = new Map(prev);
      next.set(month, pruned);
      return next;
    });
  }, []);

  return { hiddenFor, hide, restore, restoreAll, pruneStale };
}
