import { useQuery } from '@tanstack/react-query'
import { fetchEmployees } from '../lib/api-client'
import { loadEmployees } from '../lib/mock-data'

export function useEmployees(branchId: string) {
  return useQuery({
    queryKey: ['employees', branchId],
    queryFn: async () => {
      try {
        return await fetchEmployees(branchId)
      } catch {
        return loadEmployees(branchId)
      }
    },
  })
}
