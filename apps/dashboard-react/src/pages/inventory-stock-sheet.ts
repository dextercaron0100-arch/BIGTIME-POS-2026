import type {
  CatalogCategory,
  CatalogItem,
  InventorySummary,
} from '@apex-pos/shared-types'

export const INVENTORY_STOCK_SHEET_HEADERS = [
  'Item Name',
  'Category',
  'Warehouse Name',
  'Parent Item Name',
  'Stock Quantity',
] as const

const DEFAULT_WAREHOUSE_NAME = 'Main Stockroom'
const DEFAULT_REORDER_POINT = 10

export type InventoryStockViewRow = InventorySummary & {
  itemId?: string
  categoryName: string
  parentItemName: string
  isCatalogSeed: boolean
}

export type InventoryStockSheetImportRow = {
  rowNumber: number
  itemName: string
  categoryName: string
  warehouseName: string
  parentItemName: string
  stockQuantity: number
}

export function buildInventoryStockViewRows(params: {
  catalogItems: CatalogItem[]
  categories: CatalogCategory[]
  inventoryRows: InventorySummary[]
}) {
  const categoryByKey = new Map(
    params.categories.map((category) => [
      `${category.branchId}::${category.id}`,
      category.name,
    ]),
  )
  const catalogItemByBranchAndName = new Map<string, CatalogItem>()
  const preferredWarehouseByBranch = new Map<string, string>()

  for (const row of params.inventoryRows) {
    if (!preferredWarehouseByBranch.has(row.branchId)) {
      preferredWarehouseByBranch.set(row.branchId, row.warehouseName)
    }
  }

  for (const item of params.catalogItems) {
    const key = buildBranchItemKey(item.branchId, item.name)
    if (!catalogItemByBranchAndName.has(key)) {
      catalogItemByBranchAndName.set(key, item)
    }
  }

  const rows: InventoryStockViewRow[] = params.inventoryRows.map((row) => {
    const matchedItem = catalogItemByBranchAndName.get(
      buildBranchItemKey(row.branchId, row.itemName),
    )

    return {
      ...row,
      itemId: matchedItem?.id,
      categoryName: matchedItem
        ? (categoryByKey.get(`${matchedItem.branchId}::${matchedItem.categoryId}`) ?? '')
        : '',
      parentItemName: '',
      isCatalogSeed: false,
    }
  })

  const trackedItemKeys = new Set(
    params.inventoryRows.map((row) => buildBranchItemKey(row.branchId, row.itemName)),
  )

  for (const item of params.catalogItems) {
    const branchItemKey = buildBranchItemKey(item.branchId, item.name)
    if (trackedItemKeys.has(branchItemKey)) {
      continue
    }

    rows.push({
      id: `catalog-stock-${item.id}`,
      branchId: item.branchId,
      itemId: item.id,
      itemName: item.name,
      warehouseName:
        preferredWarehouseByBranch.get(item.branchId) ?? DEFAULT_WAREHOUSE_NAME,
      quantityOnHand: 0,
      reorderPoint: DEFAULT_REORDER_POINT,
      status: 'OUT',
      categoryName:
        categoryByKey.get(`${item.branchId}::${item.categoryId}`) ?? '',
      parentItemName: '',
      isCatalogSeed: true,
    })
  }

  return rows.sort((left, right) => {
    const branchDelta = left.branchId.localeCompare(right.branchId)
    if (branchDelta !== 0) {
      return branchDelta
    }

    const categoryDelta = left.categoryName.localeCompare(right.categoryName)
    if (categoryDelta !== 0) {
      return categoryDelta
    }

    const itemDelta = left.itemName.localeCompare(right.itemName)
    if (itemDelta !== 0) {
      return itemDelta
    }

    return left.warehouseName.localeCompare(right.warehouseName)
  })
}

export function buildInventoryStockSheetRows(rows: InventoryStockViewRow[]) {
  return rows.map((row) => ({
    'Item Name': row.itemName,
    Category: row.categoryName,
    'Warehouse Name': row.warehouseName,
    'Parent Item Name': row.parentItemName,
    'Stock Quantity': row.quantityOnHand,
  }))
}

