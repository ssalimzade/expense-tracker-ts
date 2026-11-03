import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteSavingsGoal, fetchSavings, fetchSavingsGoals, saveSavingsGoal, saveSavingsRow } from "../api/savings";
import type { SavingsGoal, SavingsRow } from "../types/savings";
import { toast } from "../lib/toast";

export function useSavings() {
  return useQuery({
    queryKey: ["savings"],
    queryFn: fetchSavings,
  });
}

export function useSaveSavingsRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: Partial<SavingsRow>) => saveSavingsRow(row),
    meta: { success: "Savings saved", error: "Couldn't save savings" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["savings"] }),
  });
}

export function useSavingsGoals() {
  return useQuery({
    queryKey: ["savings-goals"],
    queryFn: fetchSavingsGoals,
  });
}

export function useSaveSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goal: Partial<SavingsGoal>) => saveSavingsGoal(goal),
    // One at a time, in order — the server rewrites the whole list on each save.
    scope: { id: "savings-goals" },
    meta: { success: "Goal saved", error: "Couldn't save goal" },
    onSuccess: (goals) => qc.setQueryData(["savings-goals"], goals),
  });
}

/**
 * Deletes a goal, then offers an Undo that puts it back where it was. The toast
 * is raised here, not per call, so it still shows if the tab is left meanwhile.
 */
export function useDeleteSavingsGoal() {
  const qc = useQueryClient();
  const restore = useSaveSavingsGoal();
  return useMutation({
    mutationFn: (goal: SavingsGoal) => deleteSavingsGoal(goal.id),
    scope: { id: "savings-goals" },
    meta: { error: "Couldn't delete goal" },
    onSuccess: (goals, goal) => {
      qc.setQueryData(["savings-goals"], goals);
      toast.undo(`Deleted ${goal.name}`, () => restore.mutate(goal));
    },
  });
}
