import {
  BadgePercent,
  Barcode,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Copy,
  Download,
  FolderTree,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PageHeader } from "../components/ui/page-header";
import { SectionCard } from "../components/ui/section-card";
import { useCatalog } from "../hooks/use-catalog";
import { replaceCatalogSnapshot } from "../lib/api-client";
import { formatCurrency } from "../lib/utils";
import { useUiStore } from "../store/ui-store";

const discountRules: ListingDiscountRule[] = [];

const taxProfiles: {
  name: string;
  rate: string;
  birCode: string;
  scope: string;
}[] = [];

const paymentMethodBlueprint: ListingPaymentMethodRule[] = [];

const catalogColorPalette = [
  "#8a4b2f",
  "#d6643b",
  "#d4ad5f",
  "#4f8f66",
  "#5579c6",
  "#8a5fbf",
];

function ListingShell({
  eyebrow,
  title,
  description,
  children,
}: React.PropsWithChildren<{
  eyebrow: string;
  title: string;
  description: string;
}>) {
  return (
    <div className="readable-white-route space-y-6">
      <div className="rounded-[30px] border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-5 py-5 shadow-[0_12px_28px_rgba(15,23,42,0.045)] sm:px-6 sm:py-6">
        <PageHeader eyebrow={eyebrow} title={title} description={description} />
      </div>
      {children}
    </div>
  );
}

function ListingBadge({ value }: { value: string }) {
  return (
    <div className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--muted)]">
      {value}
    </div>
  );
}

type ListingItemRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  barcode: string;
  vatType: string;
  sku: string;
  managedStock: boolean;
  saleItem: boolean;
  parentItem: string;
  rawMaterial: boolean;
};

type ListingItemForm = {
  name: string;
  category: string;
  price: string;
  cost: string;
  barcode: string;
  vatType: string;
  sku: string;
  managedStock: boolean;
  saleItem: boolean;
  parentItem: string;
  rawMaterial: boolean;
};

type ListingNotice = {
  tone: "success" | "error" | "info";
  message: string;
};

type ListingDiscountRule = {
  id: string;
  name: string;
  type: "Fixed percentage" | "Fixed amount" | "Promo markdown";
  value: number;
  birCode: string;
  auth: string;
  active: boolean;
};

type ListingDiscountForm = {
  name: string;
  type: ListingDiscountRule["type"];
  value: string;
  birCode: string;
  auth: string;
  active: boolean;
};

type ListingPaymentMethodRule = {
  id: string;
  name: string;
  settlement: string;
  status: string;
  active: boolean;
  requiresReference: boolean;
};

type ListingPaymentMethodForm = {
  name: string;
  settlement: string;
  status: string;
  active: boolean;
  requiresReference: boolean;
};

type ListingGroupCard = {
  id: string;
  name: string;
  source: "catalog" | "items";
  linkedCategoryCount: number;
  linkedItemCount: number;
};

type ListingCatalogState = {
  branchItems: Record<string, ListingItemRow[]>;
  ensureBranchItems: (branchId: string, rows: ListingItemRow[]) => void;
  setBranchItems: (branchId: string, rows: ListingItemRow[]) => void;
  updateBranchItems: (
    branchId: string,
    updater: (rows: ListingItemRow[]) => ListingItemRow[],
  ) => void;
};

type ListingDiscountState = {
  branchDiscounts: Record<string, ListingDiscountRule[]>;
  ensureBranchDiscounts: (
    branchId: string,
    rows: ListingDiscountRule[],
  ) => void;
  updateBranchDiscounts: (
    branchId: string,
    updater: (rows: ListingDiscountRule[]) => ListingDiscountRule[],
  ) => void;
};

type ListingPaymentMethodState = {
  branchPaymentMethods: Record<string, ListingPaymentMethodRule[]>;
  ensureBranchPaymentMethods: (
    branchId: string,
    rows: ListingPaymentMethodRule[],
  ) => void;
  updateBranchPaymentMethods: (
    branchId: string,
    updater: (rows: ListingPaymentMethodRule[]) => ListingPaymentMethodRule[],
  ) => void;
};

function hasBranchItems(
  branchItems: Record<string, ListingItemRow[]>,
  branchId: string,
) {
  return Object.prototype.hasOwnProperty.call(branchItems, branchId);
}

function hasBranchDiscounts(
  branchDiscounts: Record<string, ListingDiscountRule[]>,
  branchId: string,
) {
  return Object.prototype.hasOwnProperty.call(branchDiscounts, branchId);
}

function hasBranchPaymentMethods(
  branchPaymentMethods: Record<string, ListingPaymentMethodRule[]>,
  branchId: string,
) {
  return Object.prototype.hasOwnProperty.call(branchPaymentMethods, branchId);
}

const useListingCatalogStore = create<ListingCatalogState>()(
  persist(
    (set) => ({
      branchItems: {},
      ensureBranchItems: (branchId, rows) =>
        set((state) => {
          if (hasBranchItems(state.branchItems, branchId)) {
            return state;
          }

          return {
            branchItems: {
              ...state.branchItems,
              [branchId]: rows,
            },
          };
        }),
      setBranchItems: (branchId, rows) =>
        set((state) => ({
          branchItems: {
            ...state.branchItems,
            [branchId]: rows,
          },
        })),
      updateBranchItems: (branchId, updater) =>
        set((state) => ({
          branchItems: {
            ...state.branchItems,
            [branchId]: updater(state.branchItems[branchId] ?? []),
          },
        })),
    }),
    {
      name: "bigtime-pos-listing-catalog-v2",
      partialize: (state) => ({
        branchItems: state.branchItems,
      }),
    },
  ),
);

const useListingDiscountStore = create<ListingDiscountState>()(
  persist(
    (set) => ({
      branchDiscounts: {},
      ensureBranchDiscounts: (branchId, rows) =>
        set((state) => {
          if (hasBranchDiscounts(state.branchDiscounts, branchId)) {
            return state;
          }

          return {
            branchDiscounts: {
              ...state.branchDiscounts,
              [branchId]: rows,
            },
          };
        }),
      updateBranchDiscounts: (branchId, updater) =>
        set((state) => ({
          branchDiscounts: {
            ...state.branchDiscounts,
            [branchId]: updater(state.branchDiscounts[branchId] ?? []),
          },
        })),
    }),
    {
      name: "bigtime-pos-listing-discounts-v2",
      partialize: (state) => ({
        branchDiscounts: state.branchDiscounts,
      }),
    },
  ),
);

const useListingPaymentMethodStore = create<ListingPaymentMethodState>()(
  persist(
    (set) => ({
      branchPaymentMethods: {},
      ensureBranchPaymentMethods: (branchId, rows) =>
        set((state) => {
          if (hasBranchPaymentMethods(state.branchPaymentMethods, branchId)) {
            return state;
          }

          return {
            branchPaymentMethods: {
              ...state.branchPaymentMethods,
              [branchId]: rows,
            },
          };
        }),
      updateBranchPaymentMethods: (branchId, updater) =>
        set((state) => ({
          branchPaymentMethods: {
            ...state.branchPaymentMethods,
            [branchId]: updater(state.branchPaymentMethods[branchId] ?? []),
          },
        })),
    }),
    {
      name: "bigtime-pos-listing-payment-methods-v2",
      partialize: (state) => ({
        branchPaymentMethods: state.branchPaymentMethods,
      }),
    },
  ),
);

const supplementalItemRows: ListingItemRow[] = [];

function normalizeItemRows(
  items: Array<{
    id: string;
    name: string;
    categoryId: string;
    price: number;
    barcode: string;
    vatType: string;
  }>,
  categories: Array<{ id: string; name: string }>,
) {
  const categoryMap = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const liveRows: ListingItemRow[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    category: (
      categoryMap.get(item.categoryId) ?? "UNCATEGORIZED"
    ).toUpperCase(),
    price: item.price,
    cost: 0,
    barcode: item.barcode,
    vatType: item.vatType.replace("_", " "),
    sku: "",
    managedStock: false,
    saleItem: true,
    parentItem: "",
    rawMaterial: false,
  }));

  if (liveRows.length >= 10) {
    return liveRows;
  }

  return [...supplementalItemRows, ...liveRows];
}

function toCatalogLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function slugifyCatalogValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCatalogSnapshotPayload(
  branchId: string,
  itemRows: ListingItemRow[],
  baseCategories: Array<{
    id: string;
    name: string;
    color: string;
    groupName: string;
  }>,
) {
  const categoryMap = new Map(
    baseCategories.map((category) => [
      normalizeCategoryValue(category.name),
      {
        id: category.id,
        name: category.name,
        color: category.color,
        groupName: category.groupName,
      },
    ]),
  );

  for (const item of itemRows) {
    const normalizedCategory = normalizeCategoryValue(item.category);
    if (categoryMap.has(normalizedCategory)) {
      continue;
    }

    const index = categoryMap.size % catalogColorPalette.length;
    categoryMap.set(normalizedCategory, {
      id: `cat-${branchId}-${slugifyCatalogValue(normalizedCategory) || "general"}`,
      name: toCatalogLabel(normalizedCategory),
      color: catalogColorPalette[index],
      groupName: "General",
    });
  }

  const categories = Array.from(categoryMap.values()).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    groupName: category.groupName,
  }));

  return {
    categories,
    items: itemRows.map((item) => {
      const normalizedCategory = normalizeCategoryValue(item.category);
      const category = categoryMap.get(normalizedCategory);
      const sku = item.sku.trim();
      return {
        id: item.id,
        categoryId: category?.id ?? `cat-${branchId}-general`,
        name: item.name.trim(),
        sku: sku || slugifyCatalogValue(item.name).toUpperCase(),
        barcode: item.barcode.trim(),
        unit: "unit",
        price: Number(item.price.toFixed(2)),
        vatType: normalizeVatTypeValue(item.vatType).replace(/ /g, "_"),
        trackInventory: item.managedStock,
        hasVariants: false,
      };
    }),
  };
}

