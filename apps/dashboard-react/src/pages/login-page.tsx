import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ApiError,
  changeOwnPin,
  login,
  type AuthLoginResponse,
} from "../lib/api-client";
import { clearAuthSession, saveAuthSession } from "../lib/auth-session";
import { useUiStore } from "../store/ui-store";
import "./login-page.css";

type LoginLocationState = {
  from?: string;
  notice?: string;
};

const DASHBOARD_TERMINAL_ID = "dashboard-web-01";

function parseLoginError(error: unknown) {
  if (error instanceof ApiError) {
    if (
      error.message.includes("Back office access is for admin accounts only.")
    ) {
      return "Back office access is for admin accounts only.";
    }
    return error.message.replace(/^\d+\s+/, "");
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unable to sign in right now.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSelectedBranch = useUiStore((state) => state.setSelectedBranch);
  const [businessId, setBusinessId] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingPinChange, setPendingPinChange] = useState<{
    session: AuthLoginResponse;
    currentPin: string;
  } | null>(null);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const redirectTo =
    ((location.state as LoginLocationState | null)?.from ?? "/") || "/";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await login({
        branchId: businessId.trim().toLowerCase(),
        terminalId: DASHBOARD_TERMINAL_ID,
        employeeCode: employeeCode.trim().toUpperCase(),
        pin: pin.trim(),
        mfaCode: mfaRequired ? mfaCode.trim() : undefined,
      });

      if (response.user.role.toUpperCase() !== "ADMIN") {
        clearAuthSession();
        setErrorMessage("Back office access is for admin accounts only.");
        return;
      }

      if (response.pinChangeRequired) {
        setPendingPinChange({
          session: response,
          currentPin: pin.trim(),
        });
        setNewPin("");
        setConfirmPin("");
        return;
      }

      saveAuthSession(response);
      setSelectedBranch(response.user.branchId);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === "MFA_REQUIRED") {
        setMfaRequired(true);
        setMfaCode("");
        setErrorMessage(null);
        return;
      }
      setErrorMessage(parseLoginError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePinChangeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingPinChange || submitting) {
      return;
    }

    const normalizedNewPin = newPin.trim();
    const normalizedConfirmPin = confirmPin.trim();
    if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{6,12}$/.test(normalizedNewPin)) {
      setErrorMessage(
        "New PIN must be 6–12 characters, alphanumeric, with at least one letter and one digit.",
      );
      return;
    }
    if (normalizedNewPin !== normalizedConfirmPin) {
      setErrorMessage("New PIN entries do not match.");
      return;
    }
    if (normalizedNewPin === pendingPinChange.currentPin) {
      setErrorMessage("Use a different PIN from the current one.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await changeOwnPin(
        {
          currentPin: pendingPinChange.currentPin,
          newPin: normalizedNewPin,
        },
        {
          accessTokenOverride: pendingPinChange.session.accessToken,
        },
      );

      clearAuthSession();
      setPendingPinChange(null);
      setPin("");
      setNewPin("");
      setConfirmPin("");
      setErrorMessage(
        result.signedOut
          ? "PIN updated. Sign in again with your new PIN."
          : result.message,
      );
    } catch (error) {
      setErrorMessage(parseLoginError(error));
    } finally {
      setSubmitting(false);
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
            Back-office management system for your POS terminals and branches.
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

        <p className="login-left-footer">Multi-branch ready</p>
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
            {pendingPinChange ? (
              <>
                Rotate your <em>PIN</em>
              </>
            ) : mfaRequired ? (
              <>
                Verify <em>it&apos;s you</em>
              </>
            ) : (
              <>
                Welcome <em>back</em>
              </>
            )}
          </h1>
          <p className="login-subtitle">
            {pendingPinChange
              ? pendingPinChange.session.pinChangeReason === "RESET"
                ? "Your PIN was reset. Set a new PIN before continuing to the back office."
                : "BIR policy requires a PIN change every 30 days. Set a new PIN before continuing."
              : mfaRequired
                ? `Enter a code for ${employeeCode.trim().toUpperCase()}. No session is created until verification succeeds.`
                : "Sign in to continue to your admin back office account."}
          </p>

          {!pendingPinChange &&
          !mfaRequired &&
          (location.state as LoginLocationState | null)?.notice ? (
            <div className="login-status" role="status">
              {(location.state as LoginLocationState).notice}
            </div>
          ) : null}

          {pendingPinChange ? (
            <form onSubmit={handlePinChangeSubmit}>
              <div className="login-field">
                <label htmlFor="newPin">New PIN</label>
                <input
                  id="newPin"
                  value={newPin}
                  onChange={(event) => setNewPin(event.target.value)}
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
                <label htmlFor="confirmPin">Confirm New PIN</label>
                <input
                  id="confirmPin"
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

              {errorMessage ? (
                <div className="login-error">{errorMessage}</div>
              ) : null}

              <button type="submit" className="login-btn" disabled={submitting}>
                {submitting ? "Updating PIN..." : "Update PIN & continue"}
              </button>

              <button
                type="button"
                className="login-social-btn"
                style={{ width: "100%", marginTop: "10px" }}
                onClick={() => {
                  setPendingPinChange(null);
                  setNewPin("");
                  setConfirmPin("");
                  setPin("");
                  setErrorMessage(null);
                }}
              >
                Cancel
              </button>
            </form>
          ) : mfaRequired ? (
            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label htmlFor="mfaCode">
                  {useRecoveryCode
                    ? "Recovery code"
                    : "6-digit authenticator code"}
                </label>
                <input
                  id="mfaCode"
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value)}
                  required
                  minLength={6}
                  maxLength={32}
                  inputMode={useRecoveryCode ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  placeholder={useRecoveryCode ? "XXXX-XXXX-XXXX" : "000000"}
                  autoFocus
                />
              </div>

              {errorMessage ? (
                <div className="login-error" role="alert">
                  {errorMessage}
                </div>
              ) : null}

              <button type="submit" className="login-btn" disabled={submitting}>
                {submitting
                  ? "Verifying..."
                  : useRecoveryCode
                    ? "Use recovery code"
                    : "Verify & continue"}
              </button>

              <button
                type="button"
                className="login-text-btn"
                onClick={() => {
                  setUseRecoveryCode((current) => !current);
                  setMfaCode("");
                  setErrorMessage(null);
                }}
              >
                {useRecoveryCode
                  ? "Use authenticator code"
                  : "Use a recovery code"}
              </button>
              <button
                type="button"
                className="login-text-btn"
                onClick={() => {
                  setMfaRequired(false);
                  setUseRecoveryCode(false);
                  setMfaCode("");
                  setPin("");
                  setErrorMessage(null);
                }}
              >
                Use a different account
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label htmlFor="businessId">Business ID</label>
                <input
                  id="businessId"
                  value={businessId}
                  onChange={(event) => setBusinessId(event.target.value)}
                  required
                  minLength={3}
                  maxLength={64}
                  autoComplete="organization"
                  placeholder="branch-yourbusiness"
                />
              </div>

              <div className="login-field">
                <label htmlFor="adminCode">Admin Code</label>
                <input
                  id="adminCode"
                  value={employeeCode}
                  onChange={(event) =>
                    setEmployeeCode(event.target.value.toUpperCase())
                  }
                  required
                  minLength={3}
                  maxLength={32}
                  autoComplete="username"
                  placeholder="ADM001"
                />
              </div>

              <div className="login-field">
                <label htmlFor="pin">PIN</label>
                <input
                  id="pin"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  required
                  minLength={4}
                  maxLength={12}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••"
                />
              </div>

              <div className="login-options">
                <span className="login-session-note">Secure session</span>
                <a
                  href="#"
                  className="login-forgot"
                  onClick={(event) => event.preventDefault()}
                >
                  Forgot PIN?
                </a>
              </div>

              {errorMessage ? (
                <div className="login-error" role="alert">
                  {errorMessage}
                </div>
              ) : null}

              <button type="submit" className="login-btn" disabled={submitting}>
                {submitting ? "Signing In..." : "Sign in"}
              </button>

              <a
                href="/signup"
                className="login-social-btn"
                style={{
                  display: "block",
                  textAlign: "center",
                  marginTop: "10px",
                  textDecoration: "none",
                }}
              >
                New business? Start your free trial
              </a>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
