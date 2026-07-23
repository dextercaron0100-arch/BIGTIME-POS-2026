import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  beginMfaSetup,
  confirmMfaSetup,
  disableMfa,
  fetchMfaStatus,
  type MfaSetupResponse,
} from "../lib/api-client";
import { clearAuthSession } from "../lib/auth-session";

type DialogState = "setup" | "recovery" | "disable" | null;

function readableError(error: unknown, fallback: string) {
  return error instanceof Error
    ? error.message.replace(/^\d+\s+/, "")
    : fallback;
}

export function MfaSettingsCard() {
  const navigate = useNavigate();
  const statusQuery = useQuery({
    queryKey: ["mfa-status"],
    queryFn: fetchMfaStatus,
  });
  const [dialog, setDialog] = useState<DialogState>(null);
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [recoveryCodesSaved, setRecoveryCodesSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setupMutation = useMutation({
    mutationFn: beginMfaSetup,
    onSuccess: (result) => {
      setSetup(result);
      setCode("");
      setErrorMessage(null);
      setDialog("setup");
    },
    onError: (error) => {
      setErrorMessage(
        readableError(error, "Unable to start authenticator setup."),
      );
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmMfaSetup(code.trim()),
    onSuccess: (result) => {
      setRecoveryCodes(result.recoveryCodes);
      setRecoveryCodesSaved(false);
      setCode("");
      setErrorMessage(null);
      setDialog("recovery");
    },
    onError: (error) => {
      setErrorMessage(readableError(error, "That code could not be verified."));
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => disableMfa(code.trim()),
    onSuccess: () => {
      clearAuthSession();
      navigate("/login", {
        replace: true,
        state: { notice: "Authenticator disabled. Sign in again to continue." },
      });
    },
    onError: (error) => {
      setErrorMessage(
        readableError(error, "Unable to disable the authenticator."),
      );
    },
  });

  const isEnabled = statusQuery.data?.enabled ?? false;
  const recoveryCodesRemaining = statusQuery.data?.recoveryCodesRemaining ?? 0;

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
  }

  function downloadRecoveryCodes() {
    const content = [
      "BIGTIME POS recovery codes",
      "Each code works once. Store this file securely.",
      "",
      ...recoveryCodes,
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/plain" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bigtime-pos-recovery-codes.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function closeDialog() {
    if (dialog === "recovery") return;
    setDialog(null);
    setSetup(null);
    setCode("");
    setErrorMessage(null);
  }

  function finishSetup() {
    if (!recoveryCodesSaved) return;
    clearAuthSession();
    setRecoveryCodes([]);
    navigate("/login", {
      replace: true,
      state: { notice: "Authenticator enabled. Sign in again to continue." },
    });
  }

  return (
    <>
      <section className="rounded-2xl border border-[color:var(--border)] bg-white/90 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--ink)]">
                Two-step verification
              </h2>
              <span
                className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                  isEnabled
                    ? "bg-teal-50 text-teal-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {statusQuery.isLoading
                  ? "Checking..."
                  : isEnabled
                    ? "Enabled"
                    : "Not enabled"}
              </span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">
          {isEnabled
            ? "A code from your authenticator app is required after your PIN."
            : "Add a 6-digit code from an authenticator app after your PIN. This helps protect sales, employee, and reporting data."}
        </p>

        {isEnabled ? (
          <>
            <div className="mt-4 rounded-xl bg-[color:var(--surface-soft)] p-3 text-xs text-[color:var(--muted)]">
              <p>
                Enabled{" "}
                {statusQuery.data?.enabledAt
                  ? new Date(statusQuery.data.enabledAt).toLocaleDateString()
                  : ""}
              </p>
              <p
                className={
                  recoveryCodesRemaining <= 2
                    ? "mt-1 font-semibold text-amber-700"
                    : "mt-1"
                }
              >
                {recoveryCodesRemaining} recovery code
                {recoveryCodesRemaining === 1 ? "" : "s"} remaining
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCode("");
                setErrorMessage(null);
                setDialog("disable");
              }}
              className="mt-4 min-h-11 w-full rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              Disable authenticator
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending || statusQuery.isLoading}
              className="mt-4 min-h-11 w-full rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {setupMutation.isPending
                ? "Starting setup..."
                : "Set up authenticator"}
            </button>
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              You’ll be signed out when setup is complete.
            </p>
          </>
        )}

        {errorMessage && !dialog ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </section>

      {dialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mfa-dialog-title"
            className="w-full max-w-lg rounded-2xl border border-[color:var(--border)] bg-white p-6 shadow-2xl"
          >
            {dialog === "setup" && setup ? (
              <>
                <h3
                  id="mfa-dialog-title"
                  className="text-xl font-bold text-[color:var(--ink)]"
                >
                  Connect your authenticator app
                </h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  Add BIGTIME POS in Google Authenticator, Microsoft
                  Authenticator, 1Password, or another TOTP app.
                </p>
                <a
                  href={setup.otpauthUri}
                  className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-teal-50 px-4 text-sm font-semibold text-teal-800 hover:bg-teal-100"
                >
                  Open authenticator app
                </a>
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Manual setup key
                  </p>
                  <code className="mt-2 block break-all text-sm font-semibold text-slate-900">
                    {setup.manualEntryKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyText(setup.secret)}
                    className="mt-2 min-h-11 text-sm font-semibold text-teal-700"
                  >
                    Copy key
                  </button>
                </div>
                <form
                  className="mt-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    confirmMutation.mutate();
                  }}
                >
                  <label
                    htmlFor="mfa-setup-code"
                    className="text-sm font-semibold text-[color:var(--ink)]"
                  >
                    6-digit code
                  </label>
                  <input
                    id="mfa-setup-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    required
                    minLength={6}
                    maxLength={6}
                    pattern="[0-9]{6}"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    className="mt-2 w-full rounded-xl border border-[color:var(--border)] px-4 py-3 outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
                  />
                  {errorMessage ? (
                    <p className="mt-3 text-sm text-red-700" role="alert">
                      {errorMessage}
                    </p>
                  ) : null}
                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeDialog}
                      disabled={confirmMutation.isPending}
                      className="min-h-11 rounded-xl border border-[color:var(--border)] px-4 text-sm font-semibold"
                    >
                      Cancel setup
                    </button>
                    <button
                      type="submit"
                      disabled={confirmMutation.isPending}
                      className="min-h-11 rounded-xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {confirmMutation.isPending
                        ? "Verifying..."
                        : "Verify code"}
                    </button>
                  </div>
                </form>
              </>
            ) : dialog === "recovery" ? (
              <>
                <h3
                  id="mfa-dialog-title"
                  className="text-xl font-bold text-[color:var(--ink)]"
                >
                  Save your recovery codes
                </h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  Each code can be used once if you lose your authenticator.
                  They won’t be shown again.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl bg-slate-950 p-4 sm:grid-cols-2">
                  {recoveryCodes.map((recoveryCode) => (
                    <code
                      key={recoveryCode}
                      className="select-all text-sm text-white"
                    >
                      {recoveryCode}
                    </code>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyText(recoveryCodes.join("\n"))}
                    className="min-h-11 rounded-xl border border-[color:var(--border)] px-4 text-sm font-semibold"
                  >
                    Copy all
                  </button>
                  <button
                    type="button"
                    onClick={downloadRecoveryCodes}
                    className="min-h-11 rounded-xl border border-[color:var(--border)] px-4 text-sm font-semibold"
                  >
                    Download .txt
                  </button>
                </div>
                <label className="mt-5 flex items-start gap-3 text-sm text-[color:var(--ink)]">
                  <input
                    type="checkbox"
                    checked={recoveryCodesSaved}
                    onChange={(event) =>
                      setRecoveryCodesSaved(event.target.checked)
                    }
                    className="mt-0.5 h-5 w-5 accent-teal-600"
                  />
                  <span>I saved my recovery codes in a secure place.</span>
                </label>
                <button
                  type="button"
                  onClick={finishSetup}
                  disabled={!recoveryCodesSaved}
                  className="mt-5 min-h-11 w-full rounded-xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Finish setup &amp; sign out
                </button>
              </>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  disableMutation.mutate();
                }}
              >
                <h3
                  id="mfa-dialog-title"
                  className="text-xl font-bold text-[color:var(--ink)]"
                >
                  Disable two-step verification?
                </h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  This removes the extra code from sign-in and signs you out of
                  the back office.
                </p>
                <label
                  htmlFor="mfa-disable-code"
                  className="mt-5 block text-sm font-semibold text-[color:var(--ink)]"
                >
                  Authenticator or recovery code
                </label>
                <input
                  id="mfa-disable-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  required
                  minLength={6}
                  maxLength={32}
                  autoComplete="one-time-code"
                  autoFocus
                  className="mt-2 w-full rounded-xl border border-[color:var(--border)] px-4 py-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                />
                {errorMessage ? (
                  <p className="mt-3 text-sm text-red-700" role="alert">
                    {errorMessage}
                  </p>
                ) : null}
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeDialog}
                    disabled={disableMutation.isPending}
                    className="min-h-11 rounded-xl border border-[color:var(--border)] px-4 text-sm font-semibold"
                  >
                    Keep enabled
                  </button>
                  <button
                    type="submit"
                    disabled={disableMutation.isPending}
                    className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {disableMutation.isPending
                      ? "Disabling..."
                      : "Disable & sign out"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
