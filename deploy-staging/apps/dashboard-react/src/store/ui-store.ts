import { create } from 'zustand'

type UiState = {
  selectedBranch: string
  globalSearch: string
  setSelectedBranch: (branchId: string) => void
  setGlobalSearch: (value: string) => void
}

export const useUiStore = create<UiState>((set) => ({
  selectedBranch: 'all',
  globalSearch: '',
  setSelectedBranch: (selectedBranch) => set({ selectedBranch }),
  setGlobalSearch: (globalSearch) => set({ globalSearch }),
}))
