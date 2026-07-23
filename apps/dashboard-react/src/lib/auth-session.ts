const AUTH_SESSION_STORAGE_KEY = 'apex-pos-dashboard-auth-session'
let memorySession: AuthSession | null = null

export type AuthSessionUser = {
  id: string
  branchId: string
  employeeCode: string
  name: string
  role: string
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  terminalId: string
  pinChangeRequired?: boolean
  pinChangeReason?: string | null
  pinUpdatedAt?: string | null
  pinExpiresAt?: string | null
  user: AuthSessionUser
  permissions: string[]
}

function isValidAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<AuthSession>
  return (
    typeof candidate.accessToken === 'string' &&
    candidate.accessToken.length > 0 &&
    typeof candidate.refreshToken === 'string' &&
    candidate.refreshToken.length > 0 &&
    typeof candidate.terminalId === 'string' &&
    candidate.terminalId.length > 0 &&
    !!candidate.user &&
    typeof candidate.user.id === 'string' &&
    typeof candidate.user.branchId === 'string' &&
    typeof candidate.user.employeeCode === 'string' &&
    typeof candidate.user.name === 'string' &&
    typeof candidate.user.role === 'string' &&
    Array.isArray(candidate.permissions)
  )
}

export function readAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null
  }

  if (memorySession) {
    return memorySession
  }

  // Remove credentials persisted by older builds. Session storage limits token
  // lifetime to the current browser tab; memory remains the primary source.
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
  const raw = window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isValidAuthSession(parsed)) {
      window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
      return null
    }

    memorySession = parsed
    return memorySession
  } catch {
    window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
    return null
  }
}

export function hasAuthSession() {
  return readAuthSession() !== null
}

export function isAdminAuthSession(session: AuthSession | null): session is AuthSession {
  return session?.user.role?.toUpperCase() === 'ADMIN'
}

export function hasAdminAuthSession() {
  return isAdminAuthSession(readAuthSession())
}

export function saveAuthSession(session: AuthSession) {
  if (typeof window === 'undefined') {
    return
  }

  memorySession = session
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
  window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function clearAuthSession() {
  if (typeof window === 'undefined') {
    return
  }

  memorySession = null
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
  window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
}
