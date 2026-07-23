import { create } from 'zustand'

const defaultDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())

export type DateCashierFilters = {
  startDate: string
  endDate: string
  cashier: string
}

type UiState = {
  selectedBranch: string
  globalSearch: string
  dateFilters: DateCashierFilters
  setSelectedBranch: (branchId: string) => void
  setGlobalSearch: (value: string) => void
  setDateFilters: (filters: DateCashierFilters) => void
}

export const useUiStore = create<UiState>((set) => ({
  selectedBranch: 'branch-crossing-calmba',
  globalSearch: '',
  dateFilters: { startDate: defaultDate, endDate: defaultDate, cashier: 'all' },
  setSelectedBranch: (selectedBranch) => set({ selectedBranch }),
  setGlobalSearch: (globalSearch) => set({ globalSearch }),
  setDateFilters: (dateFilters) => set({ dateFilters }),
}))