async function pushCatalogSnapshot(
  branchId: string,
  payload: ReturnType<typeof buildCatalogSnapshotPayload>,
) {
  return replaceCatalogSnapshot(branchId, payload);
}

function buildListingGroups(
  branchId: string,
  categories: Array<{
    id: string;
    name: string;
    color: string;
    groupName: string;
  }>,
  itemRows: ListingItemRow[],
) {
  const itemCounts = itemRows.reduce<Record<string, number>>(
    (accumulator, item) => {
      const normalizedName = normalizeCategoryValue(item.category);

      if (!normalizedName) {
        return accumulator;
      }

      accumulator[normalizedName] = (accumulator[normalizedName] ?? 0) + 1;
      return accumulator;
    },
    {},
  );

  const catalogGroupsMap = categories.reduce<Map<string, ListingGroupCard>>(
    (accumulator, category) => {
      const existingGroup = accumulator.get(category.groupName);

      if (existingGroup) {
        accumulator.set(category.groupName, {
          ...existingGroup,
          linkedCategoryCount: existingGroup.linkedCategoryCount + 1,
        });
        return accumulator;
      }

      accumulator.set(category.groupName, {
        id: `group-${branchId}-${category.groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: category.groupName,
        source: "catalog",
        linkedCategoryCount: 1,
        linkedItemCount: 0,
      });

      return accumulator;
    },
    new Map(),
  );

  const knownGroupNames = new Set(
    Array.from(catalogGroupsMap.values()).map((group) =>
      normalizeCategoryValue(group.name),
    ),
  );

  const autoGroups = Object.entries(itemCounts)
    .filter(([groupName]) => !knownGroupNames.has(groupName))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([groupName, linkedItemCount]) => ({
      id: `group-derived-${branchId}-${groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: groupName,
      source: "items" as const,
      linkedCategoryCount: 0,
      linkedItemCount,
    }));

  return [...catalogGroupsMap.values(), ...autoGroups];
}

function useListingBranchItems(
  branchId: string,
  catalogData:
    | {
        items: Array<{
          id: string;
          name: string;
          categoryId: string;
          price: number;
          barcode: string;
          vatType: string;
        }>;
        categories: Array<{
          id: string;
          name: string;
          color: string;
          groupName: string;
        }>;
      }
    | undefined,
) {
  const normalizedRows = useMemo(
    () =>
      normalizeItemRows(
        catalogData?.items ?? [],
        catalogData?.categories ?? [],
      ),
    [catalogData],
  );
  const storedItemRows = useListingCatalogStore(
    (state) => state.branchItems[branchId],
  );
  const setBranchItems = useListingCatalogStore(
    (state) => state.setBranchItems,
  );

  useEffect(() => {
    if (!catalogData) {
      return;
    }

    setBranchItems(branchId, normalizedRows);
  }, [branchId, catalogData, normalizedRows, setBranchItems]);

  return storedItemRows ?? normalizedRows;
}

function useListingBranchDiscounts(branchId: string) {
  const storedDiscounts = useListingDiscountStore(
    (state) => state.branchDiscounts[branchId],
  );
  const ensureBranchDiscounts = useListingDiscountStore(
    (state) => state.ensureBranchDiscounts,
  );

  useEffect(() => {
    ensureBranchDiscounts(branchId, discountRules);
  }, [branchId, ensureBranchDiscounts]);

  return storedDiscounts ?? discountRules;
}

function useListingBranchPaymentMethods(branchId: string) {
  const storedPaymentMethods = useListingPaymentMethodStore(
    (state) => state.branchPaymentMethods[branchId],
  );
  const ensureBranchPaymentMethods = useListingPaymentMethodStore(
    (state) => state.ensureBranchPaymentMethods,
  );

  useEffect(() => {
    ensureBranchPaymentMethods(branchId, paymentMethodBlueprint);
  }, [branchId, ensureBranchPaymentMethods]);

  return storedPaymentMethods ?? paymentMethodBlueprint;
}

function ItemTableSort({
  label,
  align = "left",
}: {
  label: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-2 ${align === "right" ? "justify-end" : "justify-start"}`}
    >
      <span>{label}</span>
      <ChevronsUpDown className="h-3.5 w-3.5 text-[color:var(--muted)]" />
    </div>
  );
}

function emptyItemForm(category = ""): ListingItemForm {
  return {
    name: "",
    category,
    price: "",
    cost: "",
    barcode: "",
    vatType: "VATABLE",
    sku: "",
    managedStock: false,
    saleItem: true,
    parentItem: "",
    rawMaterial: false,
  };
}

function emptyDiscountForm(): ListingDiscountForm {
  return {
    name: "",
    type: "Fixed percentage",
    value: "",
    birCode: "",
    auth: "Cashier can apply",
    active: true,
  };
}

function emptyPaymentMethodForm(): ListingPaymentMethodForm {
  return {
    name: "",
    settlement: "",
    status: "",
    active: true,
    requiresReference: false,
  };
}

function createItemId(prefix = "manual") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
}

function createDiscountId() {
  return `discount-${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
}

function createPaymentMethodId() {
  return `payment-${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
}

function normalizeCategoryValue(value: string) {
  return value.trim().toUpperCase();
}

function hexToRgb(color: string) {
  const fallback = { r: 59, g: 110, b: 246 };
  const trimmed = color.trim();
  const normalized = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;

  if (/^[\da-f]{3}$/i.test(normalized)) {
    const expanded = normalized
      .split("")
      .map((segment) => `${segment}${segment}`)
      .join("");
    const parsed = Number.parseInt(expanded, 16);
    return {
      r: (parsed >> 16) & 255,
      g: (parsed >> 8) & 255,
      b: parsed & 255,
    };
  }

  if (/^[\da-f]{6}$/i.test(normalized)) {
    const parsed = Number.parseInt(normalized, 16);
    return {
      r: (parsed >> 16) & 255,
      g: (parsed >> 8) & 255,
      b: parsed & 255,
    };
  }

  return fallback;
}

function shiftHexColor(color: string, amount: number) {
  const channelToHex = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");

  const rgb = hexToRgb(color);
  return `#${channelToHex(rgb.r + amount)}${channelToHex(rgb.g + amount)}${channelToHex(rgb.b + amount)}`;
}

function rgbaFromHex(color: string, alpha: number) {
  const rgb = hexToRgb(color);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function escapeSvgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type CategoryArtworkVariant =
  | "beverage"
  | "snack"
  | "bodycare"
  | "candy"
  | "canned"
  | "produce"
  | "household"
  | "default";

function resolveCategoryArtworkVariant(categoryName: string) {
  const normalized = normalizeCategoryValue(categoryName);

  if (
    normalized.includes("ALCOHOL") ||
    normalized.includes("BEVERAGE") ||
    normalized.includes("DRINK") ||
    normalized.includes("JUICE") ||
    normalized.includes("WATER") ||
    normalized.includes("COFFEE") ||
    normalized.includes("TEA")
  ) {
    return { variant: "beverage" as const, label: "Drinks aisle" };
  }

  if (
    normalized.includes("BISCUIT") ||
    normalized.includes("SNACK") ||
    normalized.includes("CHIPS") ||
    normalized.includes("BAKERY") ||
    normalized.includes("BREAD")
  ) {
    return { variant: "snack" as const, label: "Snack shelf" };
  }

  if (
    normalized.includes("BODY") ||
    normalized.includes("CARE") ||
    normalized.includes("SOAP") ||
    normalized.includes("HYGIENE") ||
    normalized.includes("TOILETRIES")
  ) {
    return { variant: "bodycare" as const, label: "Personal care" };
  }

  if (
    normalized.includes("CANDY") ||
    normalized.includes("SWEET") ||
    normalized.includes("CHOC") ||
    normalized.includes("CONFECTION")
  ) {
    return { variant: "candy" as const, label: "Sweet treats" };
  }

  if (
    normalized.includes("CAN") ||
    normalized.includes("GOODS") ||
    normalized.includes("TIN") ||
    normalized.includes("PRESERVE")
  ) {
    return { variant: "canned" as const, label: "Pantry cans" };
  }

  if (
    normalized.includes("FRUIT") ||
    normalized.includes("VEGETABLE") ||
    normalized.includes("PRODUCE") ||
    normalized.includes("FRESH")
  ) {
    return { variant: "produce" as const, label: "Fresh picks" };
  }

  if (
    normalized.includes("HOUSEHOLD") ||
    normalized.includes("CLEAN") ||
    normalized.includes("HOME") ||
    normalized.includes("LAUNDRY")
  ) {
    return { variant: "household" as const, label: "Home essentials" };
  }

  return { variant: "default" as const, label: "Store category" };
}

function renderCategoryArtworkShapes(
  variant: CategoryArtworkVariant,
  accent: string,
  highlight: string,
) {
  const accentSoft = rgbaFromHex(accent, 0.22);
  const accentStrong = rgbaFromHex(accent, 0.55);
  const highlightSoft = rgbaFromHex(highlight, 0.32);

  switch (variant) {
    case "beverage":
      return `
        <rect x="122" y="96" width="98" height="170" rx="34" fill="${rgbaFromHex("#ffffff", 0.18)}" />
        <rect x="150" y="58" width="42" height="54" rx="16" fill="${accentStrong}" />
        <rect x="167" y="44" width="8" height="24" rx="4" fill="${highlight}" />
        <rect x="280" y="126" width="122" height="140" rx="28" fill="${highlightSoft}" />
        <rect x="448" y="112" width="70" height="154" rx="22" fill="${accentSoft}" />
        <circle cx="474" cy="98" r="30" fill="${rgbaFromHex("#ffffff", 0.12)}" />
      `;
    case "snack":
      return `
        <circle cx="178" cy="154" r="72" fill="${rgbaFromHex("#ffffff", 0.16)}" />
        <circle cx="158" cy="134" r="8" fill="${accentStrong}" />
        <circle cx="214" cy="170" r="8" fill="${accentStrong}" />
        <circle cx="188" cy="198" r="8" fill="${accentStrong}" />
        <rect x="286" y="112" width="170" height="118" rx="28" fill="${highlightSoft}" />
        <rect x="312" y="138" width="20" height="20" rx="6" fill="${accentStrong}" />
        <rect x="354" y="172" width="20" height="20" rx="6" fill="${accentStrong}" />
        <rect x="392" y="136" width="20" height="20" rx="6" fill="${accentStrong}" />
      `;
    case "bodycare":
      return `
        <rect x="124" y="112" width="118" height="152" rx="36" fill="${rgbaFromHex("#ffffff", 0.16)}" />
        <rect x="154" y="84" width="58" height="48" rx="18" fill="${highlightSoft}" />
        <rect x="180" y="64" width="54" height="16" rx="8" fill="${accentStrong}" />
        <path d="M430 94C454 126 460 152 460 174C460 214 430 242 388 242C346 242 316 214 316 174C316 146 328 120 356 94C370 78 374 64 372 48C402 62 420 76 430 94Z" fill="${accentSoft}" />
        <circle cx="502" cy="114" r="22" fill="${rgbaFromHex("#ffffff", 0.14)}" />
        <circle cx="528" cy="164" r="12" fill="${rgbaFromHex("#ffffff", 0.1)}" />
      `;
    case "candy":
      return `
        <path d="M116 166L162 126H246L290 166L246 206H162L116 166Z" fill="${rgbaFromHex("#ffffff", 0.18)}" />
        <path d="M116 166L86 136V196L116 166Z" fill="${accentStrong}" />
        <path d="M290 166L320 136V196L290 166Z" fill="${highlightSoft}" />
        <circle cx="458" cy="154" r="54" fill="${accentSoft}" />
        <rect x="452" y="204" width="12" height="72" rx="6" fill="${rgbaFromHex("#ffffff", 0.18)}" />
      `;
    case "canned":
      return `
        <rect x="122" y="110" width="118" height="138" rx="20" fill="${rgbaFromHex("#ffffff", 0.16)}" />
        <ellipse cx="181" cy="110" rx="59" ry="16" fill="${highlightSoft}" />
        <ellipse cx="181" cy="248" rx="59" ry="16" fill="${accentStrong}" />
        <rect x="312" y="86" width="140" height="162" rx="22" fill="${accentSoft}" />
        <ellipse cx="382" cy="86" rx="70" ry="18" fill="${rgbaFromHex("#ffffff", 0.14)}" />
        <ellipse cx="382" cy="248" rx="70" ry="18" fill="${highlightSoft}" />
      `;
    case "produce":
      return `
        <path d="M176 242C128 242 94 210 94 166C94 122 128 90 176 90C224 90 258 122 258 166C258 210 224 242 176 242Z" fill="${rgbaFromHex("#ffffff", 0.16)}" />
        <path d="M172 92C174 68 188 52 214 44C214 72 204 90 172 92Z" fill="${highlightSoft}" />
        <path d="M366 232C312 232 276 196 276 148C308 138 340 134 372 134C430 134 482 152 518 186C484 214 432 232 366 232Z" fill="${accentSoft}" />
        <path d="M352 132C356 102 376 76 408 62C414 96 398 122 352 132Z" fill="${accentStrong}" />
      `;
    case "household":
      return `
        <path d="M146 248V140L214 96L246 116V248H146Z" fill="${rgbaFromHex("#ffffff", 0.16)}" />
        <rect x="202" y="80" width="38" height="52" rx="18" fill="${highlightSoft}" />
        <path d="M360 132H472L504 160L454 248H338L360 132Z" fill="${accentSoft}" />
        <rect x="382" y="92" width="44" height="36" rx="16" fill="${accentStrong}" />
      `;
    default:
      return `
        <rect x="108" y="104" width="134" height="144" rx="28" fill="${rgbaFromHex("#ffffff", 0.16)}" />
        <rect x="274" y="86" width="110" height="162" rx="30" fill="${accentSoft}" />
        <rect x="418" y="120" width="116" height="128" rx="26" fill="${highlightSoft}" />
      `;
  }
}

function buildCategoryPicture(categoryName: string, accentColor: string) {
  const accent = /^#/.test(accentColor) ? accentColor : "#3b6ef6";
  const deep = shiftHexColor(accent, -42);
  const highlight = shiftHexColor(accent, 48);
  const haze = rgbaFromHex(highlight, 0.34);
  const shadow = rgbaFromHex(deep, 0.26);
  const { variant, label } = resolveCategoryArtworkVariant(categoryName);
  const safeTitle = escapeSvgText(toCatalogLabel(categoryName));
  const safeLabel = escapeSvgText(label);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" fill="none">
      <defs>
        <linearGradient id="bg" x1="44" y1="36" x2="596" y2="324" gradientUnits="userSpaceOnUse">
          <stop stop-color="${highlight}" />
          <stop offset="0.58" stop-color="${accent}" />
          <stop offset="1" stop-color="${deep}" />
        </linearGradient>
        <filter id="blur" x="-120" y="-120" width="880" height="600" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="42" />
        </filter>
      </defs>
      <rect width="640" height="360" rx="36" fill="url(#bg)" />
      <g filter="url(#blur)">
        <circle cx="116" cy="66" r="96" fill="${haze}" />
        <circle cx="514" cy="62" r="88" fill="${rgbaFromHex("#ffffff", 0.16)}" />
        <circle cx="560" cy="304" r="120" fill="${shadow}" />
      </g>
      <rect x="26" y="26" width="588" height="308" rx="30" fill="${rgbaFromHex("#ffffff", 0.08)}" stroke="${rgbaFromHex("#ffffff", 0.22)}" />
      ${renderCategoryArtworkShapes(variant, accent, highlight)}
      <rect x="36" y="260" width="568" height="64" rx="24" fill="${rgbaFromHex("#0f172a", 0.18)}" stroke="${rgbaFromHex("#ffffff", 0.14)}" />
      <text x="64" y="286" fill="${rgbaFromHex("#ffffff", 0.72)}" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600" letter-spacing="2.4">${safeLabel.toUpperCase()}</text>
      <text x="64" y="312" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="700">${safeTitle}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function normalizeVatTypeValue(value: string) {
  const normalized = value.trim().replace(/_/g, " ").toUpperCase();

  if (
    normalized === "VAT EXEMPT" ||
    normalized === "ZERO RATED" ||
    normalized === "VATABLE"
  ) {
    return normalized;
  }

  return "VATABLE";
}

function parseMoneyValue(value: string) {
  const normalized = value.replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatDiscountValue(discount: ListingDiscountRule) {
  if (
    discount.type === "Fixed percentage" ||
    discount.type === "Promo markdown"
  ) {
    return `${discount.value.toFixed(discount.value % 1 === 0 ? 0 : 2)}%`;
  }

  return formatCurrency(discount.value);
}

function formatPaymentMethodReference(method: ListingPaymentMethodRule) {
  return method.requiresReference
    ? "Reference required"
    : "No reference required";
}

function createBarcodeValue(existingBarcodes: Set<string>) {
  const cryptoApi =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    let barcode = "";

    if (cryptoApi?.getRandomValues) {
      const randomValues = new Uint32Array(12);
      cryptoApi.getRandomValues(randomValues);
      barcode = Array.from(randomValues, (value) => String(value % 10)).join(
        "",
      );
    } else {
      barcode = String(Date.now() + Math.floor(Math.random() * 1_000_000))
        .replace(/\D/g, "")
        .padEnd(12, "0")
        .slice(0, 12);
    }

    if (!existingBarcodes.has(barcode)) {
      return barcode;
    }
  }

  return `${String(Date.now()).slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
}

function csvEscape(value: string | number) {
  const text = String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === ",") {
      row.push(field.trim());
      field = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      if (field.length > 0 || row.length > 0) {
        row.push(field.trim());
        rows.push(row);
      }

      field = "";
      row = [];
      continue;
    }

    field += character;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
}

function parseBooleanField(value: unknown, defaultValue = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const str = String(value ?? "")
    .trim()
    .toLowerCase();
  if (str === "yes" || str === "true" || str === "1" || str === "y")
    return true;
  if (
    str === "no" ||
    str === "false" ||
    str === "0" ||
    str === "n" ||
    str === ""
  )
    return defaultValue;
  return defaultValue;
}

function normalizeImportedRows(
  records: Array<Record<string, unknown>>,
  existingRows: ListingItemRow[],
) {
  const existingBarcodes = new Set(
    existingRows.map((item) => item.barcode).filter(Boolean),
  );

  return records
    .map((record, index) => {
      const objectEntries = Object.entries(record).map(([key, value]) => [
        key.toLowerCase().replace(/[\s_-]+/g, ""),
        value,
      ]);
      const normalizedRecord = Object.fromEntries(objectEntries);

      const rawName = String(
        normalizedRecord.name ?? normalizedRecord.itemname ?? "",
      ).trim();
      const rawNewName = String(normalizedRecord.newname ?? "").trim();
      const effectiveName = rawNewName || rawName;
      const rawCategory = String(
        normalizedRecord.category ?? normalizedRecord.categorygroup ?? "",
      ).trim();
      const rawPrice = String(normalizedRecord.price ?? "").trim();
      const rawCost = String(normalizedRecord.cost ?? "").trim();
      const rawBarcode = String(normalizedRecord.barcode ?? "").trim();
      const rawVatType = String(
        normalizedRecord.vattype ??
          normalizedRecord.vat ??
          normalizedRecord.taxtype ??
          "VATABLE",
      ).trim();
      const rawSku = String(normalizedRecord.sku ?? "").trim();
      const rawManagedStock =
        normalizedRecord.manageditemstock ??
        normalizedRecord.managedstock ??
        false;
      const rawSaleItem = normalizedRecord.saleitem ?? true;
      const rawParentItem = String(normalizedRecord.parentitem ?? "").trim();
      const rawRawMaterial = normalizedRecord.rawmaterial ?? false;

      if (!effectiveName || !rawCategory || !rawPrice) {
        return null;
      }

      const parsedPrice = parseMoneyValue(rawPrice);
      const parsedCost = rawCost
        ? parseMoneyValue(rawCost)
        : Number((parsedPrice * 0.65).toFixed(2));

      if (!Number.isFinite(parsedPrice) || !Number.isFinite(parsedCost)) {
        return null;
      }

      const barcode =
        rawBarcode && !existingBarcodes.has(rawBarcode)
          ? rawBarcode
          : createBarcodeValue(existingBarcodes);
      existingBarcodes.add(barcode);

      return {
        id: createItemId(`import-${index}`),
        name: effectiveName,
        category: normalizeCategoryValue(rawCategory),
        price: Number(parsedPrice.toFixed(2)),
        cost: Number(parsedCost.toFixed(2)),
        barcode,
        vatType: normalizeVatTypeValue(rawVatType),
        sku: rawSku,
        managedStock: parseBooleanField(rawManagedStock),
        saleItem: parseBooleanField(rawSaleItem, true),
        parentItem: rawParentItem,
        rawMaterial: parseBooleanField(rawRawMaterial),
      } satisfies ListingItemRow;
    })
    .filter((item): item is ListingItemRow => item !== null);
}

function exportItemsCsv(rows: ListingItemRow[]) {
  const csvContent = [
    [
      "Name",
      "Category",
      "Price",
      "Cost",
      "Barcode",
      "VAT Type",
      "SKU",
      "Managed Item Stock",
      "Sale Item",
      "Parent Item",
      "Raw Material",
    ].join(","),
    ...rows.map((item) =>
      [
        csvEscape(item.name),
        csvEscape(item.category),
        csvEscape(item.price.toFixed(2)),
        csvEscape(item.cost.toFixed(2)),
        csvEscape(item.barcode),
        csvEscape(item.vatType),
        csvEscape(item.sku ?? ""),
        csvEscape(String(item.managedStock ?? false)),
        csvEscape(String(item.saleItem ?? true)),
        csvEscape(item.parentItem ?? ""),
        csvEscape(String(item.rawMaterial ?? false)),
      ].join(","),
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "bigtime-pos-items.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function NoticeBanner({ notice }: { notice: ListingNotice }) {
  const toneClassName =
    notice.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : notice.tone === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-sky-200 bg-sky-50 text-sky-700";

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${toneClassName}`}
    >
      {notice.message}
    </div>
  );
}

function ModalFrame({
  title,
  description,
  onClose,
  children,
}: React.PropsWithChildren<{
  title: string;
  description: string;
  onClose: () => void;
}>) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
      <div className="dashboard-clean-card w-full max-w-2xl shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] px-5 py-4 sm:px-6">
          <div>
            <h2 className="section-title text-2xl font-bold text-slate-950">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border)] text-[color:var(--muted)] transition hover:bg-[color:var(--surface-soft)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ListingItemsPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const catalogQuery = useCatalog(selectedBranch);
  const data = catalogQuery.data;
  const refetchCatalog = catalogQuery.refetch;
  const itemRows = useListingBranchItems(selectedBranch, data);
  const updateBranchItems = useListingCatalogStore(
    (state) => state.updateBranchItems,
  );
  const [searchValue, setSearchValue] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<ListingNotice | null>(null);
  const [itemDialogMode, setItemDialogMode] = useState<"add" | "edit" | null>(
    null,
  );
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ListingItemForm>(emptyItemForm());
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const catalogSyncTimeoutRef = useRef<number | null>(null);
  const lastCatalogSyncSignatureRef = useRef<string | null>(null);
  const catalogDirtyRef = useRef(false);

  useEffect(() => {
    setSelectedIds([]);
    setPage(0);
    catalogDirtyRef.current = false;
    lastCatalogSyncSignatureRef.current = null;
  }, [selectedBranch]);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((itemId) => itemRows.some((item) => item.id === itemId)),
    );
  }, [itemRows]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (catalogSyncTimeoutRef.current) {
      window.clearTimeout(catalogSyncTimeoutRef.current);
      catalogSyncTimeoutRef.current = null;
    }

    if (!catalogDirtyRef.current || !data || selectedBranch === "all") {
      return undefined;
    }

    const payload = buildCatalogSnapshotPayload(
      selectedBranch,
      itemRows,
      data.categories ?? [],
    );
    const signature = JSON.stringify(payload);

    if (signature === lastCatalogSyncSignatureRef.current) {
      return undefined;
    }

    catalogSyncTimeoutRef.current = window.setTimeout(() => {
      void pushCatalogSnapshot(selectedBranch, payload)
        .then(() => {
          catalogDirtyRef.current = false;
          lastCatalogSyncSignatureRef.current = signature;
          void refetchCatalog();
        })
        .catch((error) => {
          setNotice({
            tone: "error",
            message:
              `Catalog sync failed. POS app will keep showing the last saved backend items. ${error instanceof Error ? error.message : ""}`.trim(),
          });
        })
        .finally(() => {
          catalogSyncTimeoutRef.current = null;
        });
    }, 350);

    return () => {
      if (catalogSyncTimeoutRef.current) {
        window.clearTimeout(catalogSyncTimeoutRef.current);
        catalogSyncTimeoutRef.current = null;
      }
    };
  }, [data, itemRows, refetchCatalog, selectedBranch]);

  const categoryOptions = useMemo(
    () => ["ALL", ...new Set(itemRows.map((item) => item.category))],
    [itemRows],
  );

  const filteredRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return itemRows.filter((item) => {
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [item.name, item.category, item.barcode]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [itemRows, searchValue, selectedCategory]);

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageStart = currentPage * pageSize;
  const pagedRows = filteredRows.slice(pageStart, pageStart + pageSize);
  const allVisibleSelected =
    pagedRows.length > 0 &&
    pagedRows.every((item) => selectedIds.includes(item.id));
  const selectedItems = itemRows.filter((item) =>
    selectedIds.includes(item.id),
  );
  const barcodeItems = selectedItems.length > 0 ? selectedItems : filteredRows;

  function mutateBranchItems(
    updater: (current: ListingItemRow[]) => ListingItemRow[],
  ) {
    catalogDirtyRef.current = true;
    updateBranchItems(selectedBranch, updater);
  }

  function toggleItem(itemId: string) {
    setSelectedIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  }

  function toggleVisibleItems() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !pagedRows.some((item) => item.id === id)),
      );
      return;
    }

    setSelectedIds((current) =>
      Array.from(new Set([...current, ...pagedRows.map((item) => item.id)])),
    );
  }

  function openAddDialog() {
    setEditingItemId(null);
    setItemForm(
      emptyItemForm(selectedCategory === "ALL" ? "" : selectedCategory),
    );
    setItemDialogMode("add");
    setRowMenuId(null);
  }

  function openEditDialog(item: ListingItemRow) {
    setEditingItemId(item.id);
    setItemForm({
      name: item.name,
      category: item.category,
      price: item.price.toFixed(2),
      cost: item.cost.toFixed(2),
      barcode: item.barcode,
      vatType: item.vatType,
      sku: item.sku ?? "",
      managedStock: item.managedStock ?? false,
      saleItem: item.saleItem ?? true,
      parentItem: item.parentItem ?? "",
      rawMaterial: item.rawMaterial ?? false,
    });
    setItemDialogMode("edit");
    setRowMenuId(null);
  }

  function closeItemDialog() {
    setItemDialogMode(null);
    setEditingItemId(null);
  }

  function saveItem() {
    if (selectedBranch === "all") {
      setNotice({
        tone: "info",
        message:
          "Select a specific branch before saving items that need to sync to the POS app.",
      });
      return;
    }

    const trimmedName = itemForm.name.trim();
    const normalizedCategory = normalizeCategoryValue(itemForm.category);
    const parsedPrice = parseMoneyValue(itemForm.price);
    const parsedCost = itemForm.cost
      ? parseMoneyValue(itemForm.cost)
      : Number((parsedPrice * 0.65).toFixed(2));

    if (!trimmedName || !normalizedCategory) {
      setNotice({
        tone: "error",
        message: "Name and category are required before saving an item.",
      });
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setNotice({
        tone: "error",
        message: "Price must be a valid amount greater than zero.",
      });
      return;
    }

    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      setNotice({
        tone: "error",
        message: "Cost must be a valid amount equal to or greater than zero.",
      });
      return;
    }

    const reservedBarcodes = new Set(
      itemRows
        .filter((item) => item.id !== editingItemId)
        .map((item) => item.barcode)
        .filter(Boolean),
    );
    const barcode =
      itemForm.barcode.trim() || createBarcodeValue(reservedBarcodes);

    if (reservedBarcodes.has(barcode)) {
      setNotice({
        tone: "error",
        message:
          "Barcode must be unique. Use Barcode Generator or enter a different code.",
      });
      return;
    }

    const nextRow: ListingItemRow = {
      id: editingItemId ?? createItemId("item"),
      name: trimmedName,
      category: normalizedCategory,
      price: Number(parsedPrice.toFixed(2)),
      cost: Number(parsedCost.toFixed(2)),
      barcode,
      vatType: normalizeVatTypeValue(itemForm.vatType),
      sku: itemForm.sku.trim(),
      managedStock: itemForm.managedStock,
      saleItem: itemForm.saleItem,
      parentItem: itemForm.parentItem.trim(),
      rawMaterial: itemForm.rawMaterial,
    };

    mutateBranchItems((current) =>
      itemDialogMode === "edit"
        ? current.map((item) => (item.id === editingItemId ? nextRow : item))
        : [nextRow, ...current],
    );
    setNotice({
      tone: "success",
      message:
        itemDialogMode === "edit"
          ? `Updated ${nextRow.name}.`
          : `Added ${nextRow.name} to the item list.`,
    });
    closeItemDialog();
  }

  function deleteItem(item: ListingItemRow) {
    if (selectedBranch === "all") {
      setNotice({
        tone: "info",
        message:
          "Select a specific branch before deleting items that need to sync to the POS app.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Delete ${item.name}? This removes it from the branch catalog and the POS app after sync.`,
    );
    if (!confirmed) {
      return;
    }

    mutateBranchItems((current) =>
      current.filter((currentItem) => currentItem.id !== item.id),
    );
    setSelectedIds((current) => current.filter((itemId) => itemId !== item.id));
    setRowMenuId(null);
    setNotice({
      tone: "success",
      message: `${item.name} was removed from the current item list.`,
    });
  }

  function exportCurrentItems() {
    if (filteredRows.length === 0) {
      setNotice({
        tone: "info",
        message: "There are no filtered items to export.",
      });
      return;
    }

    exportItemsCsv(filteredRows);
    setNotice({
      tone: "success",
      message: `Exported ${filteredRows.length} item${filteredRows.length === 1 ? "" : "s"} to CSV.`,
    });
  }

  async function importItems(event: React.ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!file) {
      return;
    }

    if (selectedBranch === "all") {
      setNotice({
        tone: "info",
        message:
          "Select a specific branch before importing items that need to sync to the POS app.",
      });
      return;
    }

    try {
      let importedRows: ListingItemRow[] = [];
      const fileName = file.name.toLowerCase();

      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Import files must be 5 MB or smaller.");
      }

      const text = await file.text();

      if (fileName.endsWith(".json") || text.trim().startsWith("[")) {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          throw new Error("JSON import expects an array of item objects.");
        }
        importedRows = normalizeImportedRows(parsed, itemRows);
      } else {
        const csvRows = parseCsvRows(text);
        if (csvRows.length < 2) {
          throw new Error(
            "CSV import requires a header row and at least one data row.",
          );
        }

        const [headerRow, ...dataRows] = csvRows;
        const records = dataRows.map((row) =>
          Object.fromEntries(
            headerRow.map((header, index) => [header, row[index] ?? ""]),
          ),
        );
        importedRows = normalizeImportedRows(records, itemRows);
      }

      if (importedRows.length === 0) {
        throw new Error("No valid rows were found in the file.");
      }

      mutateBranchItems((current) => [
        ...importedRows,
        ...current,
      ]);
      setPage(0);
      setNotice({
        tone: "success",
        message: `Imported ${importedRows.length} item${importedRows.length === 1 ? "" : "s"} from ${file.name}.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Import failed. Check the file format and try again.";
      setNotice({
        tone: "error",
        message,
      });
    }
  }

  async function copyBarcode(barcode: string) {
    try {
      await navigator.clipboard.writeText(barcode);
      setNotice({
        tone: "success",
        message: `Copied barcode ${barcode}.`,
      });
    } catch {
      setNotice({
        tone: "error",
        message: "Copy failed. Your browser blocked clipboard access.",
      });
    }
  }

  function regenerateBarcodes(targetIds: string[]) {
    if (targetIds.length === 0) {
      setNotice({
        tone: "info",
        message:
          "Select items first or filter the list before opening Barcode Generator.",
      });
      return;
    }

    if (selectedBranch === "all") {
      setNotice({
        tone: "info",
        message:
          "Select a specific branch before updating barcodes that need to sync to the POS app.",
      });
      return;
    }

    mutateBranchItems((current) => {
      const activeIds = new Set(targetIds);
      const nextBarcodes = new Set(
        current
          .filter((item) => !activeIds.has(item.id))
          .map((item) => item.barcode)
          .filter(Boolean),
      );

      return current.map((item) => {
        if (!activeIds.has(item.id)) {
          return item;
        }

        const barcode = createBarcodeValue(nextBarcodes);
        nextBarcodes.add(barcode);
        return {
          ...item,
          barcode,
        };
      });
    });
    setNotice({
      tone: "success",
      message: `Generated barcode${targetIds.length === 1 ? "" : "s"} for ${targetIds.length} item${targetIds.length === 1 ? "" : "s"}.`,
    });
  }

  function openBarcodeGenerator() {
    if (barcodeItems.length === 0) {
      setNotice({
        tone: "info",
        message: "There are no items available for barcode generation.",
      });
      return;
    }

    setBarcodeDialogOpen(true);
    setRowMenuId(null);
  }

  return (
    <div className="readable-white-route space-y-6">
      <div className="dashboard-clean-card px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="section-title text-3xl font-bold text-slate-950">
              Items
            </h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Manage your BIGTIME POS items here. Add, edit, and delete items as
              needed.
            </p>
          </div>

          {notice ? <NoticeBanner notice={notice} /> : null}

          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="hidden"
            onChange={importItems}
          />

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative block w-full lg:w-[280px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
                <input
                  value={searchValue}
                  onChange={(event) => {
                    setSearchValue(event.target.value);
                    setPage(0);
                  }}
                  placeholder="Search ..."
                  className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                />
              </label>

              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(event) => {
                    setSelectedCategory(event.target.value);
                    setPage(0);
                  }}
                  className="h-12 min-w-[180px] appearance-none rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] pl-11 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-300"
                >
                  <option value="ALL">Category</option>
                  {categoryOptions
                    .filter((category) => category !== "ALL")
                    .map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                </select>
                <Plus className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={exportCurrentItems}
                disabled={filteredRows.length === 0}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-slate-800 transition hover:bg-[color:var(--surface-soft)]"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-slate-800 transition hover:bg-[color:var(--surface-soft)]"
              >
                <Upload className="h-4 w-4" />
                Import
              </button>
              <button
                type="button"
                onClick={openBarcodeGenerator}
                disabled={barcodeItems.length === 0}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-slate-800 transition hover:bg-[color:var(--surface-soft)]"
              >
                <Barcode className="h-4 w-4" />
                Barcode Generator
              </button>
              <button
                type="button"
                onClick={openAddDialog}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-slate-800 transition hover:bg-[color:var(--surface-soft)]"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>

          <div className="dashboard-clean-card relative rounded-[22px]">
            <div className="hidden overflow-x-auto lg:block">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[52px_minmax(360px,2.4fr)_minmax(220px,1.2fr)_minmax(140px,0.8fr)_minmax(140px,0.8fr)_64px] items-center gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm font-medium text-[color:var(--muted)]">
                  <div>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleVisibleItems}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
                    />
                  </div>
                  <ItemTableSort label="Name" />
                  <ItemTableSort label="Category" />
                  <ItemTableSort label="Price" align="right" />
                  <ItemTableSort label="Cost" align="right" />
                  <div />
                </div>

                <div className="divide-y divide-[color:var(--border)]">
                  {pagedRows.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[52px_minmax(360px,2.4fr)_minmax(220px,1.2fr)_minmax(140px,0.8fr)_minmax(140px,0.8fr)_64px] items-center gap-4 px-4 py-4 text-sm text-slate-900"
                    >
                      <div>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleItem(item.id)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.name}</p>
                      </div>
                      <div className="font-medium text-slate-700">
                        {item.category}
                      </div>
                      <div className="text-right font-medium">
                        {formatCurrency(item.price)}
                      </div>
                      <div className="text-right font-medium text-slate-700">
                        {formatCurrency(item.cost)}
                      </div>
                      <div className="relative flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setRowMenuId((current) =>
                              current === item.id ? null : item.id,
                            )
                          }
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[color:var(--muted)] transition hover:bg-[color:var(--header-tint)] hover:text-slate-800"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {rowMenuId === item.id ? (
                          <div className="absolute right-0 top-11 z-10 w-44 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                            <button
                              type="button"
                              onClick={() => openEditDialog(item)}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit item
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedIds([item.id]);
                                setRowMenuId(null);
                                setBarcodeDialogOpen(true);
                              }}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                            >
                              <Barcode className="h-4 w-4" />
                              Barcode
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteItem(item)}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 p-3 lg:hidden">
              {pagedRows.map((item) => (
                <article
                  key={item.id}
                  className="dashboard-clean-card-subtle p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleItem(item.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {item.name}
                        </p>
                        <p className="mt-1 text-sm text-[color:var(--muted)]">
                          {item.category}
                        </p>
                      </div>
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setRowMenuId((current) =>
                            current === item.id ? null : item.id,
                          )
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[color:var(--muted)] transition hover:bg-[color:var(--header-tint)] hover:text-slate-800"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {rowMenuId === item.id ? (
                        <div className="absolute right-0 top-11 z-10 w-44 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                          <button
                            type="button"
                            onClick={() => openEditDialog(item)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit item
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIds([item.id]);
                              setRowMenuId(null);
                              setBarcodeDialogOpen(true);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                          >
                            <Barcode className="h-4 w-4" />
                            Barcode
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[color:var(--muted)]">Price</p>
                      <p className="font-medium text-slate-900">
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[color:var(--muted)]">Cost</p>
                      <p className="font-medium text-slate-900">
                        {formatCurrency(item.cost)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-[color:var(--border)] pt-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
              <span className="font-medium">No. of rows</span>
              <div className="relative">
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(0);
                  }}
                  className="h-10 min-w-[80px] appearance-none rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-3 pr-8 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                >
                  {[10, 20, 30].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:justify-end">
              <p className="text-sm text-slate-700">
                {totalRows === 0 ? 0 : pageStart + 1}-
                {Math.min(pageStart + pageSize, totalRows)} of {totalRows}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(0)}
                  disabled={currentPage === 0}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border)] text-slate-700 transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                  disabled={currentPage === 0}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border)] text-slate-700 transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((value) => Math.min(totalPages - 1, value + 1))
                  }
                  disabled={currentPage >= totalPages - 1}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border)] text-slate-700 transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(totalPages - 1)}
                  disabled={currentPage >= totalPages - 1}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border)] text-slate-700 transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {itemDialogMode ? (
        <ModalFrame
          title={itemDialogMode === "add" ? "Add Item" : "Edit Item"}
          description={
            itemDialogMode === "add"
              ? "Create a new item in the dashboard item list."
              : "Update the selected item in the dashboard item list."
          }
          onClose={closeItemDialog}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input
                value={itemForm.name}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="Item name"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Category
              </span>
              <input
                value={itemForm.category}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                list="listing-item-category-options"
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="KOREAN PRODUCTS"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Price</span>
              <input
                value={itemForm.price}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    price: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="0.00"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Cost</span>
              <input
                value={itemForm.cost}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    cost: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="Optional"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Barcode
              </span>
              <div className="flex gap-2">
                <input
                  value={itemForm.barcode}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      barcode: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                  placeholder="Generated automatically if blank"
                />
                <button
                  type="button"
                  onClick={() =>
                    setItemForm((current) => ({
                      ...current,
                      barcode: createBarcodeValue(
                        new Set(
                          itemRows
                            .filter((item) => item.id !== editingItemId)
                            .map((item) => item.barcode)
                            .filter(Boolean),
                        ),
                      ),
                    }))
                  }
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[color:var(--border)] px-4 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                >
                  <Barcode className="h-4 w-4" />
                  Generate
                </button>
              </div>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                VAT Type
              </span>
              <select
                value={itemForm.vatType}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    vatType: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
              >
                <option value="VATABLE">VATABLE</option>
                <option value="VAT EXEMPT">VAT EXEMPT</option>
                <option value="ZERO RATED">ZERO RATED</option>
              </select>
            </label>
          </div>

          {/* Additional Details */}
          <div className="mt-4 border-t border-[color:var(--border)] pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
              Additional Details
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">SKU</span>
                <input
                  value={itemForm.sku}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      sku: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                  placeholder="Optional"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Parent Item
                </span>
                <input
                  value={itemForm.parentItem}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      parentItem: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                  placeholder="Optional"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-6">
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={itemForm.managedStock}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      managedStock: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
                />
                <span className="text-sm font-medium text-slate-700">
                  Managed Stock
                </span>
              </label>
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={itemForm.saleItem}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      saleItem: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
                />
                <span className="text-sm font-medium text-slate-700">
                  Sale Item
                </span>
              </label>
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={itemForm.rawMaterial}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      rawMaterial: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
                />
                <span className="text-sm font-medium text-slate-700">
                  Raw Material
                </span>
              </label>
            </div>
          </div>

          <datalist id="listing-item-category-options">
            {categoryOptions
              .filter((category) => category !== "ALL")
              .map((category) => (
                <option key={category} value={category} />
              ))}
          </datalist>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeItemDialog}
              className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveItem}
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {itemDialogMode === "add" ? "Add Item" : "Save Changes"}
            </button>
          </div>
        </ModalFrame>
      ) : null}

      {barcodeDialogOpen ? (
        <ModalFrame
          title="Barcode Generator"
          description={
            selectedItems.length > 0
              ? `Managing ${selectedItems.length} selected item barcode${selectedItems.length === 1 ? "" : "s"}.`
              : `Managing ${barcodeItems.length} filtered item barcode${barcodeItems.length === 1 ? "" : "s"}.`
          }
          onClose={() => setBarcodeDialogOpen(false)}
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[color:var(--muted)]">
                Generate missing barcodes, regenerate existing ones, or copy
                individual codes.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    regenerateBarcodes(barcodeItems.map((item) => item.id))
                  }
                  className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                >
                  Regenerate All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBranch === "all") {
                      setNotice({
                        tone: "info",
                        message:
                          "Select a specific branch before generating barcodes that need to sync to the POS app.",
                      });
                      return;
                    }

                    mutateBranchItems((current) => {
                      const targetedIds = new Set(
                        barcodeItems.map((item) => item.id),
                      );
                      const existingBarcodes = new Set(
                        current
                          .filter((item) => !targetedIds.has(item.id))
                          .map((item) => item.barcode)
                          .filter(Boolean),
                      );

                      return current.map((item) => {
                        if (!targetedIds.has(item.id) || item.barcode) {
                          if (item.barcode) {
                            existingBarcodes.add(item.barcode);
                          }
                          return item;
                        }

                        const barcode = createBarcodeValue(existingBarcodes);
                        existingBarcodes.add(barcode);
                        return { ...item, barcode };
                      });
                    });
                    setNotice({
                      tone: "success",
                      message:
                        "Generated missing barcodes for the current barcode scope.",
                    });
                  }}
                  className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Generate Missing
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {barcodeItems.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)]/60 p-4"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {item.name}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        {item.category}
                      </p>
                      <p className="mt-3 font-mono text-lg tracking-[0.22em] text-slate-900">
                        {item.barcode || "NO BARCODE"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyBarcode(item.barcode)}
                        disabled={!item.barcode}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--panel-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => regenerateBarcodes([item.id])}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--panel-strong)]"
                      >
                        <Barcode className="h-4 w-4" />
                        Regenerate
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </ModalFrame>
      ) : null}
    </div>
  );
}

export function ListingCategoryPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const catalogQuery = useCatalog(selectedBranch);
  const data = catalogQuery.data;
  const itemRows = useListingBranchItems(selectedBranch, data);
  const categories = useMemo(() => {
    const baseCategories = data?.categories ?? [];
    const itemCounts = itemRows.reduce<Record<string, number>>(
      (accumulator, item) => {
        const normalizedName = normalizeCategoryValue(item.category);
        accumulator[normalizedName] = (accumulator[normalizedName] ?? 0) + 1;
        return accumulator;
      },
      {},
    );

    return baseCategories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      groupName: category.groupName,
      source: "catalog" as const,
      itemCount: itemCounts[normalizeCategoryValue(category.name)] ?? 0,
    }));
  }, [data?.categories, itemRows]);

  return (
    <ListingShell
      eyebrow="Listing"
      title="Category"
      description="Organize terminal-facing menu sections and assign them to their top-level category groups."
    >
      <SectionCard
        title="Category list"
        description="Categories control the cashier-facing tabs and drive how items are grouped on the POS."
        action={<ListingBadge value={`${categories.length} categories`} />}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <article
              key={category.id}
              className="overflow-hidden rounded-[32px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] shadow-[0_18px_50px_rgba(15,23,42,0.07)]"
            >
              <div className="relative h-44 overflow-hidden">
                <img
                  src={buildCategoryPicture(category.name, category.color)}
                  alt={`${category.name} category artwork`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
                  <span className="rounded-full bg-white/18 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                    {category.groupName}
                  </span>
                  <span
                    className="h-11 w-11 rounded-2xl border border-white/35 shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${shiftHexColor(category.color, 38)}, ${shiftHexColor(category.color, -18)})`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <p className="section-title text-xl font-bold">
                    {category.name}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    Used to group cashier-facing items under{" "}
                    {category.groupName}.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-[color:var(--bg-soft)] px-4 py-3 text-sm">
                  <span className="font-medium text-slate-700">
                    {category.itemCount} linked item
                    {category.itemCount === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full bg-[color:var(--panel-strong)] px-3 py-1 font-semibold text-[color:var(--ink)]">
                    Live on POS
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </ListingShell>
  );
}

export function ListingCategoryGroupPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const catalogQuery = useCatalog(selectedBranch);
  const itemRows = useListingBranchItems(selectedBranch, catalogQuery.data);
  const groups = useMemo(
    () =>
      buildListingGroups(
        selectedBranch,
        catalogQuery.data?.categories ?? [],
        itemRows,
      ),
    [catalogQuery.data?.categories, itemRows, selectedBranch],
  );
  const autoGroupCount = groups.filter(
    (group) => group.source === "items",
  ).length;

  return (
    <ListingShell
      eyebrow="Listing"
      title="Category Group"
      description="Group categories into higher-level menu buckets that shape the navigation model on the terminal."
    >
      <SectionCard
        title="Category groups"
        description="These groups represent the topmost menu buckets for cashier browsing and reporting. Uploaded item categories are added here automatically as groups."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ListingBadge value={`${groups.length} groups`} />
            {autoGroupCount > 0 ? (
              <ListingBadge value={`${autoGroupCount} auto-created`} />
            ) : null}
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <article key={group.id} className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
              <div className="flex items-center gap-3">
                <FolderTree className="h-5 w-5 text-[color:var(--accent)]" />
                <div>
                  <p className="section-title text-xl font-bold">
                    {group.name}
                  </p>
                  <p className="text-sm text-[color:var(--muted)]">
                    {group.source === "items"
                      ? "Auto-created from Items"
                      : "Catalog-defined group"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-[color:var(--muted)]">
                <span>
                  {group.source === "items"
                    ? `${group.linkedItemCount} linked item${group.linkedItemCount === 1 ? "" : "s"}`
                    : `${group.linkedCategoryCount} linked categor${group.linkedCategoryCount === 1 ? "y" : "ies"}`}
                </span>
                {group.source === "items" ? (
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                    Auto
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </ListingShell>
  );
}

export function ListingDiscountsPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const discountRows = useListingBranchDiscounts(selectedBranch);
  const updateBranchDiscounts = useListingDiscountStore(
    (state) => state.updateBranchDiscounts,
  );
  const [searchValue, setSearchValue] = useState("");
  const [notice, setNotice] = useState<ListingNotice | null>(null);
  const [discountDialogMode, setDiscountDialogMode] = useState<
    "add" | "edit" | null
  >(null);
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(
    null,
  );
  const [discountForm, setDiscountForm] =
    useState<ListingDiscountForm>(emptyDiscountForm());

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const filteredDiscounts = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    if (!query) {
      return discountRows;
    }

    return discountRows.filter((discount) =>
      [discount.name, discount.type, discount.birCode, discount.auth]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [discountRows, searchValue]);

  function openAddDiscountDialog() {
    setEditingDiscountId(null);
    setDiscountForm(emptyDiscountForm());
    setDiscountDialogMode("add");
  }

  function openEditDiscountDialog(discount: ListingDiscountRule) {
    setEditingDiscountId(discount.id);
    setDiscountForm({
      name: discount.name,
      type: discount.type,
      value: discount.value.toString(),
      birCode: discount.birCode,
      auth: discount.auth,
      active: discount.active,
    });
    setDiscountDialogMode("edit");
  }

  function closeDiscountDialog() {
    setDiscountDialogMode(null);
    setEditingDiscountId(null);
  }

  function saveDiscount() {
    const trimmedName = discountForm.name.trim();
    const trimmedBirCode = discountForm.birCode.trim().toUpperCase();
    const parsedValue = parseMoneyValue(discountForm.value);

    if (!trimmedName || !trimmedBirCode) {
      setNotice({
        tone: "error",
        message: "Discount name and BIR code are required.",
      });
      return;
    }

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      setNotice({
        tone: "error",
        message: "Discount value must be greater than zero.",
      });
      return;
    }

    const hasDuplicateName = discountRows.some(
      (discount) =>
        discount.id !== editingDiscountId &&
        discount.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

    if (hasDuplicateName) {
      setNotice({
        tone: "error",
        message:
          "A discount with the same name already exists on this branch view.",
      });
      return;
    }

    const nextDiscount: ListingDiscountRule = {
      id: editingDiscountId ?? createDiscountId(),
      name: trimmedName,
      type: discountForm.type,
      value: Number(parsedValue.toFixed(2)),
      birCode: trimmedBirCode,
      auth: discountForm.auth.trim() || "Cashier can apply",
      active: discountForm.active,
    };

    updateBranchDiscounts(selectedBranch, (current) =>
      discountDialogMode === "edit"
        ? current.map((discount) =>
            discount.id === editingDiscountId ? nextDiscount : discount,
          )
        : [nextDiscount, ...current],
    );
    setNotice({
      tone: "success",
      message:
        discountDialogMode === "edit"
          ? `Updated ${nextDiscount.name}.`
          : `Added ${nextDiscount.name} to discount rules.`,
    });
    closeDiscountDialog();
  }

  function toggleDiscountStatus(discount: ListingDiscountRule) {
    updateBranchDiscounts(selectedBranch, (current) =>
      current.map((currentDiscount) =>
        currentDiscount.id === discount.id
          ? { ...currentDiscount, active: !currentDiscount.active }
          : currentDiscount,
      ),
    );
    setNotice({
      tone: "success",
      message: `${discount.name} was ${discount.active ? "disabled" : "enabled"}.`,
    });
  }

  function deleteDiscount(discount: ListingDiscountRule) {
    const confirmed = window.confirm(`Delete ${discount.name}?`);

    if (!confirmed) {
      return;
    }

    updateBranchDiscounts(selectedBranch, (current) =>
      current.filter((currentDiscount) => currentDiscount.id !== discount.id),
    );
    setNotice({
      tone: "success",
      message: `${discount.name} was removed from discount rules.`,
    });
  }

  return (
    <ListingShell
      eyebrow="Listing"
      title="Discounts"
      description="Configure cashier-available discount rules, BIR mappings, and approval requirements."
    >
      <SectionCard
        title="Discount rules"
        description="Discounts stay explicit so reports, VAT buckets, and cashier approvals remain auditable."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <ListingBadge value={`${discountRows.length} discount rules`} />
            <button
              type="button"
              onClick={openAddDiscountDialog}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-slate-800 transition hover:bg-[color:var(--surface-soft)]"
            >
              <Plus className="h-4 w-4" />
              Add Discount
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {notice ? <NoticeBanner notice={notice} /> : null}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search discount name, type, BIR code, approval"
                className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              />
            </label>
            <button
              type="button"
              onClick={openAddDiscountDialog}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New Discount
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredDiscounts.map((discount) => (
              <article
                key={discount.id}
                className="rounded-3xl bg-[color:var(--surface-soft)] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <BadgePercent className="h-5 w-5 text-[color:var(--accent)]" />
                    <div>
                      <p className="section-title text-xl font-bold">
                        {discount.name}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        {discount.type}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                      discount.active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-[color:var(--header-tint)] text-[color:var(--muted)]"
                    }`}
                  >
                    {discount.active ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                  <p>Value: {formatDiscountValue(discount)}</p>
                  <p>BIR code: {discount.birCode}</p>
                  <p>{discount.auth}</p>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditDiscountDialog(discount)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDiscountStatus(discount)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                  >
                    {discount.active ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteDiscount(discount)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          {filteredDiscounts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-6 text-sm text-[color:var(--muted)]">
              No discounts match the current filter.
            </div>
          ) : null}
        </div>
      </SectionCard>

      {discountDialogMode ? (
        <ModalFrame
          title={
            discountDialogMode === "add" ? "Add Discount" : "Edit Discount"
          }
          description="Create or update a cashier-facing discount rule with its value, BIR code, and approval flow."
          onClose={closeDiscountDialog}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Discount name
              </span>
              <input
                value={discountForm.name}
                onChange={(event) =>
                  setDiscountForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="Senior Citizen 20%"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Discount type
              </span>
              <select
                value={discountForm.type}
                onChange={(event) =>
                  setDiscountForm((current) => ({
                    ...current,
                    type: event.target.value as ListingDiscountRule["type"],
                  }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
              >
                <option value="Fixed percentage">Fixed percentage</option>
                <option value="Fixed amount">Fixed amount</option>
                <option value="Promo markdown">Promo markdown</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {discountForm.type === "Fixed amount" ? "Amount" : "Percentage"}
              </span>
              <input
                value={discountForm.value}
                onChange={(event) =>
                  setDiscountForm((current) => ({
                    ...current,
                    value: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder={
                  discountForm.type === "Fixed amount" ? "100.00" : "20"
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                BIR code
              </span>
              <input
                value={discountForm.birCode}
                onChange={(event) =>
                  setDiscountForm((current) => ({
                    ...current,
                    birCode: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm uppercase text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="SC"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Approval flow
              </span>
              <select
                value={discountForm.auth}
                onChange={(event) =>
                  setDiscountForm((current) => ({
                    ...current,
                    auth: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
              >
                <option value="Cashier can apply">Cashier can apply</option>
                <option value="Supervisor approval required">
                  Supervisor approval required
                </option>
                <option value="Manager approval required">
                  Manager approval required
                </option>
              </select>
            </label>
            <label className="sm:col-span-2 flex items-center gap-3 rounded-2xl border border-[color:var(--border)] px-4 py-3">
              <input
                type="checkbox"
                checked={discountForm.active}
                onChange={(event) =>
                  setDiscountForm((current) => ({
                    ...current,
                    active: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Active on cashier screens
                </p>
                <p className="text-xs text-[color:var(--muted)]">
                  Disabled discounts stay in the list but cannot be applied at
                  POS.
                </p>
              </div>
            </label>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeDiscountDialog}
              className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveDiscount}
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {discountDialogMode === "add" ? "Add Discount" : "Save Changes"}
            </button>
          </div>
        </ModalFrame>
      ) : null}
    </ListingShell>
  );
}

export function ListingTaxesPage() {
  return (
    <ListingShell
      eyebrow="Listing"
      title="Taxes"
      description="Maintain VAT profiles and tax code mappings before they are assigned to catalog items and reported downstream."
    >
      <SectionCard
        title="Tax profiles"
        description="Tax profiles drive VAT treatment, reporting buckets, and compliance output."
        action={<ListingBadge value={`${taxProfiles.length} tax profiles`} />}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {taxProfiles.map((tax) => (
            <article key={tax.name} className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
              <div className="flex items-center gap-3">
                <Landmark className="h-5 w-5 text-[color:var(--accent)]" />
                <div>
                  <p className="section-title text-xl font-bold">{tax.name}</p>
                  <p className="text-sm text-[color:var(--muted)]">
                    {tax.scope}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                <p>Rate: {tax.rate}</p>
                <p>BIR code: {tax.birCode}</p>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </ListingShell>
  );
}

export function ListingPaymentMethodPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const paymentMethods = useListingBranchPaymentMethods(selectedBranch);
  const updateBranchPaymentMethods = useListingPaymentMethodStore(
    (state) => state.updateBranchPaymentMethods,
  );
  const [searchValue, setSearchValue] = useState("");
  const [notice, setNotice] = useState<ListingNotice | null>(null);
  const [paymentDialogMode, setPaymentDialogMode] = useState<
    "add" | "edit" | null
  >(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentMethodForm, setPaymentMethodForm] =
    useState<ListingPaymentMethodForm>(emptyPaymentMethodForm());

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const filteredPaymentMethods = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    if (!query) {
      return paymentMethods;
    }

    return paymentMethods.filter((method) =>
      [method.name, method.settlement, method.status]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [paymentMethods, searchValue]);

  function openAddPaymentDialog() {
    setEditingPaymentId(null);
    setPaymentMethodForm(emptyPaymentMethodForm());
    setPaymentDialogMode("add");
  }

  function openEditPaymentDialog(method: ListingPaymentMethodRule) {
    setEditingPaymentId(method.id);
    setPaymentMethodForm({
      name: method.name,
      settlement: method.settlement,
      status: method.status,
      active: method.active,
      requiresReference: method.requiresReference,
    });
    setPaymentDialogMode("edit");
  }

  function closePaymentDialog() {
    setPaymentDialogMode(null);
    setEditingPaymentId(null);
  }

  function savePaymentMethod() {
    const trimmedName = paymentMethodForm.name.trim();
    const trimmedSettlement = paymentMethodForm.settlement.trim();
    const trimmedStatus = paymentMethodForm.status.trim();

    if (!trimmedName || !trimmedSettlement || !trimmedStatus) {
      setNotice({
        tone: "error",
        message: "Payment name, settlement, and status are required.",
      });
      return;
    }

    const hasDuplicateName = paymentMethods.some(
      (method) =>
        method.id !== editingPaymentId &&
        method.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

    if (hasDuplicateName) {
      setNotice({
        tone: "error",
        message:
          "A payment option with the same name already exists on this branch view.",
      });
      return;
    }

    const nextPaymentMethod: ListingPaymentMethodRule = {
      id: editingPaymentId ?? createPaymentMethodId(),
      name: trimmedName,
      settlement: trimmedSettlement,
      status: trimmedStatus,
      active: paymentMethodForm.active,
      requiresReference: paymentMethodForm.requiresReference,
    };

    updateBranchPaymentMethods(selectedBranch, (current) =>
      paymentDialogMode === "edit"
        ? current.map((method) =>
            method.id === editingPaymentId ? nextPaymentMethod : method,
          )
        : [nextPaymentMethod, ...current],
    );
    setNotice({
      tone: "success",
      message:
        paymentDialogMode === "edit"
          ? `Updated ${nextPaymentMethod.name}.`
          : `Added ${nextPaymentMethod.name} as a payment option.`,
    });
    closePaymentDialog();
  }

  function togglePaymentMethodStatus(method: ListingPaymentMethodRule) {
    updateBranchPaymentMethods(selectedBranch, (current) =>
      current.map((currentMethod) =>
        currentMethod.id === method.id
          ? { ...currentMethod, active: !currentMethod.active }
          : currentMethod,
      ),
    );
    setNotice({
      tone: "success",
      message: `${method.name} was ${method.active ? "disabled" : "enabled"}.`,
    });
  }

  function deletePaymentMethod(method: ListingPaymentMethodRule) {
    const confirmed = window.confirm(`Delete ${method.name}?`);

    if (!confirmed) {
      return;
    }

    updateBranchPaymentMethods(selectedBranch, (current) =>
      current.filter((currentMethod) => currentMethod.id !== method.id),
    );
    setNotice({
      tone: "success",
      message: `${method.name} was removed from payment options.`,
    });
  }

  return (
    <ListingShell
      eyebrow="Listing"
      title="Payment Method"
      description="Keep the accepted payment options aligned with terminal behavior, settlement expectations, and cashier prompts."
    >
      <SectionCard
        title="Payment methods"
        description="Each payment method controls how the terminal captures tender, references, and settlement flow."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <ListingBadge value={`${paymentMethods.length} methods`} />
            <button
              type="button"
              onClick={openAddPaymentDialog}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-slate-800 transition hover:bg-[color:var(--surface-soft)]"
            >
              <Plus className="h-4 w-4" />
              Add Payment Option
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {notice ? <NoticeBanner notice={notice} /> : null}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search payment name, settlement, status"
                className="h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              />
            </label>
            <button
              type="button"
              onClick={openAddPaymentDialog}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New Payment Option
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredPaymentMethods.map((method) => (
              <article key={method.id} className="rounded-3xl bg-[color:var(--surface-soft)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <WalletCards className="h-5 w-5 text-[color:var(--accent)]" />
                    <div>
                      <p className="section-title text-xl font-bold">
                        {method.name}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        {method.settlement}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                      method.active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-[color:var(--header-tint)] text-[color:var(--muted)]"
                    }`}
                  >
                    {method.active ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                  <p>{method.status}</p>
                  <p>{formatPaymentMethodReference(method)}</p>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditPaymentDialog(method)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePaymentMethodStatus(method)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
                  >
                    {method.active ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePaymentMethod(method)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          {filteredPaymentMethods.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-6 text-sm text-[color:var(--muted)]">
              No payment methods match the current filter.
            </div>
          ) : null}
        </div>
      </SectionCard>

      {paymentDialogMode ? (
        <ModalFrame
          title={
            paymentDialogMode === "add"
              ? "Add Payment Option"
              : "Edit Payment Option"
          }
          description="Create or update a terminal payment option with its settlement flow and cashier prompt."
          onClose={closePaymentDialog}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Payment name
              </span>
              <input
                value={paymentMethodForm.name}
                onChange={(event) =>
                  setPaymentMethodForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="GCash"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Settlement flow
              </span>
              <input
                value={paymentMethodForm.settlement}
                onChange={(event) =>
                  setPaymentMethodForm((current) => ({
                    ...current,
                    settlement: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="E-wallet reference"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Cashier status prompt
              </span>
              <input
                value={paymentMethodForm.status}
                onChange={(event) =>
                  setPaymentMethodForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-[color:var(--border)] px-4 text-sm text-slate-800 outline-none transition focus:border-slate-300"
                placeholder="Reference number captured"
              />
            </label>
            <label className="sm:col-span-2 flex items-center gap-3 rounded-2xl border border-[color:var(--border)] px-4 py-3">
              <input
                type="checkbox"
                checked={paymentMethodForm.requiresReference}
                onChange={(event) =>
                  setPaymentMethodForm((current) => ({
                    ...current,
                    requiresReference: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Requires payment reference
                </p>
                <p className="text-xs text-[color:var(--muted)]">
                  Enable this for card, e-wallet, or any method that captures an
                  external reference.
                </p>
              </div>
            </label>
            <label className="sm:col-span-2 flex items-center gap-3 rounded-2xl border border-[color:var(--border)] px-4 py-3">
              <input
                type="checkbox"
                checked={paymentMethodForm.active}
                onChange={(event) =>
                  setPaymentMethodForm((current) => ({
                    ...current,
                    active: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Active on cashier screens
                </p>
                <p className="text-xs text-[color:var(--muted)]">
                  Disabled methods stay in the list but cannot be used at POS.
                </p>
              </div>
            </label>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closePaymentDialog}
              className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={savePaymentMethod}
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {paymentDialogMode === "add"
                ? "Add Payment Option"
                : "Save Changes"}
            </button>
          </div>
        </ModalFrame>
      ) : null}
    </ListingShell>
  );
}
