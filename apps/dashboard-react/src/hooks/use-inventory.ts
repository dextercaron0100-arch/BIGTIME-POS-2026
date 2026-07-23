import { useQuery } from '@tanstack/react-query'
import { fetchInventory } from '../lib/api-client'
import { loadInventory } from '../lib/mock-data'

export function useInventory(branchId: string) {
  return useQuery({
    queryKey: ['inventory', branchId],
    queryFn: async () => {
      try {
        return await fetchInventory(branchId)
      } catch {
        return loadInventory(branchId)
      }
    },
  })
}
