import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  deleteAccount,
  changeOwnPin,
  fetchAccountProfile,
  resetAccountEmployeeManagement,
  resetAccountInventoryManagement,
  resetAccountPassword,
  updateAccountProfile,
  type AccountDangerActionResponse,
} from "../lib/api-client";
import { clearAuthSession, readAuthSession } from "../lib/auth-session";
import { MfaSettingsCard } from "../components/mfa-settings-card";

type AccountNotice = {
  tone: "success" | "error" | "info";
  message: string;
};

type DangerActionKey =
  | "reset-password"
  | "reset-inventory-management"
  | "reset-employee-management"
  | "delete-account";

type DangerActionConfig = {
  key: DangerActionKey;
  label: string;
  description: string;
  confirmCopy: string;
  confirmTone: "default" | "danger";
};

const dangerActions: DangerActionConfig[] = [
  {
    key: "reset-password",
    label: "Reset Password",
    description:
      "Creates a one-time temporary PIN and signs out every session.",
    confirmCopy:
      "This creates a random temporary PIN, signs out every session, and requires a new PIN at the next login.",
    confirmTone: "default",
  },
  {
    key: "reset-inventory-management",
    label: "Reset All Inventory Management",
    description:
      "Restores the inventory catalog snapshot back to its default seed.",
    confirmCopy:
      "This will restore inventory catalog data to the default seeded state across branches.",
    confirmTone: "danger",
  },
  {
    key: "reset-employee-management",
    label: "Reset All Employee Management",
    description: "Removes managed users and restores the default branch list.",
    confirmCopy:
      "This will remove managed users created in back office and reset branch management data.",
    confirmTone: "danger",
  },
  {
    key: "delete-account",
    label: "Delete Account",
    description:
      "Deletes a managed admin account, or clears built-in admin profile data for safety.",
    confirmCopy:
      "Managed accounts will be removed immediately. Built-in demo admins cannot be deleted and will only have saved profile data cleared.",
    confirmTone: "danger",
  },
];

const dangerMutationMap: Record<
  DangerActionKey,
  () => Promise<AccountDangerActionResponse>
> = {
  "reset-password": resetAccountPassword,
  "reset-inventory-management": resetAccountInventoryManagement,
  "reset-employee-management": resetAccountEmployeeManagement,
  "delete-account": deleteAccount,
};

