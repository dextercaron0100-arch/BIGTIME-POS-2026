import {
  BarChart3,
  Bell,
  Building2,
  Boxes,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  UserCircle,
  Users,
  X,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { NavProgress } from '../ui/nav-progress'
import { ToastContainer } from '../ui/toast'
import { preloadRoute, type RoutePath } from '../../app/router'
import { useDashboardOverview } from '../../hooks/use-dashboard-overview'
import { fetchManagedBranches, getMyOrganization } from '../../lib/api-client'
import { clearAuthSession, readAuthSession } from '../../lib/auth-session'
import { cancelIdleWork, scheduleIdleWork } from '../../lib/idle'
import { useRealtimeConnected } from '../../lib/realtime'
import { cn } from '../../lib/utils'
import { useNotificationStore } from '../../store/notification-store'
import { useUiStore } from '../../store/ui-store'
import { DateCashierToolbar } from '../ui/date-cashier-toolbar'

const navigation: Array<{
  to: RoutePath
  label: string
  icon: typeof LayoutDashboard
}> = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/receipts', label: 'Receipts', icon: ReceiptText },
  { to: '/pos-users', label: 'POS User', icon: UserCircle },
]

const listingNavigation: Array<{
  to: RoutePath
  label: string
}> = [
  { to: '/listing/items', label: 'Items' },
  { to: '/listing/category', label: 'Category' },
  { to: '/listing/category-group', label: 'Category Group' },
  { to: '/listing/discounts', label: 'Discounts' },
  { to: '/listing/taxes', label: 'Taxes' },
  { to: '/listing/payment-method', label: 'Payment Method' },
]

const inventoryNavigation: Array<{
  to: RoutePath
  label: string
}> = [
  { to: '/inventory/warehouse', label: 'Warehouse' },
  { to: '/inventory/item-stocks', label: 'Item Stocks' },
  { to: '/inventory/item-transfers', label: 'Item Transfers' },
  { to: '/inventory/csv-import', label: 'CSV Import' },
  { to: '/inventory/suppliers', label: 'Suppliers' },
  { to: '/inventory/purchase-orders', label: 'Purchase Orders' },
]

const reportsNavigation: Array<{
  to: RoutePath
  label: string
}> = [
  { to: '/reports/sales', label: 'Sales' },
  { to: '/reports/branch-comparison', label: 'Branch Comparison' },
  { to: '/reports/shift', label: 'Shift' },
  { to: '/reports/cash-balancing', label: 'Cash Balancing' },
  { to: '/reports/reference-number', label: 'Reference Number' },
  { to: '/reports/expiration-date', label: 'Expiration Date' },
  { to: '/reports/discount', label: 'Discount' },
  { to: '/reports/pull-out', label: 'Pull Out' },
  { to: '/reports/bir-taxes', label: 'BIR Taxes' },
  { to: '/reports/bir-terminal-report', label: 'BIR Terminal Report' },
  { to: '/reports/bir-esales', label: 'BIR eSales' },
]

const employeesNavigation: Array<{
  to: RoutePath
  label: string
}> = [
  { to: '/employees/employees', label: 'Employees' },
  { to: '/employees/work-hours', label: 'Work Hours' },
  { to: '/employees/time-card', label: 'Time Card' },
]

const fallbackBranch = { id: 'branch-crossing-calmba', name: 'CROSSING CALAMBA' }

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

type SidebarGroupProps = {
  label: string
  icon: typeof Boxes
  isActive: boolean
  isOpen: boolean
  onToggle: () => void
  items: Array<{
    to: RoutePath
    label: string
  }>
}

