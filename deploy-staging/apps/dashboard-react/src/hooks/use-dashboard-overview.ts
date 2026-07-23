import { useQuery } from '@tanstack/react-query'
import { loadDashboardOverview } from '../lib/mock-data'

export function useDashboardOverview(branchId: string) {
  return useQuery({
    queryKey: ['dashboard-overview', branchId],
    queryFn: () => loadDashboardOverview(branchId),
  })
}
