import { create } from 'zustand'

export type NotificationType = 'info' | 'warning' | 'error' | 'success'

export type AppNotification = {
  id: string
  type: NotificationType
  title: string
  message: string
  createdAt: string
  read: boolean
}

type NotificationState = {
  notifications: AppNotification[]
  addNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  dismiss: (id: string) => void
  clearAll: () => void
}

function makeId() {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}


const seedNotifications: AppNotification[] = []

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: seedNotifications,
  addNotification: (n) =>
    set((state) => ({
      notifications: [
        {
          ...n,
          id: makeId(),
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...state.notifications,
      ].slice(0, 50),
    })),
  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
  dismiss: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clearAll: () => set({ notifications: [] }),
}))
