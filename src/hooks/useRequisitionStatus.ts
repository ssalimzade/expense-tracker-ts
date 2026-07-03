import { useQuery } from "@tanstack/react-query";
import { fetchRequisitionStatus } from "../api/requisitions";

export function useRequisitionStatus() {
  return useQuery({
    queryKey: ["requisition-status"],
    queryFn: fetchRequisitionStatus,
    staleTime: 1000 * 60 * 60, // expiry dates change slowly; refetch hourly at most
  });
}
