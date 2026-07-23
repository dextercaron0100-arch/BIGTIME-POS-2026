import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { type AppNotification, useNotificationStore } from '../../store/notification-store'
import { cn } from '../../lib/utils'

type ToastEntry = AppNotification & { expiresAt: number }

const TOAST_DURATION = 4500

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const iconColors = {
  success: 'text-emerald-500',
  error: 'text-rose-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
}

const barColors = {
  success: 'bg-emerald-500',
  error: 'bg-rose-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastEntry
  onDismiss: () => void
}) {
  const Icon = icons[toast.type]

  return (
    <div
      className="relative w-80 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] shadow-2xl"
      style={{
        boxShadow:
          '0 8px 28px rgba(15,23,42,0.12), 0 2px 6px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,1)',
      }}
    >
      {/* Progress bar */}
      <motion.div
        className={cn('absolute bottom-0 left-0 h-0.5', barColors[toast.type])}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: TOAST_DURATION / 1000, ease: 'linear' }}
      />

      <div className="flex items-start gap-3 px-4 py-3.5">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColors[toast.type])} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[color:var(--ink)]">{toast.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--muted)]">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="mt-0.5 shrink-0 rounded-lg p-0.5 text-[color:var(--muted)]/50 transition hover:text-[color:var(--muted)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function ToastContainer() {
  const prefersReducedMotion = useReducedMotion()
  const notifications = useNotificationStore((state) => state.notifications)
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const prevFirstIdRef = useRef<string | null>(null)

  // Detect newly added notifications (always prepended at index 0)
  useEffect(() => {
    const first = notifications[0]
    if (!first) return
    if (first.id === prevFirstIdRef.current) return
    prevFirstIdRef.current = first.id
    setToasts((prev) =>
      [{ ...first, expiresAt: Date.now() + TOAST_DURATION }, ...prev].slice(0, 5),
    )
  }, [notifications])

  // Auto-expire toasts
  useEffect(() => {
    if (toasts.length === 0) return
    const earliest = Math.min(...toasts.map((t) => t.expiresAt))
    const delay = earliest - Date.now()
    const timer = setTimeout(() => {
      const now = Date.now()
      setToasts((prev) => prev.filter((t) => t.expiresAt > now))
    }, Math.max(delay, 100))
    return () => clearTimeout(timer)
  }, [toasts])

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-6 right-6 z-[200] flex flex-col-reverse gap-2"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, x: 48, scale: 0.93 }
            }
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, x: 48, scale: 0.93 }
            }
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto"
          >
            <ToastItem toast={toast} onDismiss={() => dismiss(toast.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
