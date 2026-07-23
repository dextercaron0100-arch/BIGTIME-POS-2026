import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  PackageSearch,
  ReceiptText,
  Users,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useUiStore } from '../../store/ui-store'

const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/receipts', label: 'Receipts', icon: ReceiptText },
  { to: '/catalog', label: 'Catalog', icon: Boxes },
  { to: '/inventory', label: 'Inventory', icon: PackageSearch },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/employees', label: 'Employees', icon: Users },
]

const branches = [
  { id: 'all', name: 'All branches' },
  { id: 'branch-manila', name: 'Manila Flagship' },
  { id: 'branch-cebu', name: 'Cebu Ayala' },
  { id: 'branch-davao', name: 'Davao Downtown' },
]

export function AppShell() {
  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const globalSearch = useUiStore((state) => state.globalSearch)
  const setSelectedBranch = useUiStore((state) => state.setSelectedBranch)
  const setGlobalSearch = useUiStore((state) => state.setGlobalSearch)

  return (
    <div className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:h-[calc(100vh-2rem)] lg:flex-row">
        <aside className="glass-panel-strong w-full p-5 lg:w-72 lg:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--accent)] text-white shadow-lg shadow-orange-900/20">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <p className="section-title text-2xl font-bold">Apex POS</p>
              <p className="text-sm text-[color:var(--muted)]">Back-office control room</p>
            </div>
          </div>

          <nav className="mt-8 grid gap-2">
            {navigation.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-2xl px-4 py-3 transition',
                      isActive
                        ? 'bg-[color:var(--accent)] text-white shadow-lg shadow-orange-900/20'
                        : 'bg-white/45 text-[color:var(--ink)] hover:bg-white/70',
                    )
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          <div className="mt-8 rounded-3xl border border-white/50 bg-white/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
              Sync posture
            </p>
            <p className="mt-3 section-title text-2xl font-bold">4 terminals online</p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Redis pub/sub and offline queue replay are staged in the API scaffold.
            </p>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col gap-6">
          <header className="glass-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
                March 13, 2026
              </p>
              <p className="section-title mt-2 text-2xl font-bold">
                Operations snapshot across POS, inventory, reports, and HR
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:w-[360px]">
              <input
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                placeholder="Search OR number, SKU, cashier"
                className="soft-ring rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 py-3"
              />
              <select
                value={selectedBranch}
                onChange={(event) => setSelectedBranch(event.target.value)}
                className="soft-ring rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 py-3"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-auto pb-4">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
