import { useQuery } from '@tanstack/react-query';
import { getContractAmendmentStatus, listContractAmendments } from '@/services/contractAmendmentService';

export function useContractAmendments(contractNumber: number, refreshKey: number) {
  return useQuery({
    queryKey: ['contract-amendments', contractNumber, refreshKey],
    enabled: Number.isFinite(contractNumber) && contractNumber > 0,
    queryFn: async () => {
      const [status, documents] = await Promise.all([getContractAmendmentStatus(contractNumber), listContractAmendments(contractNumber)]);
      return { status, documents };
    },
  });
}
