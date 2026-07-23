import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, signupOrganization } from '../lib/api-client'
import { saveAuthSession } from '../lib/auth-session'
import { useUiStore } from '../store/ui-store'
import './login-page.css'

function parseSignupError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message.replace(/^\d+\s+/, '')
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return 'Unable to create your account right now.'
}

export function SignupPage() {
  const navigate = useNavigate()
  const setSelectedBranch = useUiStore((state) => state.setSelectedBranch)
  const [businessName, setBusinessName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [employeeCode, setEmployeeCode] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) {
      return
    }

    setErrorMessage(null)

    const normalizedPin = pin.trim()
    if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{6,12}$/.test(normalizedPin)) {
      setErrorMessage(
        'PIN must be 6–12 characters, alphanumeric, with at least one letter and one digit.',
      )
      return
    }
    if (normalizedPin !== confirmPin.trim()) {
      setErrorMessage('PIN entries do not match.')
      return
    }

    setSubmitting(true)

    try {
      const response = await signupOrganization({
        businessName: businessName.trim(),
        ownerEmail: ownerEmail.trim(),
        ownerName: ownerName.trim(),
        employeeCode: employeeCode.trim().toUpperCase(),
        pin: normalizedPin,
      })

      saveAuthSession(response)
      setSelectedBranch(response.user.branchId)
      navigate('/', { replace: true })
    } catch (error) {
      setErrorMessage(parseSignupError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      {/* ── Left teal branding panel ── */}
      <div className="login-left">
        <div className="login-left-brand">
          <div className="login-left-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h2 className="login-left-name">BIGTIME POS</h2>
          <p className="login-left-tagline">
            Start your 30-day free trial. Full access to every feature, no
            payment required.
          </p>
        </div>

        <div className="login-left-features">
          <div className="login-left-feature">
            <div className="login-left-feature-dot" />
            <span>Real-time sales monitoring</span>
          </div>
          <div className="login-left-feature">
            <div className="login-left-feature-dot" />
            <span>BIR-compliant receipts &amp; reports</span>
          </div>
          <div className="login-left-feature">
            <div className="login-left-feature-dot" />
            <span>Multi-branch &amp; terminal management</span>
          </div>
          <div className="login-left-feature">
            <div className="login-left-feature-dot" />
            <span>Inventory &amp; employee controls</span>
          </div>
        </div>

        <p className="login-left-footer">30-day free trial &mdash; no credit card needed</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-card-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>

          <h1 className="login-title">
            Create your <em>account</em>
          </h1>
          <p className="login-subtitle">
            Set up your business and start your 30-day free trial.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="businessName">Business name</label>
              <input
                id="businessName"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                required
                minLength={2}
                maxLength={80}
                placeholder="Your Business Name"
              />
            </div>

            <div className="login-field">
              <label htmlFor="ownerName">Your name</label>
              <input
                id="ownerName"
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
                required
                minLength={2}
                maxLength={80}
                placeholder="Juan Dela Cruz"
              />
            </div>

            <div className="login-field">
              <label htmlFor="ownerEmail">Email</label>
              <input
                id="ownerEmail"
                type="email"
                value={ownerEmail}
                onChange={(event) => setOwnerEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="you@business.com"
              />
            </div>

            <div className="login-field">
              <label htmlFor="employeeCode">Admin code</label>
              <input
                id="employeeCode"
                value={employeeCode}
                onChange={(event) => setEmployeeCode(event.target.value.toUpperCase())}
                required
                minLength={3}
                maxLength={32}
                autoComplete="username"
                placeholder="ADM001"
              />
            </div>

            <div className="login-field">
              <label htmlFor="signupPin">PIN</label>
              <input
                id="signupPin"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                required
                minLength={6}
                maxLength={12}
                pattern="(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{6,12}"
                type="password"
                autoComplete="new-password"
                placeholder="At least 1 letter & 1 digit"
              />
            </div>

            <div className="login-field">
              <label htmlFor="confirmSignupPin">Confirm PIN</label>
              <input
                id="confirmSignupPin"
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value)}
                required
                minLength={6}
                maxLength={12}
                pattern="(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{6,12}"
                type="password"
                autoComplete="new-password"
                placeholder="At least 1 letter & 1 digit"
              />
            </div>

            {errorMessage ? <div className="login-error">{errorMessage}</div> : null}

            <button type="submit" className="login-btn" disabled={submitting}>
              {submitting ? 'Creating account...' : 'Start free trial'}
            </button>

            <a href="/login" className="login-social-btn" style={{ display: 'block', textAlign: 'center', marginTop: '10px', textDecoration: 'none' }}>
              Already have an account? Sign in
            </a>
          </form>
        </div>
      </div>
    </div>
  )
}
