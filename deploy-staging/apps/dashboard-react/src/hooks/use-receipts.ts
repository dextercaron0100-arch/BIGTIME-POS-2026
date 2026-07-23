import { useQuery } from '@tanstack/react-query'
import { loadReceipts } from '../lib/mock-data'

export function useReceipts(branchId: string) {
  return useQuery({
    queryKey: ['receipts', branchId],
    queryFn: () => loadReceipts(branchId),
  })
}
