import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchHidden, saveHiddenMonth, type HiddenMap } from "../api/hidden";

/**
 * Per-month set of hidden transaction flag_ids, persisted in Neon (app_config)
 * so hidden rows sync across every device. Writes update the cache optimistically
 * for an instant UI, then persist.
 */
export function useHiddenTransactions() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["hidden"], queryFn: fetchHidden });
  const map: HiddenMap = data ?? {};

  const { mutate } = useMutation({
    mutationFn: ({ month, ids }: { month: string; ids: string[] }) =>
      saveHiddenMonth(month, ids),
    onSuccess: (all) => qc.setQueryData(["hidden"], all),
    onError: () => qc.invalidateQueries({ queryKey: ["hidden"] }),
  });

  const setMonth = useCallback(
    (month: string, ids: string[]) => {
      qc.setQueryData<HiddenMap>(["hidden"], (prev) => {
        const next = { ...(prev ?? {}) };
        if (ids.length) next[month] = ids;
        else delete next[month];
        return next;
      });
      mutate({ month, ids });
    },
    [qc, mutate],
  );

  const hiddenFor = useCallback(
    (month: string) => new Set(map[month] ?? []),
    [map],
  );
  const hide = useCallback(
    (month: string, flagId: string) => setMonth(month, [...(map[month] ?? []), flagId]),
    [map, setMonth],
  );
  const restore = useCallback(
    (month: string, flagId: string) =>
      setMonth(month, (map[month] ?? []).filter((id) => id !== flagId)),
    [map, setMonth],
  );
  const restoreAll = useCallback((month: string) => setMonth(month, []), [setMonth]);
  const pruneStale = useCallback(
    (month: string, validIds: Set<string>) => {
      const cur = map[month] ?? [];
      const pruned = cur.filter((id) => validIds.has(id));
      if (pruned.length !== cur.length) setMonth(month, pruned);
    },
    [map, setMonth],
  );

  return { hiddenFor, hide, restore, restoreAll, pruneStale };
}
