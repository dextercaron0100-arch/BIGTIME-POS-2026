import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, createBrowserRouter, useLocation } from 'react-router-dom'
import { AppShell } from '../components/shell/app-shell'
import { ErrorBoundary } from '../components/ui/error-boundary'
import { clearAuthSession, hasAdminAuthSession } from '../lib/auth-session'

const loadHomePage = () => import('../pages/home-page')
const loadDashboardPage = () => import('../pages/dashboard-page')
const loadLoginPage = () => import('../pages/login-page')
const loadSignupPage = () => import('../pages/signup-page')
const loadWelcomePage = () => import('../pages/welcome-page')
const loadPrivacyPage = () => import('../pages/privacy-page')
const loadTermsPage = () => import('../pages/terms-page')
const loadReceiptsPage = () => import('../pages/receipts-page')
const loadCatalogPage = () => import('../pages/catalog-page')
const loadListingPages = () => import('../pages/listing-pages')
const loadInventoryPages = () => import('../pages/inventory-pages')
const loadReportsPages = () => import('../pages/reports-pages')
const loadBirEisPage = () => import('../pages/reports-bir-eis-page')
const loadEmployeesPages = () => import('../pages/employees-pages')
const loadSettingsPage = () => import('../pages/settings-page')
const loadPosUserPage = () => import('../pages/pos-user-page')
const loadAccountPage = () => import('../pages/account-page')

const routeImports = {
  '/welcome': loadWelcomePage,
  '/privacy': loadPrivacyPage,
  '/terms': loadTermsPage,
  '/login': loadLoginPage,
  '/signup': loadSignupPage,
  '/home': loadHomePage,
  '/': loadDashboardPage,
  '/receipts': loadReceiptsPage,
  '/catalog': loadCatalogPage,
  '/listing/items': loadListingPages,
  '/listing/category': loadListingPages,
  '/listing/category-group': loadListingPages,
  '/listing/discounts': loadListingPages,
  '/listing/taxes': loadListingPages,
  '/listing/payment-method': loadListingPages,
  '/inventory': loadInventoryPages,
  '/inventory/warehouse': loadInventoryPages,
  '/inventory/item-stocks': loadInventoryPages,
  '/inventory/item-transfers': loadInventoryPages,
  '/inventory/csv-import': loadInventoryPages,
  '/inventory/suppliers': loadInventoryPages,
  '/inventory/purchase-orders': loadInventoryPages,
  '/reports': loadReportsPages,
  '/reports/sales': loadReportsPages,
  '/reports/branch-comparison': loadReportsPages,
  '/reports/shift': loadReportsPages,
  '/reports/cash-balancing': loadReportsPages,
  '/reports/reference-number': loadReportsPages,
  '/reports/expiration-date': loadReportsPages,
  '/reports/discount': loadReportsPages,
  '/reports/pull-out': loadReportsPages,
  '/reports/bir-taxes': loadReportsPages,
  '/reports/bir-terminal-report': loadReportsPages,
  '/reports/bir-esales': loadBirEisPage,
  '/employees': loadEmployeesPages,
  '/employees/employees': loadEmployeesPages,
  '/employees/work-hours': loadEmployeesPages,
  '/employees/time-card': loadEmployeesPages,
  '/settings': loadSettingsPage,
  '/pos-users': loadPosUserPage,
  '/account': loadAccountPage,
} as const

export type RoutePath = keyof typeof routeImports

export function preloadRoute(path: RoutePath) {
  return routeImports[path]().then(() => undefined)
}