function buildInitials(value: string) {
  return value
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AccountPage() {
  const session = readAuthSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<AccountNotice | null>(null);
  const [form, setForm] = useState({
    companyName: "",
    companyDescription: "",
  });
  const [isProfileDirty, setIsProfileDirty] = useState(false);
  const [pinForm, setPinForm] = useState({
    currentPin: "",
    newPin: "",
    confirmPin: "",
  });
  const [confirmAction, setConfirmAction] = useState<DangerActionConfig | null>(
    null,
  );

  const fallbackUserName = session?.user.name ?? "ADMIN";
  const fallbackEmail = session?.user.employeeCode
    ? `${session.user.employeeCode.toLowerCase()}@bigtime.pos`
    : "admin@bigtime.pos";

  const profileQuery = useQuery({
    queryKey: ["account-profile"],
    queryFn: fetchAccountProfile,
  });

  const profileForm = useMemo(
    () => ({
      companyName: profileQuery.data?.companyName ?? "",
      companyDescription: profileQuery.data?.companyDescription ?? "",
    }),
    [profileQuery.data?.companyDescription, profileQuery.data?.companyName],
  );
  const effectiveForm = isProfileDirty ? form : profileForm;

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateAccountProfile({
        companyName: effectiveForm.companyName,
        companyDescription: effectiveForm.companyDescription,
      }),
    onSuccess: (nextProfile) => {
      queryClient.setQueryData(["account-profile"], nextProfile);
      setIsProfileDirty(false);
      setForm({
        companyName: nextProfile.companyName,
        companyDescription: nextProfile.companyDescription,
      });
      setNotice({
        tone: "success",
        message: "Account profile saved to the back office.",
      });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save account profile.",
      });
    },
  });

  const dangerMutation = useMutation({
    mutationFn: (action: DangerActionConfig) => dangerMutationMap[action.key](),
    onSuccess: async (result, action) => {
      setConfirmAction(null);
      setNotice({
        tone: action.key === "reset-password" ? "info" : "success",
        message: result.message,
      });

      await queryClient.invalidateQueries();

      if (result.signedOut) {
        window.setTimeout(() => {
          clearAuthSession();
          navigate("/login", {
            replace: true,
            state: { notice: result.message },
          });
        }, 1200);
      }
    },
    onError: (error) => {
      setConfirmAction(null);
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to run account action.",
      });
    },
  });

  const changePinMutation = useMutation({
    mutationFn: () =>
      changeOwnPin({
        currentPin: pinForm.currentPin,
        newPin: pinForm.newPin,
      }),
    onSuccess: (result) => {
      if (result.signedOut) {
        clearAuthSession();
        navigate("/login", {
          replace: true,
          state: { notice: "PIN updated. Sign in again with your new PIN." },
        });
        return;
      }
      queryClient.setQueryData(
        ["account-profile"],
        (current: typeof profileQuery.data) =>
          current
            ? {
                ...current,
                pinUpdatedAt: result.pinUpdatedAt,
                pinExpiresAt: result.pinExpiresAt,
                pinChangeRequired: result.pinChangeRequired,
                pinChangeReason: null,
                failedLoginAttempts: 0,
                remainingLoginAttempts: current.maxFailedLoginAttempts,
                lockedUntil: null,
              }
            : current,
      );
      setPinForm({
        currentPin: "",
        newPin: "",
        confirmPin: "",
      });
      setNotice({
        tone: "success",
        message: result.message,
      });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to update PIN.",
      });
    },
  });

  const userName = profileQuery.data?.name ?? fallbackUserName;
  const userEmail = profileQuery.data?.email ?? fallbackEmail;
  const initials = useMemo(() => buildInitials(userName), [userName]);
  const hasChanges =
    effectiveForm.companyName !== profileForm.companyName ||
    effectiveForm.companyDescription !== profileForm.companyDescription;

  function handleUpdateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMutation.mutate();
  }

  function handleChangePin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{6,12}$/.test(pinForm.newPin.trim())
    ) {
      setNotice({
        tone: "error",
        message:
          "New PIN must be 6–12 characters with at least one letter and one digit.",
      });
      return;
    }
    if (pinForm.newPin !== pinForm.confirmPin) {
      setNotice({
        tone: "error",
        message: "New PIN entries do not match.",
      });
      return;
    }
    if (pinForm.currentPin === pinForm.newPin) {
      setNotice({
        tone: "error",
        message: "Use a different PIN from the current one.",
      });
      return;
    }

    changePinMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--border)] text-xl font-bold text-[color:var(--muted)]">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--ink)]">
            Account Settings
          </h1>
          <p className="text-sm text-[color:var(--muted)]">{userEmail}</p>
        </div>
      </div>

      {notice ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "bg-emerald-50 text-emerald-700"
              : notice.tone === "error"
                ? "bg-rose-50 text-rose-700"
                : "bg-[color:var(--header-tint)] text-slate-700"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-[color:var(--border)] bg-white/90 p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-[color:var(--ink)]">
            Profile Information
          </h2>

          <div className="mb-6 flex justify-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[color:var(--header-tint)] text-3xl font-bold text-[color:var(--muted)]">
              {initials}
            </div>
          </div>

          {profileQuery.isLoading ? (
            <div className="flex min-h-52 items-center justify-center rounded-2xl bg-[color:var(--surface-soft)] text-sm text-[color:var(--muted)]">
              <div className="flex items-center gap-3">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading account profile...
              </div>
            </div>
          ) : profileQuery.isError ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {profileQuery.error instanceof Error
                ? profileQuery.error.message
                : "Failed to load account profile."}
            </div>
          ) : (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[color:var(--ink)]">
                  Email Address
                </label>
                <input
                  type="email"
                  value={userEmail}
                  readOnly
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-2.5 text-sm text-[color:var(--muted)] outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[color:var(--ink)]">
                  Company Name
                </label>
                <input
                  type="text"
                  value={effectiveForm.companyName}
                  onChange={(event) => {
                    setIsProfileDirty(true);
                    setForm((current) => ({
                      ...(isProfileDirty ? current : effectiveForm),
                      companyName: event.target.value,
                    }));
                  }}
                  placeholder="Enter company name"
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-2.5 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[color:var(--ink)]">
                  Company Description
                </label>
                <textarea
                  value={effectiveForm.companyDescription}
                  onChange={(event) => {
                    setIsProfileDirty(true);
                    setForm((current) => ({
                      ...(isProfileDirty ? current : effectiveForm),
                      companyDescription: event.target.value,
                    }));
                  }}
                  placeholder="Enter company description"
                  rows={4}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-3 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saveMutation.isPending || !hasChanges}
                  className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-teal-300 disabled:hover:bg-teal-300"
                >
                  {saveMutation.isPending ? "Saving..." : "Update Profile"}
                </button>
                <span className="text-xs text-[color:var(--muted)]">
                  Changes here are saved in the back office store for this
                  branch.
                </span>
              </div>
            </form>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-[color:var(--border)] bg-white/90 p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-[color:var(--ink)]">
              Credential Security
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              PINs are limited to{" "}
              {profileQuery.data?.maxFailedLoginAttempts ?? 5} failed attempts
              and must be rotated every 30 days for BIR-facing access.
            </p>

            <div className="mt-4 rounded-2xl bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--muted)]">
              <p>
                Last updated:{" "}
                <span className="font-medium text-[color:var(--ink)]">
                  {profileQuery.data?.pinUpdatedAt
                    ? new Date(profileQuery.data.pinUpdatedAt).toLocaleString()
                    : "Not tracked yet"}
                </span>
              </p>
              <p className="mt-1">
                Next required change:{" "}
                <span className="font-medium text-[color:var(--ink)]">
                  {profileQuery.data?.pinExpiresAt
                    ? new Date(profileQuery.data.pinExpiresAt).toLocaleString()
                    : "Will be set after the next successful online login"}
                </span>
              </p>
            </div>

            <form onSubmit={handleChangePin} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[color:var(--ink)]">
                  Current PIN
                </label>
                <input
                  type="password"
                  value={pinForm.currentPin}
                  onChange={(event) =>
                    setPinForm((current) => ({
                      ...current,
                      currentPin: event.target.value,
                    }))
                  }
                  minLength={4}
                  maxLength={12}
                  required
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-2.5 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[color:var(--ink)]">
                  New PIN
                </label>
                <input
                  type="password"
                  value={pinForm.newPin}
                  onChange={(event) =>
                    setPinForm((current) => ({
                      ...current,
                      newPin: event.target.value,
                    }))
                  }
                  minLength={6}
                  maxLength={12}
                  pattern="(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{6,12}"
                  required
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-2.5 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[color:var(--ink)]">
                  Confirm new PIN
                </label>
                <input
                  type="password"
                  value={pinForm.confirmPin}
                  onChange={(event) =>
                    setPinForm((current) => ({
                      ...current,
                      confirmPin: event.target.value,
                    }))
                  }
                  minLength={6}
                  maxLength={12}
                  pattern="(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{6,12}"
                  required
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-2.5 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
                />
              </div>

              <button
                type="submit"
                disabled={changePinMutation.isPending}
                className="rounded-xl bg-[color:var(--accent)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {changePinMutation.isPending ? "Updating PIN..." : "Change PIN"}
              </button>
            </form>
          </div>

          <MfaSettingsCard />

          <div className="rounded-2xl border border-[color:var(--border)] bg-white/90 p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-red-600">
              Danger Zone
            </h2>
            <p className="mb-6 text-sm text-[color:var(--muted)]">
              These actions change live back office data. Use them carefully.
            </p>

            <div className="space-y-3">
              {dangerActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => setConfirmAction(action)}
                  disabled={dangerMutation.isPending}
                  className={`w-full rounded-xl px-4 py-3 text-left transition active:scale-[0.99] ${
                    action.key === "delete-account"
                      ? "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300"
                      : "border border-[color:var(--border)] bg-[color:var(--panel-strong)] text-[color:var(--ink)] hover:bg-[color:var(--surface-soft)] disabled:bg-[color:var(--header-tint)] disabled:text-[color:var(--muted)]"
                  }`}
                >
                  <div className="text-sm font-semibold">{action.label}</div>
                  <div
                    className={`mt-1 text-xs ${
                      action.key === "delete-account"
                        ? "text-red-100"
                        : "text-[color:var(--muted)]"
                    }`}
                  >
                    {action.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {confirmAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[color:var(--ink)]">
              Confirm: {confirmAction.label}
            </h3>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              {confirmAction.confirmCopy}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={dangerMutation.isPending}
                className="rounded-xl border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--ink)] transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => dangerMutation.mutate(confirmAction)}
                disabled={dangerMutation.isPending}
                className={`rounded-xl px-4 py-2 text-sm font-bold text-white transition ${
                  confirmAction.confirmTone === "danger"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[color:var(--accent)] hover:bg-[color:var(--accent-strong)]"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {dangerMutation.isPending ? "Working..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
