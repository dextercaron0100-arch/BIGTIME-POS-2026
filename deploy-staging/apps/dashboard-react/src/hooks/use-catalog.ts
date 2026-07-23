import { useQuery } from '@tanstack/react-query'
import { loadCatalog } from '../lib/mock-data'

export function useCatalog(branchId: string) {
  return useQuery({
    queryKey: ['catalog', branchId],
    queryFn: () => loadCatalog(branchId),
  })
}