const HomePage = lazy(() =>
  loadHomePage().then((module) => ({
    default: module.HomePage,
  })),
)
const DashboardPage = lazy(() =>
  loadDashboardPage().then((module) => ({
    default: module.DashboardPage,
  })),
)
const LoginPage = lazy(() =>
  loadLoginPage().then((module) => ({
    default: module.LoginPage,
  })),
)
const SignupPage = lazy(() =>
  loadSignupPage().then((module) => ({
    default: module.SignupPage,
  })),
)
const WelcomePage = lazy(() =>
  loadWelcomePage().then((module) => ({
    default: module.WelcomePage,
  })),
)
const PrivacyPage = lazy(() =>
  loadPrivacyPage().then((module) => ({
    default: module.PrivacyPage,
  })),
)
const TermsPage = lazy(() =>
  loadTermsPage().then((module) => ({
    default: module.TermsPage,
  })),
)
const ReceiptsPage = lazy(() =>
  loadReceiptsPage().then((module) => ({
    default: module.ReceiptsPage,
  })),
)
const CatalogPage = lazy(() =>
  loadCatalogPage().then((module) => ({
    default: module.CatalogPage,
  })),
)
const ListingItemsPage = lazy(() =>
  loadListingPages().then((module) => ({
    default: module.ListingItemsPage,
  })),
)
const ListingCategoryPage = lazy(() =>
  loadListingPages().then((module) => ({
    default: module.ListingCategoryPage,
  })),
)
const ListingCategoryGroupPage = lazy(() =>
  loadListingPages().then((module) => ({
    default: module.ListingCategoryGroupPage,
  })),
)
const ListingDiscountsPage = lazy(() =>
  loadListingPages().then((module) => ({
    default: module.ListingDiscountsPage,
  })),
)
const ListingTaxesPage = lazy(() =>
  loadListingPages().then((module) => ({
    default: module.ListingTaxesPage,
  })),
)
const ListingPaymentMethodPage = lazy(() =>
  loadListingPages().then((module) => ({
    default: module.ListingPaymentMethodPage,
  })),
)
const InventoryWarehousePage = lazy(() =>
  loadInventoryPages().then((module) => ({
    default: module.InventoryWarehousePage,
  })),
)
const InventoryItemStocksPage = lazy(() =>
  loadInventoryPages().then((module) => ({
    default: module.InventoryItemStocksPage,
  })),
)
const InventoryItemTransfersPage = lazy(() =>
  loadInventoryPages().then((module) => ({
    default: module.InventoryItemTransfersPage,
  })),
)
const InventoryCsvImportPage = lazy(() =>
  loadInventoryPages().then((module) => ({
    default: module.InventoryCsvImportPage,
  })),
)
const InventorySuppliersPage = lazy(() =>
  loadInventoryPages().then((module) => ({
    default: module.InventorySuppliersPage,
  })),
)
const InventoryPurchaseOrdersPage = lazy(() =>
  loadInventoryPages().then((module) => ({
    default: module.InventoryPurchaseOrdersPage,
  })),
)
const ReportsSalesPage = lazy(() =>
  loadReportsPages().then((module) => ({
    default: module.ReportsSalesPage,
  })),
)
const ReportsBranchComparisonPage = lazy(() =>
  loadReportsPages().then((module) => ({
    default: module.ReportsBranchComparisonPage,
  })),
)
const ReportsShiftPage = lazy(() =>
  loadReportsPages().then((module) => ({
    default: module.ReportsShiftPage,
  })),
)
const ReportsCashBalancingPage = lazy(() =>
  loadReportsPages().then((module) => ({
    default: module.ReportsCashBalancingPage,
  })),
)
const ReportsReferenceNumberPage = lazy(() =>
  loadReportsPages().then((module) => ({
    default: module.ReportsReferenceNumberPage,
  })),
)
const ReportsExpirationDatePage = lazy(() =>
  loadReportsPages().then((module) => ({
    default: module.ReportsExpirationDatePage,
  })),
)
const ReportsDiscountPage = lazy(() =>
  loadReportsPages().then((module) => ({
    default: module.ReportsDiscountPage,
  })),
)
const ReportsPullOutPage = lazy(() =>
  loadReportsPages().then((module) => ({
    default: module.ReportsPullOutPage,
  })),
)
const ReportsBirTaxesPage = lazy(() =>
  loadReportsPages().then((module) => ({
    default: module.ReportsBirTaxesPage,
  })),
)
const ReportsBirTerminalReportPage = lazy(() =>
  loadReportsPages().then((module) => ({
    default: module.ReportsBirTerminalReportPage,
  })),
)
const ReportsBirEsalesPage = lazy(() =>
  loadBirEisPage().then((module) => ({
    default: module.ReportsBirEisPage,
  })),
)
const EmployeeDirectoryPage = lazy(() =>
  loadEmployeesPages().then((module) => ({
    default: module.EmployeeDirectoryPage,
  })),
)
const EmployeeWorkHoursPage = lazy(() =>
  loadEmployeesPages().then((module) => ({
    default: module.EmployeeWorkHoursPage,
  })),
)
const EmployeeTimeCardPage = lazy(() =>
  loadEmployeesPages().then((module) => ({
    default: module.EmployeeTimeCardPage,
  })),
)
const SettingsPage = lazy(() =>
  loadSettingsPage().then((module) => ({
    default: module.SettingsPage,
  })),
)
const AccountPage = lazy(() =>
  loadAccountPage().then((module) => ({
    default: module.AccountPage,
  })),
)
const PosUserPage = lazy(() =>
  loadPosUserPage().then((module) => ({
    default: module.PosUserPage,
  })),
)

function withSuspense(node: ReactNode) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        {node}
      </Suspense>
    </ErrorBoundary>
  )
}

