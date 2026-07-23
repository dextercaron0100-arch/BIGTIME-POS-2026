import { useQuery } from '@tanstack/react-query'
import { loadInventory } from '../lib/mock-data'

export function useInventory(branchId: string) {
  return useQuery({
    queryKey: ['inventory', branchId],
    queryFn: () => loadInventory(branchId),
  })
}
