import { useQuery } from '@tanstack/react-query'
import { fetchDashboardOverview } from '../lib/api-client'
import { useRealtimeConnected } from '../lib/realtime'

export function useDashboardOverview(branchId: string) {
  const wsConnected = useRealtimeConnected()

  return useQuery({
    queryKey: ['dashboard-overview', branchId],
    queryFn: () => fetchDashboardOverview(branchId),
    refetchInterval: wsConnected ? false : 20_000,
    refetchIntervalInBackground: !wsConnected,
    refetchOnWindowFocus: false,
    retry: 2,
  })
}