function RouteFallback() {
  return (
    <div className="glass-panel dashboard-route-shell p-6">
      <div className="route-fallback-block h-5 w-32 rounded-full" />
      <div className="route-fallback-block mt-4 h-24 rounded-3xl" />
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="route-fallback-block h-40 rounded-3xl" />
        <div className="route-fallback-block h-40 rounded-3xl" />
        <div className="route-fallback-block h-40 rounded-3xl" />
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()

  if (!hasAdminAuthSession()) {
    clearAuthSession()
    if (location.pathname === '/') {
      return withSuspense(<WelcomePage />)
    }
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/login" replace state={{ from }} />
  }

  return <>{children}</>
}

function RedirectAuthenticated({ children }: { children: ReactNode }) {
  const location = useLocation()
  const from = ((location.state as { from?: string } | undefined)?.from ?? '/') || '/'

  if (hasAdminAuthSession()) {
    return <Navigate to={from} replace />
  }
  clearAuthSession()

  return <>{children}</>
}

export const router = createBrowserRouter([
  {
    path: '/welcome',
    element: withSuspense(<WelcomePage />),
  },
  {
    path: '/privacy',
    element: withSuspense(<PrivacyPage />),
  },
  {
    path: '/terms',
    element: withSuspense(<TermsPage />),
  },
  {
    path: '/login',
    element: withSuspense(
      <RedirectAuthenticated>
        <LoginPage />
      </RedirectAuthenticated>,
    ),
  },
  {
    path: '/signup',
    element: withSuspense(
      <RedirectAuthenticated>
        <SignupPage />
      </RedirectAuthenticated>,
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { path: 'home', element: withSuspense(<HomePage />) },
      { index: true, element: withSuspense(<DashboardPage />) },
      { path: 'receipts', element: withSuspense(<ReceiptsPage />) },
      { path: 'catalog', element: withSuspense(<CatalogPage />) },
      { path: 'listing/items', element: withSuspense(<ListingItemsPage />) },
      { path: 'listing/category', element: withSuspense(<ListingCategoryPage />) },
      {
        path: 'listing/category-group',
        element: withSuspense(<ListingCategoryGroupPage />),
      },
      { path: 'listing/discounts', element: withSuspense(<ListingDiscountsPage />) },
      { path: 'listing/taxes', element: withSuspense(<ListingTaxesPage />) },
      {
        path: 'listing/payment-method',
        element: withSuspense(<ListingPaymentMethodPage />),
      },
      { path: 'inventory', element: <Navigate to="/inventory/item-stocks" replace /> },
      { path: 'inventory/warehouse', element: withSuspense(<InventoryWarehousePage />) },
      {
        path: 'inventory/item-stocks',
        element: withSuspense(<InventoryItemStocksPage />),
      },
      {
        path: 'inventory/item-transfers',
        element: withSuspense(<InventoryItemTransfersPage />),
      },
      { path: 'inventory/csv-import', element: withSuspense(<InventoryCsvImportPage />) },
      { path: 'inventory/suppliers', element: withSuspense(<InventorySuppliersPage />) },
      {
        path: 'inventory/purchase-orders',
        element: withSuspense(<InventoryPurchaseOrdersPage />),
      },
      { path: 'reports', element: <Navigate to="/reports/sales" replace /> },
      { path: 'reports/sales', element: withSuspense(<ReportsSalesPage />) },
      {
        path: 'reports/branch-comparison',
        element: withSuspense(<ReportsBranchComparisonPage />),
      },
      { path: 'reports/shift', element: withSuspense(<ReportsShiftPage />) },
      {
        path: 'reports/cash-balancing',
        element: withSuspense(<ReportsCashBalancingPage />),
      },
      {
        path: 'reports/reference-number',
        element: withSuspense(<ReportsReferenceNumberPage />),
      },
      {
        path: 'reports/expiration-date',
        element: withSuspense(<ReportsExpirationDatePage />),
      },
      { path: 'reports/discount', element: withSuspense(<ReportsDiscountPage />) },
      { path: 'reports/pull-out', element: withSuspense(<ReportsPullOutPage />) },
      { path: 'reports/bir-taxes', element: withSuspense(<ReportsBirTaxesPage />) },
      {
        path: 'reports/bir-terminal-report',
        element: withSuspense(<ReportsBirTerminalReportPage />),
      },
      { path: 'reports/bir-esales', element: withSuspense(<ReportsBirEsalesPage />) },
      { path: 'employees', element: <Navigate to="/employees/employees" replace /> },
      { path: 'employees/employees', element: withSuspense(<EmployeeDirectoryPage />) },
      { path: 'employees/work-hours', element: withSuspense(<EmployeeWorkHoursPage />) },
      { path: 'employees/time-card', element: withSuspense(<EmployeeTimeCardPage />) },
      { path: 'settings', element: withSuspense(<SettingsPage />) },
      { path: 'account', element: withSuspense(<AccountPage />) },
      { path: 'pos-users', element: withSuspense(<PosUserPage />) },
      { path: 'pos-users/:userName', element: withSuspense(<PosUserPage />) },
    ],
  },
])
