import { Barcode, Layers3, Tags } from 'lucide-react'
import { PageHeader } from '../components/ui/page-header'
import { SectionCard } from '../components/ui/section-card'
import { useCatalog } from '../hooks/use-catalog'
import { formatCurrency } from '../lib/utils'
import { useUiStore } from '../store/ui-store'

export function CatalogPage() {
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const catalogQuery = useCatalog(selectedBranch)
  const data = catalogQuery.data

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog and pricing"
        title="Item, category, and VAT control"
        description="Manage the menu structure and keep prices aligned with BIR tax buckets before terminals receive their next sync."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.35fr]">
        <SectionCard
          title="Category groups"
          description="This column maps the top-level horizontal tabs that the Flutter POS uses."
        >
          <div className="space-y-3">
            {data?.categories.map((category) => (
              <article
                key={category.id}
                className="flex items-center gap-4 rounded-3xl bg-white/70 p-4"
              >
                <span
                  className="h-12 w-12 rounded-2xl"
                  style={{ backgroundColor: category.color }}
                />
                <div>
                  <p className="font-semibold">{category.name}</p>
                  <p className="text-sm text-[color:var(--muted)]">{category.groupName}</p>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Sellable items"
          description="Item cards show the same operational details cashiers need at the terminal."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {data?.items.map((item) => (
              <article
                key={item.id}
                className="rounded-3xl border border-[color:var(--border)] bg-white/70 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="section-title text-xl font-bold">{item.name}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">{item.sku}</p>
                  </div>
                  <p className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink)]">
                    {item.vatType.replace('_', ' ')}
                  </p>
                </div>
                <div className="mt-5 grid gap-3 text-sm text-[color:var(--muted)]">
                  <div className="flex items-center gap-2">
                    <Tags className="h-4 w-4 text-[color:var(--accent)]" />
                    {formatCurrency(item.price)} per {item.unit}
                  </div>
                  <div className="flex items-center gap-2">
                    <Barcode className="h-4 w-4 text-[color:var(--accent)]" />
                    {item.barcode}
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers3 className="h-4 w-4 text-[color:var(--accent)]" />
                    {item.hasVariants ? 'Has variants' : 'Single SKU'}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