function SidebarGroup({
  label,
  icon: Icon,
  isActive,
  isOpen,
  onToggle,
  items,
}: SidebarGroupProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-all duration-200',
          isActive ? 'bg-white/15' : 'hover:bg-white/10',
        )}
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2.5">
          <span className={cn(
            'flex h-7 w-7 items-center justify-center rounded-xl transition-colors duration-200',
            isActive ? 'bg-white/20' : 'bg-white/10',
          )}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="text-sm font-semibold text-white/90">{label}</span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-white/50 transition-transform duration-300 ease-out',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      <div className={cn('nav-group-panel', isOpen && 'nav-group-panel-open')} aria-hidden={!isOpen}>
        <div className="ml-[1.375rem] mt-1 grid gap-0.5 border-l-2 border-white/15 pl-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onMouseEnter={() => preloadRoute(item.to)}
              onFocus={() => preloadRoute(item.to)}
              className={({ isActive: isItemActive }) =>
                cn(
                  'block rounded-xl px-3 py-1.5 text-sm transition-all duration-150',
                  isItemActive
                    ? 'bg-white/22 font-semibold text-white'
                    : 'font-medium text-white/70 hover:bg-white/12 hover:text-white',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}

function SidebarUserMenu({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const session = readAuthSession()

  const userName = session?.user.name ?? 'ADMIN'
  const userRole = session?.user.role ?? 'ADMIN'
  const userEmail = session?.user.employeeCode
    ? `${session.user.employeeCode.toLowerCase()}@bigtime.pos`
    : 'admin@bigtime.pos'

  const initials = userName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={menuRef} className="relative mt-auto pt-4">
      {/* Divider */}
      <div className="mb-3 border-t border-white/15" />

      {open && (
        <div className="dashboard-popover-enter absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-black/10">
          <div className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#52d4cc] to-[#28a89a] text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{userName}</p>
              <p className="text-xs text-slate-500 truncate">{userEmail}</p>
            </div>
          </div>
          <div className="mt-1 grid gap-0.5">
            <button
              type="button"
              onClick={() => { setOpen(false); navigate('/account') }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <UserCircle className="h-4 w-4 text-slate-400" />
              Account
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); onSignOut() }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4 text-rose-400" />
              Sign out
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-3 rounded-2xl bg-white/12 px-3 py-2.5 transition-all duration-200 hover:bg-white/20"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/25 text-xs font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-semibold text-white truncate">{userName}</p>
          <p className="text-xs text-white/60 truncate">{userRole}</p>
        </div>
        <ChevronUp className={cn('h-4 w-4 text-white/50 transition-transform duration-200', open && 'rotate-180')} />
      </button>
    </div>
  )
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const prefersReducedMotion = useReducedMotion()
  const isDesktop = useIsDesktop()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close drawer whenever the route changes
  useEffect(() => { setMobileMenuOpen(false) }, [location.pathname])
  const session = readAuthSession()
  const isListingRoute = location.pathname.startsWith('/listing')
  const isInventoryRoute = location.pathname.startsWith('/inventory')
  const isReportsRoute = location.pathname.startsWith('/reports')
  const isEmployeesRoute = location.pathname.startsWith('/employees')

  const selectedBranch = useUiStore((state) => state.selectedBranch)
  const globalSearch = useUiStore((state) => state.globalSearch)
  const setSelectedBranch = useUiStore((state) => state.setSelectedBranch)
  const setGlobalSearch = useUiStore((state) => state.setGlobalSearch)
  const managedBranchesQuery = useQuery({
    queryKey: ['managed-branches'],
    queryFn: fetchManagedBranches,
  })
  const organizationQuery = useQuery({
    queryKey: ['my-organization'],
    queryFn: getMyOrganization,
    staleTime: 5 * 60 * 1000,
  })
  const organization = organizationQuery.data
  const isTrialExpired = organization?.trialState === 'TRIAL_EXPIRED'
  const isTrialEndingSoon =
    organization?.trialState === 'TRIAL_ACTIVE' && organization.daysRemaining <= 7
  const searchRef = useRef<HTMLInputElement>(null)
  const [isListingOpenManually, setIsListingOpenManually] = useState(isListingRoute)
  const [isInventoryOpenManually, setIsInventoryOpenManually] = useState(isInventoryRoute)
  const [isReportsOpenManually, setIsReportsOpenManually] = useState(isReportsRoute)
  const [isEmployeesOpenManually, setIsEmployeesOpenManually] = useState(isEmployeesRoute)

  // Auto-expand a group when navigating into it, without forcing it open on
  // every render — that would make manually collapsing it while on one of
  // its routes a no-op (the OR'd isXRoute check would just re-open it).
  useEffect(() => {
    if (isListingRoute) setIsListingOpenManually(true)
  }, [isListingRoute])
  useEffect(() => {
    if (isInventoryRoute) setIsInventoryOpenManually(true)
  }, [isInventoryRoute])
  useEffect(() => {
    if (isReportsRoute) setIsReportsOpenManually(true)
  }, [isReportsRoute])
  useEffect(() => {
    if (isEmployeesRoute) setIsEmployeesOpenManually(true)
  }, [isEmployeesRoute])

  const managedBranches = managedBranchesQuery.data ?? []
  const primaryBranch =
    managedBranches.find((branch) => branch.id === selectedBranch) ??
    managedBranches.find((branch) => branch.id === session?.user.branchId) ??
    managedBranches[0] ??
    fallbackBranch

  const isListingOpen = isListingOpenManually
  const isInventoryOpen = isInventoryOpenManually
  const isReportsOpen = isReportsOpenManually
  const isEmployeesOpen = isEmployeesOpenManually

  // Live terminal count from API/mock overview
  const { data: overview } = useDashboardOverview(selectedBranch)
  const wsConnected = useRealtimeConnected()

  useEffect(() => {
    const preloadHandle = scheduleIdleWork(() => {
      preloadRoute('/receipts')
      preloadRoute('/listing/items')
      preloadRoute('/listing/category')
      preloadRoute('/inventory/item-stocks')
      preloadRoute('/inventory/warehouse')
      preloadRoute('/reports/sales')
      preloadRoute('/reports/branch-comparison')
      preloadRoute('/employees/employees')
      preloadRoute('/employees/work-hours')
      preloadRoute('/settings')
    }, 700)

    return () => cancelIdleWork(preloadHandle)
  }, [])

  useEffect(() => {
    if (selectedBranch !== primaryBranch.id) {
      setSelectedBranch(primaryBranch.id)
    }
  }, [primaryBranch.id, selectedBranch, setSelectedBranch])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      if (e.key === '/' && !isTyping) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setGlobalSearch('')
        searchRef.current?.blur()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [setGlobalSearch])

  // ── Notifications ──────────────────────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const { notifications, addNotification, markRead, markAllRead, dismiss, clearAll } =
    useNotificationStore()
  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const prevWsRef = useRef(wsConnected)
  useEffect(() => {
    if (prevWsRef.current !== wsConnected) {
      if (!wsConnected) {
        addNotification({
          type: 'warning',
          title: 'Realtime sync disconnected',
          message: 'The live connection to the POS server was lost. Data may be stale.',
        })
      } else {
        addNotification({
          type: 'success',
          title: 'Realtime sync restored',
          message: 'Live connection re-established. Dashboard is now up to date.',
        })
      }
      prevWsRef.current = wsConnected
    }
  }, [wsConnected, addNotification])

  const notifiedTerminalsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!overview?.terminals) return
    for (const terminal of overview.terminals) {
      if (terminal.status !== 'ONLINE' && !notifiedTerminalsRef.current.has(terminal.id)) {
        notifiedTerminalsRef.current.add(terminal.id)
        addNotification({
          type: 'error',
          title: `Terminal offline: ${terminal.name}`,
          message: `${terminal.serialNumber} is not responding at ${selectedBranch}.`,
        })
      }
      if (terminal.status === 'ONLINE') {
        notifiedTerminalsRef.current.delete(terminal.id)
      }
    }
  }, [overview?.terminals, selectedBranch, addNotification])

  function handleSignOut() {
    clearAuthSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-(--bg-warm)">
      {/* ── Mobile backdrop ──────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && !isDesktop && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen">

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <motion.aside
          className={cn(
            // Always fixed — flush to left edge, full viewport height, no outer rounding
            'sidebar-panel fixed inset-y-0 left-0 z-50 flex h-screen w-65 flex-col overflow-y-auto p-5 lg:z-30',
          )}
          initial={false}
          animate={{ x: isDesktop || mobileMenuOpen ? 0 : '-100%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 36 }}
        >
          {/* ── Brand ─────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-sm ring-1 ring-white/20">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold leading-tight text-white">BIGTIME POS</p>
              <p className="text-[0.72rem] font-medium text-white/55 uppercase tracking-widest">Back-office</p>
            </div>
            {/* Mobile close button */}
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden ml-auto shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-white/80 transition hover:bg-white/25"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Nav ───────────────────────────────────── */}
          <nav className="mt-7 flex flex-1 flex-col gap-1">

            {/* Primary items */}
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onMouseEnter={() => preloadRoute(item.to)}
                  onFocus={() => preloadRoute(item.to)}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                      isActive
                        ? 'bg-white/22 text-white shadow-sm'
                        : 'text-white hover:bg-white/12',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-colors duration-200',
                        isActive ? 'bg-white/25' : 'bg-white/10',
                      )}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>{item.label}</span>
                      {isActive && (
                        <motion.span
                          layoutId="nav-active-pill"
                          className="absolute inset-0 rounded-2xl bg-white/22"
                          style={{ zIndex: -1 }}
                          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}

            {/* Section divider */}
            <div className="my-2 border-t border-white/12" />

            {/* Collapsible groups */}
            <SidebarGroup
              label="Reports"
              icon={BarChart3}
              isActive={isReportsRoute}
              isOpen={isReportsOpen}
              onToggle={() => setIsReportsOpenManually((open) => !open)}
              items={reportsNavigation}
            />
            <SidebarGroup
              label="Listing"
              icon={Boxes}
              isActive={isListingRoute}
              isOpen={isListingOpen}
              onToggle={() => setIsListingOpenManually((open) => !open)}
              items={listingNavigation}
            />
            <SidebarGroup
              label="Inventory"
              icon={Building2}
              isActive={isInventoryRoute}
              isOpen={isInventoryOpen}
              onToggle={() => setIsInventoryOpenManually((open) => !open)}
              items={inventoryNavigation}
            />
            <SidebarGroup
              label="Employees"
              icon={Users}
              isActive={isEmployeesRoute}
              isOpen={isEmployeesOpen}
              onToggle={() => setIsEmployeesOpenManually((open) => !open)}
              items={employeesNavigation}
            />

            {/* Section divider */}
            <div className="my-2 border-t border-white/12" />

            <NavLink
              to="/settings"
              onMouseEnter={() => preloadRoute('/settings')}
              onFocus={() => preloadRoute('/settings')}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-white/22 text-white shadow-sm'
                    : 'text-white/75 hover:bg-white/12 hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-colors duration-200',
                    isActive ? 'bg-white/25' : 'bg-white/10',
                  )}>
                    <Settings className="h-4 w-4" />
                  </span>
                  <span>Settings</span>
                </>
              )}
            </NavLink>
          </nav>

          <SidebarUserMenu onSignOut={handleSignOut} />

        </motion.aside>

        <div className="flex min-h-screen flex-col gap-5 px-4 py-4 sm:px-5 sm:py-5 lg:ml-65 lg:px-6 lg:py-5">
          <header className="glass-panel page-shell-enter relative z-30 min-w-0 flex items-center gap-3 overflow-visible px-4 py-2.5 sm:justify-between sm:px-5 sm:py-3">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--ink)] transition hover:bg-[color:var(--header-tint)]"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)] sm:block">
                {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="section-title mt-0.5 text-sm font-bold leading-tight line-clamp-1">
                Operations snapshot across POS, inventory, reports, and HR
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="relative hidden sm:block">
                <input
                  ref={searchRef}
                  value={globalSearch}
                  onChange={(event) => setGlobalSearch(event.target.value)}
                  placeholder="Search OR number, SKU, cashier"
                  className="soft-ring w-[200px] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-1.5 pr-9 text-sm"
                />
                {!globalSearch && (
                  <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[color:var(--border)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--muted)] opacity-60">
                    /
                  </kbd>
                )}
              </div>

              {/* Notification Bell */}
              <div ref={notifRef} className="relative z-40">
                <button
                  type="button"
                  onClick={() => setNotifOpen((prev) => !prev)}
                  aria-label="Notifications"
                  className="dashboard-soft-panel-hover relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)]"
                >
                  <Bell className="h-4 w-4 text-[color:var(--ink)]" />
                  <AnimatePresence>
                    {unreadCount > 0 && (
                      <motion.span
                        key={unreadCount}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white"
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                {notifOpen && (
                  <div className="dashboard-notification-panel dashboard-popover-enter absolute right-0 top-full z-[90] mt-2 w-[min(320px,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-[color:var(--border)] shadow-xl">
                    <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
                      <p className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink)]">
                        Notifications
                        {unreadCount > 0 && (
                          <span className="rounded-full bg-[color:var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--accent)]">
                            {unreadCount} new
                          </span>
                        )}
                      </p>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="text-xs text-[color:var(--accent)] hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-[color:var(--muted)]">
                          No notifications
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => markRead(notif.id)}
                            className={cn(
                              'dashboard-notification-row flex cursor-pointer gap-3 border-b border-[color:var(--border)] px-4 py-3 transition last:border-0',
                              !notif.read && 'dashboard-notification-unread',
                            )}
                          >
                            <div
                              className={cn(
                                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                                notif.type === 'error' && 'bg-rose-500',
                                notif.type === 'warning' && 'bg-amber-500',
                                notif.type === 'success' && 'bg-emerald-500',
                                notif.type === 'info' && 'bg-blue-500',
                              )}
                            >
                              {notif.type === 'success' ? '✓' : notif.type === 'info' ? 'i' : '!'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  'text-sm text-[color:var(--ink)]',
                                  !notif.read ? 'font-semibold' : 'font-medium',
                                )}
                              >
                                {notif.title}
                              </p>
                              <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                                {notif.message}
                              </p>
                              <p className="mt-1 text-[10px] text-[color:var(--muted)]/80">
                                {new Date(notif.createdAt).toLocaleTimeString('en-PH', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                dismiss(notif.id)
                              }}
                              className="mt-0.5 shrink-0 rounded p-0.5 text-[color:var(--muted)]/55 transition hover:text-[color:var(--muted)]"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {notifications.length > 0 && (
                      <div className="border-t border-[color:var(--border)] px-4 py-2">
                        <button
                          type="button"
                          onClick={() => {
                            clearAll()
                            setNotifOpen(false)
                          }}
                          className="text-xs text-[color:var(--muted)] transition hover:text-rose-500"
                        >
                          Clear all
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="hidden md:block rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-1.5 text-sm font-medium text-[color:var(--ink)]">
                {primaryBranch.name}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2.5 py-1.5 text-sm font-medium text-[color:var(--ink)] transition hover:bg-[color:var(--header-tint)] sm:px-3"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </header>

          {isTrialEndingSoon && !location.pathname.startsWith('/account') && (
            <div className="mx-4 mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 sm:mx-5">
              Your free trial ends in {organization?.daysRemaining} day
              {organization?.daysRemaining === 1 ? '' : 's'}. Visit Settings to
              review your plan.
            </div>
          )}

          {!location.pathname.startsWith('/account') && (
            <div className="glass-panel page-shell-enter p-4 sm:p-5">
              <DateCashierToolbar />
            </div>
          )}

          <main className="relative z-0 min-h-0 min-w-0 flex-1 overflow-x-hidden pb-4">
            {isTrialExpired ? (
              <div className="glass-panel mx-4 mt-4 flex flex-col items-center gap-3 rounded-2xl p-10 text-center sm:mx-5">
                <h2 className="text-xl font-semibold text-[color:var(--ink)]">
                  Your 30-day free trial has ended
                </h2>
                <p className="max-w-md text-sm text-[color:var(--muted)]">
                  Access to BIGTIME POS is paused for {organization?.name}.
                  Please contact support to continue using your account.
                </p>
              </div>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${location.pathname}${location.search}`}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.994 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.997 }}
                  transition={{ duration: 0.28, ease: [0.2, 0.9, 0.22, 1] }}
                  style={{ transformOrigin: 'top center', willChange: 'transform, opacity' }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            )}
          </main>

          <footer className="py-3 text-center text-xs text-[color:var(--muted)]">
            Powered By: Herrera Technologies
          </footer>
        </div>
      </div>
      <ToastContainer />
      <NavProgress />
    </div>
  )
}
