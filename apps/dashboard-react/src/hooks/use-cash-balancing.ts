import { useQuery } from '@tanstack/react-query'
import { fetchCashBalancing } from '../lib/api-client'
import { loadCashBalancing } from '../lib/mock-data'

export function useCashBalancing(branchId: string) {
  return useQuery({
    queryKey: ['cash-balancing', branchId],
    queryFn: async () => {
      try {
        return await fetchCashBalancing(branchId)
      } catch {
        return loadCashBalancing(branchId)
      }
    },
  })
}
