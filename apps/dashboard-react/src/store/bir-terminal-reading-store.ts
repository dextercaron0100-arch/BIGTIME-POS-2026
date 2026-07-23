import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BirReadingType = 'X' | 'Z'

export type BirTerminalReadingRecord = {
  id: string
  terminalId: string
  terminalName: string
  serialNumber: string
  branchId: string
  cashierName: string
  readingType: BirReadingType
  sequence: number
  readingNumber: string
  beginningOr: number
  endingOr: number
  grossSales: number
  vatableSales: number
  vatAmount: number
  vatExemptSales: number
  zeroRatedSales: number
  discountTotal: number
  createdAt: string
}

type BirTerminalDescriptor = {
  id: string
  branchId: string
  name: string
  serialNumber: string
  cashierName: string
}

type BirTerminalReadingStore = {
  readings: BirTerminalReadingRecord[]
  seeded: boolean
  ensureSeeded: () => void
  addReading: (reading: BirTerminalReadingRecord) => void
}

const seedReadings: BirTerminalReadingRecord[] = []

const terminalBaseOrStart: Record<string, number> = {}

const branchAverageTicket: Record<string, number> = {}

const useBirTerminalReadingStore = create<BirTerminalReadingStore>()(
  persist(
    (set) => ({
      readings: [],
      seeded: false,
      ensureSeeded: () =>
        set((state) => {
          if (state.seeded) {
            return state
          }

          return {
            readings: seedReadings,
            seeded: true,
          }
        }),
      addReading: (reading) =>
        set((state) => ({
          readings: [reading, ...state.readings],
        })),
    }),
    {
      name: 'bigtime-pos-bir-terminal-readings-v2',
      partialize: (state) => ({
        readings: state.readings,
        seeded: state.seeded,
      }),
    },
  ),
)

export { useBirTerminalReadingStore }

function createReadingId(type: BirReadingType, terminalId: string, sequence: number) {
  return `bir-${terminalId}-${type.toLowerCase()}-${sequence}-${Date.now()}`
}

function formatReadingNumber(type: BirReadingType, sequence: number) {
  return `${type}-${String(sequence).padStart(6, '0')}`
}

export function createBirTerminalReading(
  terminal: BirTerminalDescriptor,
  readingType: BirReadingType,
  readings: BirTerminalReadingRecord[],
) {
  const terminalReadings = readings.filter((reading) => reading.terminalId === terminal.id)
  const sameTypeReadings = terminalReadings.filter(
    (reading) => reading.readingType === readingType,
  )
  const lastTerminalReading = terminalReadings.sort(
    (left, right) => right.endingOr - left.endingOr,
  )[0]
  const lastSameTypeReading = sameTypeReadings.sort(
    (left, right) => right.sequence - left.sequence,
  )[0]

  const nextSequence = (lastSameTypeReading?.sequence ?? 0) + 1
  const nextBeginningOr =
    (lastTerminalReading?.endingOr ?? terminalBaseOrStart[terminal.id] ?? 100001) +
    (lastTerminalReading ? 1 : 0)
  const spanBase = readingType === 'X' ? 24 : 46
  const span = spanBase + ((nextSequence % 4) + 1) * 3
  const endingOr = nextBeginningOr + span - 1
  const averageTicket = branchAverageTicket[terminal.branchId] ?? 500
  const readingMultiplier = readingType === 'X' ? 0.84 : 1.26
  const grossSales = Number((span * averageTicket * readingMultiplier).toFixed(2))
  const vatableSales = Number((grossSales / 1.12).toFixed(2))
  const vatAmount = Number((grossSales - vatableSales).toFixed(2))
  const discountTotal = Number((span * (readingType === 'X' ? 3.25 : 4.8)).toFixed(2))

  return {
    id: createReadingId(readingType, terminal.id, nextSequence),
    terminalId: terminal.id,
    terminalName: terminal.name,
    serialNumber: terminal.serialNumber,
    branchId: terminal.branchId,
    cashierName: terminal.cashierName,
    readingType,
    sequence: nextSequence,
    readingNumber: formatReadingNumber(readingType, nextSequence),
    beginningOr: nextBeginningOr,
    endingOr,
    grossSales,
    vatableSales,
    vatAmount,
    vatExemptSales: 0,
    zeroRatedSales: 0,
    discountTotal,
    createdAt: new Date().toISOString(),
  } satisfies BirTerminalReadingRecord
}