export function serializeInventoryStockSheetCsv(rows: InventoryStockViewRow[]) {
  const records = buildInventoryStockSheetRows(rows)
  const lines = [
    INVENTORY_STOCK_SHEET_HEADERS.map(escapeCsvCell).join(','),
    ...records.map((record) =>
      INVENTORY_STOCK_SHEET_HEADERS.map((header) =>
        escapeCsvCell(record[header]),
      ).join(','),
    ),
  ]
  return `\uFEFF${lines.join('\r\n')}`
}

export function parseInventoryStockSheetCsv(text: string) {
  return parseInventoryStockSheetRows(parseCsvRows(text.replace(/^\uFEFF/, '')))
}

export function parseInventoryStockSheetRows(rawRows: unknown[][]) {
  const headerRowIndex = rawRows.findIndex((row) =>
    Array.isArray(row) && row.some((value) => String(value ?? '').trim().length > 0),
  )

  if (headerRowIndex < 0) {
    throw new Error('The stock sheet is empty.')
  }

  const headerRow = rawRows[headerRowIndex] ?? []
  const normalizedHeaders = headerRow
    .slice(0, INVENTORY_STOCK_SHEET_HEADERS.length)
    .map((value) => normalizeHeader(String(value ?? '')))
  const normalizedTemplateHeaders = INVENTORY_STOCK_SHEET_HEADERS.map((value) =>
    normalizeHeader(value),
  )

  if (normalizedHeaders.join('|') !== normalizedTemplateHeaders.join('|')) {
    throw new Error(
      `Invalid stock sheet format. Expected columns: ${INVENTORY_STOCK_SHEET_HEADERS.join(', ')}.`,
    )
  }

  const parsedRows: InventoryStockSheetImportRow[] = []
  const errors: string[] = []

  for (let index = headerRowIndex + 1; index < rawRows.length; index += 1) {
    const row = rawRows[index] ?? []
    const itemName = String(row[0] ?? '').trim()
    const categoryName = String(row[1] ?? '').trim()
    const rawWarehouseName = String(row[2] ?? '').trim()
    const parentItemName = String(row[3] ?? '').trim()
    const quantityCell = row[4]

    if (
      !itemName
      && !categoryName
      && !rawWarehouseName
      && !parentItemName
      && String(quantityCell ?? '').trim().length === 0
    ) {
      continue
    }

    if (!itemName) {
      errors.push(`Row ${index + 1}: Item Name is required.`)
      continue
    }

    const stockQuantity = parseStockQuantity(quantityCell)
    if (stockQuantity === null) {
      errors.push(`Row ${index + 1}: Stock Quantity must be a whole number.`)
      continue
    }

    parsedRows.push({
      rowNumber: index + 1,
      itemName,
      categoryName,
      warehouseName: rawWarehouseName || DEFAULT_WAREHOUSE_NAME,
      parentItemName,
      stockQuantity,
    })
  }

  if (errors.length > 0) {
    throw new Error(errors.slice(0, 6).join(' '))
  }

  if (parsedRows.length === 0) {
    throw new Error('The stock sheet does not contain any item rows.')
  }

  return parsedRows
}

function buildBranchItemKey(branchId: string, itemName: string) {
  return `${branchId.trim().toLowerCase()}::${normalizeValue(itemName)}`
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase()
}

function parseStockQuantity(value: unknown) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? value : null
  }

  const normalized = String(value ?? '').trim()
  if (!normalized) {
    return 0
  }

  const parsed = Number(normalized.replace(/,/g, ''))
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function escapeCsvCell(value: unknown) {
  let normalized = String(value ?? '')
  if (/^[=+\-@]/.test(normalized)) {
    normalized = `'${normalized}`
  }
  return `"${normalized.replaceAll('"', '""')}"`
}

function parseCsvRows(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const next = text[index + 1]
    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (character === ',' && !quoted) {
      row.push(cell)
      cell = ''
      continue
    }
    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') {
        index += 1
      }
      row.push(cell)
      if (row.some((value) => value.trim().length > 0)) {
        rows.push(row)
      }
      row = []
      cell = ''
      continue
    }
    cell += character
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}
