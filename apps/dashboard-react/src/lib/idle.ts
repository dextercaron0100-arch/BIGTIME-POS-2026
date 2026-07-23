type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number
  cancelIdleCallback?: (handle: number) => void
}

type IdleHandle =
  | {
      kind: 'idle'
      id: number
    }
  | {
      kind: 'timeout'
      id: ReturnType<typeof globalThis.setTimeout>
    }

export function scheduleIdleWork(callback: () => void, timeout = 300): IdleHandle {
  if (typeof window === 'undefined') {
    return {
      kind: 'timeout',
      id: globalThis.setTimeout(callback, 0),
    }
  }

  const idleWindow = window as IdleWindow

  if (typeof idleWindow.requestIdleCallback === 'function') {
    return {
      kind: 'idle',
      id: idleWindow.requestIdleCallback(() => callback(), { timeout }),
    }
  }

  return {
    kind: 'timeout',
    id: globalThis.setTimeout(callback, Math.min(timeout, 120)),
  }
}

export function cancelIdleWork(handle: IdleHandle) {
  if (handle.kind === 'idle') {
    ;(window as IdleWindow).cancelIdleCallback?.(handle.id)
    return
  }

  globalThis.clearTimeout(handle.id)
}
