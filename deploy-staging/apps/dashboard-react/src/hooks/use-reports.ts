import { useQuery } from '@tanstack/react-query'
import { loadReports } from '../lib/mock-data'

export function useReports() {
  return useQuery({
    queryKey: ['reports'],
    queryFn: loadReports,
  })
}
