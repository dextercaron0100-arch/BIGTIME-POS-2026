import type { QueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { io, type Socket } from 'socket.io-client'
import { readAuthSession } from './auth-session'

const configuredWsUrl = import.meta.env.VITE_WS_URL?.trim()
const runtimeHost =
  typeof window !== 'undefined' && window.location.hostname
    ? window.location.hostname
    : 'localhost'
const runtimeWsProtocol =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? 'https:'
    : 'http:'
const WS_URL = configuredWsUrl || `${runtimeWsProtocol}//${runtimeHost}:3000`
const NAMESPACE = '/realtime'

type EventHandler = (payload: unknown) => void

export class RealtimeClient {
  private socket: Socket | null = null
  private handlers = new Map<string, Set<EventHandler>>()
  private queryClient: QueryClient | null = null
  private connectionListeners = new Set<() => void>()

  connect(queryClient?: QueryClient) {
    if (queryClient) {
      this.queryClient = queryClient
    }

    if (this.socket) {
      return
    }

    this.socket = io(`${WS_URL}${NAMESPACE}`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 15_000,
      auth: (callback) => {
        callback({ token: readAuthSession()?.accessToken ?? '' })
      },
    })

    this.socket.on('connect', () => {
      console.info('[realtime] connected')
      this.notifyConnectionListeners()
    })

    this.socket.on('disconnect', () => {
      console.info('[realtime] disconnected')
      this.notifyConnectionListeners()
    })

    this.socket.onAny((event, data) => {
      this.emit(event, data)
    })
  }

  private notifyConnectionListeners() {
    for (const listener of this.connectionListeners) {
      listener()
    }
  }

  private emit(event: string, data: unknown) {
    const handlers = this.handlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        handler(data)
      }
    }

    if (!this.queryClient) {
      return
    }

    switch (event) {
      case 'catalog.refresh':
        this.queryClient.invalidateQueries({ queryKey: ['catalog'] })
        break
      case 'transaction.created':
      case 'transaction.voided':
      case 'transaction.refunded':
      case 'sync.batch.processed':
        this.queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
        this.queryClient.invalidateQueries({ queryKey: ['receipts'] })
        this.queryClient.invalidateQueries({ queryKey: ['reports'] })
        this.queryClient.invalidateQueries({ queryKey: ['sales-trend'] })
        this.queryClient.invalidateQueries({ queryKey: ['cash-balancing'] })
        this.queryClient.invalidateQueries({ queryKey: ['inventory'] })
        break
      case 'shift.opened':
      case 'shift.closed':
        this.queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
        this.queryClient.invalidateQueries({ queryKey: ['cash-balancing'] })
        break
      case 'inventory.updated':
        this.queryClient.invalidateQueries({ queryKey: ['inventory'] })
        break
      case 'employee.updated':
        this.queryClient.invalidateQueries({ queryKey: ['employees'] })
        break
    }
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }

    this.handlers.get(event)!.add(handler)

    return () => {
      this.handlers.get(event)?.delete(handler)
    }
  }

  send(event: string, data?: unknown) {
    this.socket?.emit(event, data)
  }

  disconnect() {
    if (!this.socket) {
      return
    }

    this.socket.removeAllListeners()
    this.socket.disconnect()
    this.socket = null
    this.notifyConnectionListeners()
  }

  subscribeConnection = (listener: () => void) => {
    this.connectionListeners.add(listener)
    return () => {
      this.connectionListeners.delete(listener)
    }
  }

  getConnectionSnapshot = () => this.connected

  get connected() {
    return this.socket?.connected ?? false
  }
}

export const realtime = new RealtimeClient()

export function useRealtimeConnected() {
  return useSyncExternalStore(
    realtime.subscribeConnection,
    realtime.getConnectionSnapshot,
    realtime.getConnectionSnapshot,
  )
}
