import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchRepayments,
  saveRepayment,
  deleteRepayment,
  restoreRepayment,
  fetchSyntheticRepayments,
  syncSyntheticRepayments,
  deleteSyntheticRepayments,
  fetchRepaymentCategories,
  addRepaymentCategory,
} from "../api/repayments";
import type { RepaymentUpdate } from "../types/repayment";

export function useRepayments() {
  return useQuery({
    queryKey: ["repayments"],
    queryFn: fetchRepayments,
  });
}

export function useSyntheticRepayments() {
  return useQuery({
    queryKey: ["repayments", "synthetic"],
    queryFn: fetchSyntheticRepayments,
  });
}

export function useSyncSyntheticRepayments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ month, force }: { month: string; force?: boolean }) =>
      syncSyntheticRepayments(month, force),
    meta: { success: "Synced to Monzo", error: "Couldn't sync repayments" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repayments", "synthetic"] }),
  });
}

export function useDeleteSyntheticRepayments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (month: string) => deleteSyntheticRepayments(month),
    meta: { success: "Removed from Monzo", error: "Couldn't remove entries" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repayments", "synthetic"] }),
  });
}

export function useRepaymentCategories() {
  return useQuery({
    queryKey: ["repayment-categories"],
    queryFn: fetchRepaymentCategories,
  });
}

export function useAddRepaymentCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => addRepaymentCategory(name),
    meta: { success: "Category added", error: "Couldn't add category" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repayment-categories"] }),
  });
}

export function useSaveRepayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: RepaymentUpdate) => saveRepayment(update),
    meta: { success: "Repayment saved", error: "Couldn't save repayment" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repayments"] }),
  });
}

export function useDeleteRepayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRepayment(id),
    meta: { success: "Repayment deleted", error: "Couldn't delete repayment" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repayments"] }),
  });
}

export function useRestoreRepayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreRepayment(id),
    meta: { success: "Repayment restored", error: "Couldn't restore repayment" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repayments"] }),
  });
}
