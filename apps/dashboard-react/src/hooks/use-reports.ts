import { useQuery } from '@tanstack/react-query'
import { fetchSalesTrend, fetchBranchComparison, fetchQueueBlueprint } from '../lib/api-client'
import { loadReports } from '../lib/mock-data'

export function useReports(enabled = true) {
  return useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      try {
        const [series, branches, queues] = await Promise.all([
          fetchSalesTrend(),
          fetchBranchComparison(),
          fetchQueueBlueprint(),
        ])
        return { series, branches, queues }
      } catch {
        return loadReports()
      }
    },
    enabled,
  })
}
