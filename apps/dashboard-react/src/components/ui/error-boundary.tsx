import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <ErrorFallback error={this.state.error} onReset={this.handleReset} />
        )
      )
    }
    return this.props.children
  }
}

function ErrorFallback({
  error,
  onReset,
}: {
  error?: Error
  onReset: () => void
}) {
  return (
    <div className="glass-panel flex flex-col items-center justify-center gap-5 p-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <div className="max-w-sm">
        <p className="section-title text-lg font-bold text-[color:var(--ink)]">
          Something went wrong
        </p>
        {error?.message && (
          <p className="mt-2 font-mono text-xs text-[color:var(--muted)]">{error.message}</p>
        )}
        <p className="mt-1.5 text-sm text-[color:var(--muted)]">
          This section failed to load. You can try again or navigate to another page.
        </p>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="dashboard-accent-button inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  )
}
