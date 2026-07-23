import { useQuery } from '@tanstack/react-query'
import { fetchCatalog } from '../lib/api-client'
import { useRealtimeConnected } from '../lib/realtime'

export function useCatalog(branchId: string) {
  const wsConnected = useRealtimeConnected()

  return useQuery({
    queryKey: ['catalog', branchId],
    queryFn: () => fetchCatalog(branchId),
    refetchInterval: wsConnected ? false : 30_000,
    refetchIntervalInBackground: !wsConnected,
    refetchOnWindowFocus: false,
    retry: 2,
  })
}
