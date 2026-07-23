import type { ReceiptRecord } from '@apex-pos/shared-types'
import { useQuery } from '@tanstack/react-query'
import { fetchReceipts } from '../lib/api-client'
import { useRealtimeConnected } from '../lib/realtime'

export function useReceipts(branchId: string) {
  const wsConnected = useRealtimeConnected()

  return useQuery({
    queryKey: ['receipts', branchId],
    queryFn: async (): Promise<ReceiptRecord[]> => {
      const result = await fetchReceipts(branchId)
      if (Array.isArray(result)) {
        return result as ReceiptRecord[]
      }

      if (result && Array.isArray((result as { items?: unknown[] }).items)) {
        return (result as { items: ReceiptRecord[] }).items
      }

      throw new Error('Unexpected receipts response from backend.')
    },
    refetchInterval: wsConnected ? false : 12_000,
    refetchIntervalInBackground: !wsConnected,
    refetchOnWindowFocus: false,
    retry: 2,
  })
}
