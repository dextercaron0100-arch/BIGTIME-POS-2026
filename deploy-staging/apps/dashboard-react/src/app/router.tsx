import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '../components/shell/app-shell'

const DashboardPage = lazy(() =>
  import('../pages/dashboard-page').then((module) => ({
    default: module.DashboardPage,
  })),
)
const ReceiptsPage = lazy(() =>
  import('../pages/receipts-page').then((module) => ({
    default: module.ReceiptsPage,
  })),
)
const CatalogPage = lazy(() =>
  import('../pages/catalog-page').then((module) => ({
    default: module.CatalogPage,
  })),
)
const InventoryPage = lazy(() =>
  import('../pages/inventory-page').then((module) => ({
    default: module.InventoryPage,
  })),
)
const ReportsPage = lazy(() =>
  import('../pages/reports-page').then((module) => ({
    default: module.ReportsPage,
  })),
)
const EmployeesPage = lazy(() =>
  import('../pages/employees-page').then((module) => ({
    default: module.EmployeesPage,
  })),
)

function withSuspense(node: ReactNode) {
  return (
    <Suspense fallback={<RouteFallback />}>
      {node}
    </Suspense>
  )
}

function RouteFallback() {
  return (
    <div className="glass-panel p-6">
      <div className="h-5 w-32 rounded-full bg-white/70" />
      <div className="mt-4 h-24 rounded-3xl bg-white/60" />
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="h-40 rounded-3xl bg-white/60" />
        <div className="h-40 rounded-3xl bg-white/60" />
        <div className="h-40 rounded-3xl bg-white/60" />
      </div>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: withSuspense(<DashboardPage />) },
      { path: 'receipts', element: withSuspense(<ReceiptsPage />) },
      { path: 'catalog', element: withSuspense(<CatalogPage />) },
      { path: 'inventory', element: withSuspense(<InventoryPage />) },
      { path: 'reports', element: withSuspense(<ReportsPage />) },
      { path: 'employees', element: withSuspense(<EmployeesPage />) },
    ],
  },
])
