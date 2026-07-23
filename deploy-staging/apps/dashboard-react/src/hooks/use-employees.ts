import { useQuery } from '@tanstack/react-query'
import { loadEmployees } from '../lib/mock-data'

export function useEmployees(branchId: string) {
  return useQuery({
    queryKey: ['employees', branchId],
    queryFn: () => loadEmployees(branchId),
  })
}
