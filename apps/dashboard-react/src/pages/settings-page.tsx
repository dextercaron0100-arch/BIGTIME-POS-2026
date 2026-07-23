import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ImagePlus,
  LoaderCircle,
  MonitorPlay,
  Save,
  Trash2,
} from "lucide-react";
import { PageHeader } from "../components/ui/page-header";
import { SectionCard } from "../components/ui/section-card";
import {
  fetchBirSettings,
  createManagedBranch,
  deleteManagedBranch,
  fetchEmployeesAdminAuditLog,
  fetchCustomerDisplaySettings,
  fetchPaymentSettings,
  fetchManagedBranches,
  fetchPosTerminals,
  getMyOrganization,
  type ManagedBranch,
  type ManagedAdminAuditLogRecord,
  type BirSettingsResponse,
  type CustomerDisplaySettingsResponse,
  type PaymentSettingsResponse,
  type PosTerminalSettingsResponse,
  resetPosTerminalName,
  updateBirSettings,
  updateCustomerDisplaySettings,
  updatePaymentSettings,
  updatePosTerminalName,
  uploadCustomerDisplayAssets,
} from "../lib/api-client";
import { readAuthSession } from "../lib/auth-session";
import { useUiStore } from "../store/ui-store";

const tabs = [
  "General",
  "Features",
  "Customer Display",
  "Access Control",
  "BIR",
] as const;
type Tab = (typeof tabs)[number];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("General");

  return (
    <div className="glass-panel space-y-6 p-5 sm:p-6">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Manage your POS system preferences, feature toggles, and BIR compliance configuration."
      />

      <div className="flex gap-1 rounded-2xl bg-[color:var(--surface-soft)] p-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
              activeTab === tab
                ? "bg-[color:var(--accent)] text-white shadow-lg shadow-orange-900/20"
                : "text-[color:var(--muted)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--ink)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "General" && <GeneralSettings />}
      {activeTab === "Features" && <FeaturesSettings />}
      {activeTab === "Customer Display" && <CustomerDisplaySettingsTab />}
      {activeTab === "Access Control" && <AccessControlSettings />}
      {activeTab === "BIR" && <BirSettings />}
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[color:var(--border)] py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-[color:var(--ink)]">{label}</p>
        <p className="mt-0.5 text-xs text-[color:var(--muted)]">
          {description}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-[color:var(--accent)]" : "bg-[color:var(--bg-deep)]"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 transform rounded-full bg-[color:var(--panel-strong)] shadow-md transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function GeneralSettings() {
  const [storeName, setStoreName] = useState("BIGTIME POS");
  const [receiptFooter, setReceiptFooter] = useState(
    "Thank you for your purchase!",
  );
  const [currency, setCurrency] = useState("PHP");
  const [autoLogout, setAutoLogout] = useState(true);

  return (
    <SectionCard
      title="General"
      description="Core settings for your POS system."
    >
      <SettingRow
        label="Store Name"
        description="Displayed on receipts and reports."
      >
        <input
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          className="soft-ring w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
        />
      </SettingRow>
      <SettingRow
        label="Receipt Footer Message"
        description="Custom message printed at the bottom of receipts."
      >
        <input
          value={receiptFooter}
          onChange={(e) => setReceiptFooter(e.target.value)}
          className="soft-ring w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
        />
      </SettingRow>
      <SettingRow
        label="Currency"
        description="Default currency for prices and reports."
      >
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="soft-ring w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
        >
          <option value="PHP">PHP - Philippine Peso</option>
          <option value="USD">USD - US Dollar</option>
        </select>
      </SettingRow>
      <SettingRow
        label="Auto Logout"
        description="Automatically log out cashiers after inactivity."
      >
        <Toggle checked={autoLogout} onChange={setAutoLogout} />
      </SettingRow>
    </SectionCard>
  );
}

function FeaturesSettings() {
  return (
    <div className="space-y-6">
      <BillingSubscriptionsSection />
      <PaymentTypesSection />
      <LoyaltySection />
      <TaxesSection />
      <ReceiptSection />
    </div>
  );
}

function BillingSubscriptionsSection() {
  const organizationQuery = useQuery({
    queryKey: ["my-organization"],
    queryFn: getMyOrganization,
  });

  const org = organizationQuery.data;

  return (
    <SectionCard
      title="Billing & Subscriptions"
      description="Your trial status. Paid plans are not available yet."
    >
      {organizationQuery.isLoading ? (
        <SettingRow label="Status" description="Loading your account status...">
          <span />
        </SettingRow>
      ) : org ? (
        <>
          <SettingRow
            label="Business ID"
            description="You'll need this along with your Admin Code and PIN to sign in."
          >
            <div className="flex items-center gap-2">
              <code className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-1.5 text-sm">
                {org.branchIds[0]}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(org.branchIds[0]);
                }}
                className="rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[color:var(--surface-soft)]"
              >
                Copy
              </button>
            </div>
          </SettingRow>
          <SettingRow label="Account" description={org.name}>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                org.trialState === "TRIAL_EXPIRED"
                  ? "bg-red-100 text-red-700"
                  : org.daysRemaining <= 7
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {org.trialState === "TRIAL_EXPIRED"
                ? "Trial expired"
                : "Free trial"}
            </span>
          </SettingRow>
          <SettingRow
            label="Trial started"
            description={new Date(org.trialStartedAt).toLocaleDateString()}
          >
            <span />
          </SettingRow>
          <SettingRow
            label={
              org.trialState === "TRIAL_EXPIRED" ? "Trial ended" : "Trial ends"
            }
            description={
              org.trialState === "TRIAL_EXPIRED"
                ? new Date(org.trialEndsAt).toLocaleDateString()
                : `${new Date(org.trialEndsAt).toLocaleDateString()} (${org.daysRemaining} day${org.daysRemaining === 1 ? "" : "s"} remaining)`
            }
          >
            <span />
          </SettingRow>
        </>
      ) : (
        <SettingRow
          label="Status"
          description="Unable to load your account status right now."
        >
          <span />
        </SettingRow>
      )}
    </SectionCard>
  );
}

type PaymentTypesFormState = {
  defaultMethod: PaymentSettingsResponse["defaultMethod"];
  methods: PaymentSettingsResponse["methods"];
};

type PaymentTypesDraftState = {
  branchId: string;
  form: PaymentTypesFormState;
};

function PaymentTypesSection() {
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const queryClient = useQueryClient();
  const [draftState, setDraftState] = useState<PaymentTypesDraftState | null>(
    null,
  );
  const [notice, setNotice] = useState<SettingsNotice | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["payment-settings", selectedBranch],
    queryFn: () => fetchPaymentSettings(selectedBranch),
  });

  const savedForm = useMemo(
    () => (settingsQuery.data ? toPaymentTypesForm(settingsQuery.data) : null),
    [settingsQuery.data],
  );
  const draftForm =
    draftState?.branchId === selectedBranch ? draftState.form : null;
  const form = draftForm ?? savedForm;

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
    mutationFn: (nextForm: PaymentTypesFormState) =>
      updatePaymentSettings(selectedBranch, {
        defaultMethod: nextForm.defaultMethod,
        methods: nextForm.methods.map((method) => ({
          code: method.code,
          enabled: method.enabled,
        })),
      }),
    onSuccess: (nextSettings) => {
      queryClient.setQueryData(
        ["payment-settings", selectedBranch],
        nextSettings,
      );
      setDraftState(null);
      setNotice({
        tone: "success",
        message:
          "Payment methods saved. Android and Windows POS terminals will use them after the next sync.",
      });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save payment settings.",
      });
    },
  });

  const busy = saveMutation.isPending;
  const enabledMethods = form?.methods.filter((method) => method.enabled) ?? [];

  function updateDraftForm(
    updater: (current: PaymentTypesFormState) => PaymentTypesFormState,
  ) {
    setDraftState((currentState) => {
      const activeDraft =
        currentState?.branchId === selectedBranch ? currentState.form : null;
      const baseForm = activeDraft ?? savedForm;

      if (!baseForm) {
        return currentState;
      }

      return {
        branchId: selectedBranch,
        form: updater(baseForm),
      };
    });
  }

  function setMethodEnabled(
    code: PaymentSettingsResponse["defaultMethod"],
    enabled: boolean,
  ) {
    if (!form) {
      return;
    }

    const currentlyEnabled = form.methods.filter((method) => method.enabled);
    if (
      !enabled &&
      currentlyEnabled.length <= 1 &&
      currentlyEnabled[0]?.code === code
    ) {
      setNotice({
        tone: "info",
        message: "Keep at least one payment method enabled for POS checkout.",
      });
      return;
    }

    updateDraftForm((current) => {
      const methods = current.methods.map((method) =>
        method.code === code ? { ...method, enabled } : method,
      );
      const nextEnabled = methods.filter((method) => method.enabled);
      const defaultMethod = nextEnabled.some(
        (method) => method.code === current.defaultMethod,
      )
        ? current.defaultMethod
        : (nextEnabled[0]?.code ?? current.defaultMethod);

      return {
        defaultMethod,
        methods,
      };
    });
  }

  function handleSave() {
    if (!form || busy) {
      return;
    }
    saveMutation.mutate(form);
  }

  function resetForm() {
    if (!savedForm || busy) {
      return;
    }

    setDraftState(null);
    setNotice({
      tone: "info",
      message: "Reverted to the last saved payment method settings.",
    });
  }

  return (
    <SectionCard
      title="Payment Types"
      description="Control which payment methods can be used at checkout on Android and Windows POS."
      action={
        <div className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--muted)]">
          {labelForBranch(selectedBranch)}
        </div>
      }
    >
      <div className="space-y-5">
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

        {settingsQuery.isLoading ? (
          <div className="flex min-h-48 items-center justify-center rounded-3xl bg-[color:var(--surface-soft)]">
            <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading payment settings...
            </div>
          </div>
        ) : settingsQuery.isError && !form ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            Failed to load payment settings from the backend.
          </div>
        ) : !form ? (
          <div className="flex min-h-48 items-center justify-center rounded-3xl bg-[color:var(--surface-soft)]">
            <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Preparing payment settings...
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5">
              <div className="space-y-1">
                <p className="text-base font-semibold text-[color:var(--ink)]">
                  Accepted Checkout Methods
                </p>
                <p className="text-sm text-[color:var(--muted)]">
                  Methods turned off here disappear from the Android and Windows
                  checkout screens.
                </p>
              </div>

              <div className="mt-4">
                {form.methods.map((method) => (
                  <SettingRow
                    key={method.code}
                    label={method.label}
                    description={paymentMethodDescription(method.code)}
                  >
                    <Toggle
                      checked={method.enabled}
                      onChange={(nextChecked) =>
                        setMethodEnabled(method.code, nextChecked)
                      }
                      disabled={busy}
                    />
                  </SettingRow>
                ))}
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
              <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5">
                <div className="space-y-2">
                  <p className="text-base font-semibold text-[color:var(--ink)]">
                    Default Payment Method
                  </p>
                  <p className="text-sm text-[color:var(--muted)]">
                    The POS preselects this method when a new payment screen
                    opens.
                  </p>
                </div>

                <label className="mt-5 block space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--ink)]">
                    Checkout default
                  </span>
                  <select
                    value={form.defaultMethod}
                    onChange={(event) =>
                      updateDraftForm((current) => ({
                        ...current,
                        defaultMethod: event.target
                          .value as PaymentSettingsResponse["defaultMethod"],
                      }))
                    }
                    disabled={busy || enabledMethods.length === 0}
                    className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {enabledMethods.map((method) => (
                      <option key={method.code} value={method.code}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-5 rounded-2xl bg-[color:var(--bg-soft)] px-4 py-4 text-sm text-[color:var(--muted)]">
                  Split payments can also be disabled here if you want checkout
                  to stay single-tender only.
                </div>
              </div>

              <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5">
                <div className="space-y-2">
                  <p className="text-base font-semibold text-[color:var(--ink)]">
                    Publish to POS
                  </p>
                  <p className="text-sm text-[color:var(--muted)]">
                    Save these settings so both Android and Windows terminals
                    can sync the allowed methods.
                  </p>
                </div>

                <div className="mt-5 space-y-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={busy}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Payment Settings
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={busy}
                    className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reset
                  </button>
                  <p className="text-xs text-[color:var(--muted)]">
                    Last saved: {formatUpdatedAt(settingsQuery.data?.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}

function LoyaltySection() {
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [pointsPerPeso, setPointsPerPeso] = useState("1");
  const [redeemThreshold, setRedeemThreshold] = useState("500");
  const [redeemValue, setRedeemValue] = useState("5");
  const [expiryMonths, setExpiryMonths] = useState("12");

  return (
    <SectionCard
      title="Loyalty"
      description="Customer loyalty points program configuration."
    >
      <SettingRow
        label="Loyalty Program"
        description="Enable points earning and redemption for customers."
      >
        <Toggle checked={loyaltyEnabled} onChange={setLoyaltyEnabled} />
      </SettingRow>
      <SettingRow
        label="Points per Peso Spent"
        description="How many points a customer earns per peso."
      >
        <input
          type="number"
          min="0"
          value={pointsPerPeso}
          onChange={(e) => setPointsPerPeso(e.target.value)}
          className="soft-ring w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
        />
      </SettingRow>
      <SettingRow
        label="Minimum Points to Redeem"
        description="Points required before a customer can redeem."
      >
        <input
          type="number"
          min="0"
          value={redeemThreshold}
          onChange={(e) => setRedeemThreshold(e.target.value)}
          className="soft-ring w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
        />
      </SettingRow>
      <SettingRow
        label="Redemption Value (PHP)"
        description="Peso discount per redemption."
      >
        <input
          type="number"
          min="0"
          value={redeemValue}
          onChange={(e) => setRedeemValue(e.target.value)}
          className="soft-ring w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
        />
      </SettingRow>
      <SettingRow
        label="Points Expiry (months)"
        description="Number of months before unused points expire."
      >
        <input
          type="number"
          min="1"
          value={expiryMonths}
          onChange={(e) => setExpiryMonths(e.target.value)}
          className="soft-ring w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
        />
      </SettingRow>
    </SectionCard>
  );
}

function TaxesSection() {
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState("12");
  const [vatInclusive, setVatInclusive] = useState(true);
  const [seniorDiscount, setSeniorDiscount] = useState(true);
  const [seniorRate, setSeniorRate] = useState("20");
  const [pwdDiscount, setPwdDiscount] = useState(true);

  return (
    <SectionCard title="Taxes" description="Tax rates and exemption rules.">
      <SettingRow
        label="VAT"
        description="Enable Value Added Tax on transactions."
      >
        <Toggle checked={vatEnabled} onChange={setVatEnabled} />
      </SettingRow>
      <SettingRow
        label="VAT Rate (%)"
        description="Percentage rate applied to taxable items."
      >
        <input
          type="number"
          min="0"
          max="100"
          value={vatRate}
          onChange={(e) => setVatRate(e.target.value)}
          className="soft-ring w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
        />
      </SettingRow>
      <SettingRow
        label="VAT Inclusive Pricing"
        description="Prices already include VAT (no additional charge)."
      >
        <Toggle checked={vatInclusive} onChange={setVatInclusive} />
      </SettingRow>
      <SettingRow
        label="Senior Citizen Discount"
        description="Enable automatic senior citizen tax exemption."
      >
        <Toggle checked={seniorDiscount} onChange={setSeniorDiscount} />
      </SettingRow>
      <SettingRow
        label="Senior Discount Rate (%)"
        description="Discount percentage for senior citizens."
      >
        <input
          type="number"
          min="0"
          max="100"
          value={seniorRate}
          onChange={(e) => setSeniorRate(e.target.value)}
          className="soft-ring w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
        />
      </SettingRow>
      <SettingRow
        label="PWD Discount"
        description="Enable discount for persons with disability."
      >
        <Toggle checked={pwdDiscount} onChange={setPwdDiscount} />
      </SettingRow>
    </SectionCard>
  );
}

function ReceiptSection() {
  const [autoPrint, setAutoPrint] = useState(true);
  const [copies, setCopies] = useState("1");
  const [paperSize, setPaperSize] = useState("58mm");
  const [showLogo, setShowLogo] = useState(true);
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("Thank you for your purchase!");
  const [showCashierName, setShowCashierName] = useState(true);
  const [showBranchAddress, setShowBranchAddress] = useState(true);

  return (
    <SectionCard
      title="Receipt"
      description="Customize how receipts are printed and displayed."
    >
      <SettingRow
        label="Auto-Print"
        description="Automatically print receipt after each transaction."
      >
        <Toggle checked={autoPrint} onChange={setAutoPrint} />
      </SettingRow>
      <SettingRow
        label="Number of Copies"
        description="How many receipt copies to print per transaction."
      >
        <input
          type="number"
          min="1"
          max="5"
          value={copies}
          onChange={(e) => setCopies(e.target.value)}
          className="soft-ring w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
        />
      </SettingRow>
      <SettingRow label="Paper Size" description="Thermal printer paper width.">
        <select
          value={paperSize}
          onChange={(e) => setPaperSize(e.target.value)}
          className="soft-ring w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
        >
          <option value="58mm">58mm</option>
          <option value="80mm">80mm</option>
        </select>
      </SettingRow>
      <SettingRow
        label="Show Store Logo"
        description="Print store logo at the top of the receipt."
      >
        <Toggle checked={showLogo} onChange={setShowLogo} />
      </SettingRow>
      <SettingRow
        label="Receipt Header"
        description="Custom text printed below the logo."
      >
        <input
          value={headerText}
          onChange={(e) => setHeaderText(e.target.value)}
          placeholder="Enter header text"
          className="soft-ring w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
        />
      </SettingRow>
      <SettingRow
        label="Receipt Footer"
        description="Custom text printed at the bottom."
      >
        <input
          value={footerText}
          onChange={(e) => setFooterText(e.target.value)}
          placeholder="Enter footer text"
          className="soft-ring w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
        />
      </SettingRow>
      <SettingRow
        label="Show Cashier Name"
        description="Display the cashier's name on the receipt."
      >
        <Toggle checked={showCashierName} onChange={setShowCashierName} />
      </SettingRow>
      <SettingRow
        label="Show Branch Address"
        description="Print the branch address on the receipt."
      >
        <Toggle checked={showBranchAddress} onChange={setShowBranchAddress} />
      </SettingRow>
    </SectionCard>
  );
}

type CustomerDisplayFormState = {
  thankYouMessage: string;
  launchFullscreen: boolean;
  imageDurationSeconds: number;
  assets: CustomerDisplaySettingsResponse["assets"];
};

type CustomerDisplayDraftState = {
  branchId: string;
  form: CustomerDisplayFormState;
};

type SettingsNotice = {
  tone: "success" | "error" | "info";
  message: string;
};

type BirSettingsFormState = {
  birEnabled: boolean;
  autoZRead: boolean;
  storeName: string;
  proprietorName: string;
  vatTin: string;
  permitNumber: string;
  permitDateIssued: string;
  authorityToPrintNumber: string;
  authorityToPrintDateIssued: string;
  approvedSerialRange: string;
  machineIdentificationNumber: string;
  serialNumber: string;
  businessAddressText: string;
  footerText: string;
};

type BirSettingsDraftState = {
  branchId: string;
  form: BirSettingsFormState;
};

function CustomerDisplaySettingsTab() {
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const queryClient = useQueryClient();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [draftState, setDraftState] =
    useState<CustomerDisplayDraftState | null>(null);
  const [notice, setNotice] = useState<SettingsNotice | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["customer-display-settings", selectedBranch],
    queryFn: () => fetchCustomerDisplaySettings(selectedBranch),
  });

  const savedForm = useMemo(
    () =>
      settingsQuery.data ? toCustomerDisplayForm(settingsQuery.data) : null,
    [settingsQuery.data],
  );
  const draftForm =
    draftState?.branchId === selectedBranch ? draftState.form : null;
  const form = draftForm ?? savedForm;

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
    mutationFn: (nextForm: CustomerDisplayFormState) =>
      updateCustomerDisplaySettings(selectedBranch, {
        thankYouMessage:
          nextForm.thankYouMessage.trim() || "Thank you for your purchase",
        launchFullscreen: nextForm.launchFullscreen,
        imageDurationSeconds: nextForm.imageDurationSeconds,
        assetIds: nextForm.assets.map((asset) => asset.id),
      }),
    onSuccess: (nextSettings) => {
      queryClient.setQueryData(
        ["customer-display-settings", selectedBranch],
        nextSettings,
      );
      setDraftState(null);
      setNotice({
        tone: "success",
        message:
          "Customer face display settings saved. The Windows POS will pull them on the next sync.",
      });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save customer display settings.",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) =>
      uploadCustomerDisplayAssets(selectedBranch, files),
    onSuccess: (nextSettings) => {
      queryClient.setQueryData(
        ["customer-display-settings", selectedBranch],
        nextSettings,
      );
      setDraftState(null);
      setNotice({
        tone: "success",
        message: "Media uploaded for the customer face display.",
      });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to upload CFD media.",
      });
    },
  });

  const busy = saveMutation.isPending || uploadMutation.isPending;

  function updateDraftForm(
    updater: (current: CustomerDisplayFormState) => CustomerDisplayFormState,
  ) {
    setDraftState((currentState) => {
      const activeDraft =
        currentState?.branchId === selectedBranch ? currentState.form : null;
      const baseForm = activeDraft ?? savedForm;

      if (!baseForm) {
        return currentState;
      }

      return {
        branchId: selectedBranch,
        form: updater(baseForm),
      };
    });
  }

  function handleSave() {
    if (!form || busy) {
      return;
    }

    saveMutation.mutate(form);
  }

  function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0 || busy) {
      return;
    }

    uploadMutation.mutate(files);
    event.target.value = "";
  }

  function removeAsset(assetId: string) {
    updateDraftForm((current) => ({
      ...current,
      assets: current.assets.filter((asset) => asset.id !== assetId),
    }));
  }

  function resetForm() {
    if (!savedForm) {
      return;
    }

    setDraftState(null);
    setNotice({
      tone: "info",
      message: "Reverted to the last saved customer display settings.",
    });
  }

  return (
    <SectionCard
      title="Customer Face Display"
      description="Manage the in-store customer display. The left panel shows promotions while the right panel shows the live basket and thank-you screen."
      action={
        <div className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--muted)]">
          {labelForBranch(selectedBranch)}
        </div>
      }
    >
      <div className="space-y-5">
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

        {settingsQuery.isLoading ? (
          <div className="flex min-h-60 items-center justify-center rounded-3xl bg-[color:var(--surface-soft)]">
            <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading customer display settings...
            </div>
          </div>
        ) : settingsQuery.isError && !form ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            Failed to load customer display settings from the backend.
          </div>
        ) : !form ? (
          <div className="flex min-h-60 items-center justify-center rounded-3xl bg-[color:var(--surface-soft)]">
            <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Preparing customer display settings...
            </div>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1.3fr,0.9fr]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-semibold text-[color:var(--ink)]">
                      Promo Media
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      Upload the images and videos shown on the left side of the
                      CFD.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={handleUploadChange}
                    />
                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      disabled={busy}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ImagePlus className="h-4 w-4" />
                      Upload Media
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={busy}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-medium text-slate-700 transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {form.assets.map((asset) => (
                    <article
                      key={asset.id}
                      className="overflow-hidden rounded-[24px] border border-[color:var(--border)] bg-[color:var(--bg-soft)]"
                    >
                      <div className="aspect-[16/10] bg-slate-900">
                        {asset.kind === "image" ? (
                          <img
                            src={asset.url}
                            alt={asset.fileName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <video
                            src={asset.url}
                            className="h-full w-full object-cover"
                            muted
                            loop
                            playsInline
                            autoPlay
                          />
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[color:var(--ink)]">
                            {asset.fileName}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                            {asset.kind} • {formatFileSize(asset.sizeBytes)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAsset(asset.id)}
                          disabled={busy}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Remove ${asset.fileName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                {form.assets.length === 0 ? (
                  <div className="mt-5 rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-6 text-sm text-[color:var(--muted)]">
                    No promo media uploaded yet.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5">
                <div className="flex items-center gap-3">
                  <MonitorPlay className="h-5 w-5 text-[color:var(--accent)]" />
                  <div>
                    <p className="text-base font-semibold text-[color:var(--ink)]">
                      Display Behavior
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      Controls the right-side receipt view and the thank-you
                      state after checkout.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-[color:var(--ink)]">
                      Thank-you message
                    </span>
                    <textarea
                      value={form.thankYouMessage}
                      onChange={(event) =>
                        updateDraftForm((current) => ({
                          ...current,
                          thankYouMessage: event.target.value,
                        }))
                      }
                      rows={4}
                      className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)]"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-[color:var(--ink)]">
                      Image rotation
                    </span>
                    <select
                      value={String(form.imageDurationSeconds)}
                      onChange={(event) =>
                        updateDraftForm((current) => ({
                          ...current,
                          imageDurationSeconds: Number(event.target.value),
                        }))
                      }
                      className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)]"
                    >
                      {[4, 6, 8, 10, 12].map((seconds) => (
                        <option key={seconds} value={seconds}>
                          {seconds} seconds
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-start gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-soft)] px-4 py-4">
                    <input
                      type="checkbox"
                      checked={form.launchFullscreen}
                      onChange={(event) =>
                        updateDraftForm((current) => ({
                          ...current,
                          launchFullscreen: event.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
                    />
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--ink)]">
                        Open CFD in fullscreen
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--muted)]">
                        Recommended for a dedicated customer-facing monitor.
                      </p>
                    </div>
                  </label>

                  <div className="rounded-2xl bg-[color:var(--bg-soft)] px-4 py-4 text-sm text-[color:var(--muted)]">
                    The Windows CFD now uses a convenience-store layout: ads on
                    the left, live basket on the right.
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[color:var(--ink)]">
                      Publish to POS
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      Save these settings so the Windows app can sync them
                      locally.
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={busy}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save CFD Settings
                  </button>
                  <p className="text-xs text-[color:var(--muted)]">
                    Last saved: {formatUpdatedAt(settingsQuery.data?.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function AccessControlSettings() {
  const queryClient = useQueryClient();
  const session = readAuthSession();
  const isAdmin = session?.user.role?.toUpperCase() === "ADMIN";
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const [branchName, setBranchName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [notice, setNotice] = useState<SettingsNotice | null>(null);
  const [terminalDrafts, setTerminalDrafts] = useState<Record<string, string>>(
    {},
  );

  const branchesQuery = useQuery({
    queryKey: ["managed-branches"],
    queryFn: fetchManagedBranches,
    enabled: isAdmin,
  });
  const terminalsQuery = useQuery({
    queryKey: ["pos-terminals", selectedBranch],
    queryFn: () => fetchPosTerminals(selectedBranch),
    enabled: isAdmin,
  });
  const auditLogQuery = useQuery({
    queryKey: ["managed-users-audit-log"],
    queryFn: () => fetchEmployeesAdminAuditLog(300),
    enabled: isAdmin,
  });

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const createBranchMutation = useMutation({
    mutationFn: () =>
      createManagedBranch({
        name: branchName.trim(),
        id: branchId.trim() || undefined,
      }),
    onSuccess: async () => {
      setBranchName("");
      setBranchId("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["managed-branches"] }),
        queryClient.invalidateQueries({
          queryKey: ["managed-users-audit-log"],
        }),
      ]);
      setNotice({
        tone: "success",
        message: "Branch added successfully.",
      });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to create branch.",
      });
    },
  });
  const deleteBranchMutation = useMutation({
    mutationFn: (branch: ManagedBranch) => deleteManagedBranch(branch.id),
    onSuccess: async (branch) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["managed-branches"] }),
        queryClient.invalidateQueries({
          queryKey: ["managed-users-audit-log"],
        }),
      ]);
      setNotice({
        tone: "info",
        message: `${branch.name} was removed from Branch Management.`,
      });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to delete branch.",
      });
    },
  });
  const saveTerminalMutation = useMutation({
    mutationFn: ({ terminalId, name }: { terminalId: string; name: string }) =>
      updatePosTerminalName(terminalId, { name }),
    onSuccess: async (terminal) => {
      setTerminalDrafts((current) => ({
        ...current,
        [terminal.id]: terminal.name,
      }));
      setNotice({
        tone: "success",
        message: `${terminal.name} is now the saved device name for ${labelForBranch(
          terminal.branchId,
        )}.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["pos-terminals", terminal.branchId],
        }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
      ]);
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save the device name.",
      });
    },
  });
  const resetTerminalMutation = useMutation({
    mutationFn: (terminalId: string) => resetPosTerminalName(terminalId),
    onSuccess: async (terminal) => {
      setTerminalDrafts((current) => ({
        ...current,
        [terminal.id]: terminal.name,
      }));
      setNotice({
        tone: "info",
        message: `Reset ${terminal.defaultName} back to its default device name.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["pos-terminals", terminal.branchId],
        }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
      ]);
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to reset the device name.",
      });
    },
  });

  if (!isAdmin) {
    return (
      <SectionCard
        title="Access Control"
        description="Branch administration and audit review are restricted to administrator accounts."
      >
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You are not allowed to manage branches or review access-control audit
          logs.
        </div>
      </SectionCard>
    );
  }

  const branches: ManagedBranch[] = branchesQuery.data ?? [];
  const terminals: PosTerminalSettingsResponse[] = terminalsQuery.data ?? [];
  const auditRows: ManagedAdminAuditLogRecord[] = auditLogQuery.data ?? [];
  const busy =
    createBranchMutation.isPending ||
    deleteBranchMutation.isPending ||
    saveTerminalMutation.isPending ||
    resetTerminalMutation.isPending;

  return (
    <div className="space-y-6">
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

      <SectionCard
        title="Branch Management"
        description="Create or remove branches. Only admin accounts can manage branches."
      >
        <div className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
          <input
            value={branchName}
            onChange={(event) => setBranchName(event.target.value)}
            placeholder="Branch Name (e.g. Davao Downtown)"
            className="soft-ring rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
          />
          <input
            value={branchId}
            onChange={(event) => setBranchId(event.target.value.toLowerCase())}
            placeholder="branch-davao (optional)"
            className="soft-ring rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || branchName.trim().length < 2}
            onClick={() => createBranchMutation.mutate()}
            className="inline-flex items-center justify-center rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add Branch
          </button>
        </div>
        <div className="mt-4 grid gap-2">
          {branches.map((branch) => {
            const isOnlyBranch = branches.length === 1;

            return (
              <div
                key={branch.id}
                className="flex flex-col gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-[color:var(--ink)]">
                    {branch.name}
                  </p>
                  <p className="text-xs text-[color:var(--muted)]">
                    {branch.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteBranchMutation.mutate(branch)}
                  disabled={busy || isOnlyBranch}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Branch
                </button>
              </div>
            );
          })}
          {branches.length === 1 ? (
            <p className="text-xs text-[color:var(--muted)]">
              The last remaining branch is protected from deletion.
            </p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Device Name Control"
        description="Rename the POS devices shown in back office lists and assigned-device pickers."
        action={
          <div className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--muted)]">
            {labelForBranch(selectedBranch)}
          </div>
        }
      >
        {terminalsQuery.isLoading ? (
          <div className="flex min-h-40 items-center justify-center rounded-3xl bg-[color:var(--surface-soft)]">
            <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading POS devices...
            </div>
          </div>
        ) : terminalsQuery.isError ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            Failed to load POS devices for this branch.
          </div>
        ) : terminals.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-6 text-sm text-[color:var(--muted)]">
            No editable POS devices were found for this branch yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {terminals.map((terminal) => {
              const draftName = terminalDrafts[terminal.id] ?? terminal.name;
              const trimmedDraft = draftName.trim();
              const hasValidationError = trimmedDraft.length < 2;
              const unchanged = trimmedDraft === terminal.name;

              return (
                <div
                  key={terminal.id}
                  className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-[color:var(--ink)]">
                        {terminal.name}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        {terminal.id}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        Serial: {terminal.serialNumber} · Status:{" "}
                        {terminal.status}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        Default name: {terminal.defaultName}
                      </p>
                    </div>

                    <div className="w-full max-w-xl space-y-3">
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-[color:var(--ink)]">
                          Saved device name
                        </span>
                        <input
                          value={draftName}
                          onChange={(event) =>
                            setTerminalDrafts((current) => ({
                              ...current,
                              [terminal.id]: event.target.value,
                            }))
                          }
                          className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)]"
                          placeholder="Enter device name"
                        />
                      </label>

                      {hasValidationError ? (
                        <p className="text-sm text-amber-700">
                          Device name must be at least 2 characters.
                        </p>
                      ) : null}

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            saveTerminalMutation.mutate({
                              terminalId: terminal.id,
                              name: trimmedDraft,
                            })
                          }
                          disabled={busy || hasValidationError || unchanged}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Save className="h-4 w-4" />
                          Save Device Name
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            resetTerminalMutation.mutate(terminal.id)
                          }
                          disabled={busy || !terminal.hasCustomName}
                          className="inline-flex h-11 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reset to Default
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Admin Audit Log"
        description="Immutable branch/user provisioning actions for compliance review."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
              <tr>
                <th className="px-3 py-2">Timestamp</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Branch</th>
                <th className="px-3 py-2">Actor</th>
              </tr>
            </thead>
            <tbody>
              {auditRows.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-3 text-[color:var(--muted)]"
                    colSpan={5}
                  >
                    No admin audit records found.
                  </td>
                </tr>
              ) : (
                auditRows.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-t border-[color:var(--border)]"
                  >
                    <td className="px-3 py-2">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{entry.action}</td>
                    <td className="px-3 py-2">
                      {entry.targetType}: {entry.targetId}
                    </td>
                    <td className="px-3 py-2">{entry.branchId}</td>
                    <td className="px-3 py-2">
                      {entry.actorUserId ?? "system"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function toCustomerDisplayForm(
  settings: CustomerDisplaySettingsResponse,
): CustomerDisplayFormState {
  return {
    thankYouMessage: settings.thankYouMessage,
    launchFullscreen: settings.launchFullscreen,
    imageDurationSeconds: settings.imageDurationSeconds,
    assets: settings.assets,
  };
}

function toPaymentTypesForm(
  settings: PaymentSettingsResponse,
): PaymentTypesFormState {
  return {
    defaultMethod: settings.defaultMethod,
    methods: settings.methods,
  };
}

function toBirSettingsForm(
  settings: BirSettingsResponse,
): BirSettingsFormState {
  return {
    birEnabled: settings.birEnabled,
    autoZRead: settings.autoZRead,
    storeName: settings.storeName,
    proprietorName: settings.proprietorName,
    vatTin: settings.vatTin,
    permitNumber: settings.permitNumber,
    permitDateIssued: settings.permitDateIssued,
    authorityToPrintNumber: settings.authorityToPrintNumber,
    authorityToPrintDateIssued: settings.authorityToPrintDateIssued,
    approvedSerialRange: settings.approvedSerialRange,
    machineIdentificationNumber: settings.machineIdentificationNumber,
    serialNumber: settings.serialNumber,
    businessAddressText: settings.businessAddressLines.join("\n"),
    footerText: settings.footerLines.join("\n"),
  };
}

function linesFromTextarea(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function paymentMethodDescription(
  code: PaymentSettingsResponse["defaultMethod"],
) {
  switch (code) {
    case "CARD":
      return "Accept credit or debit card payments via terminal.";
    case "GCASH":
      return "Accept GCash mobile wallet payments.";
    case "MAYA":
      return "Accept Maya digital payments.";
    case "SPLIT":
      return "Allow split-tender checkout using more than one payment source.";
    default:
      return "Accept cash payments.";
  }
}

function labelForBranch(branchId: string) {
  switch (branchId) {
    case "branch-crossing-calmba":
      return "CROSSING CALMBA";
    case "branch-cebu":
      return "Cebu Ayala";
    case "branch-davao":
      return "Davao Downtown";
    default:
      return "Manila Flagship";
  }
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUpdatedAt(value?: string) {
  if (!value) {
    return "Not yet saved";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not yet saved";
  }

  return date.toLocaleString();
}

function BirSettings() {
  const selectedBranch = useUiStore((state) => state.selectedBranch);
  const queryClient = useQueryClient();
  const [draftState, setDraftState] = useState<BirSettingsDraftState | null>(
    null,
  );
  const [notice, setNotice] = useState<SettingsNotice | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["bir-settings", selectedBranch],
    queryFn: () => fetchBirSettings(selectedBranch),
  });

  const savedForm = useMemo(
    () => (settingsQuery.data ? toBirSettingsForm(settingsQuery.data) : null),
    [settingsQuery.data],
  );
  const draftForm =
    draftState?.branchId === selectedBranch ? draftState.form : null;
  const form = draftForm ?? savedForm;

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
    mutationFn: (nextForm: BirSettingsFormState) =>
      updateBirSettings(selectedBranch, {
        birEnabled: nextForm.birEnabled,
        autoZRead: nextForm.autoZRead,
        storeName: nextForm.storeName.trim(),
        proprietorName: nextForm.proprietorName.trim(),
        vatTin: nextForm.vatTin.trim(),
        permitNumber: nextForm.permitNumber.trim(),
        permitDateIssued: nextForm.permitDateIssued.trim(),
        authorityToPrintNumber: nextForm.authorityToPrintNumber.trim(),
        authorityToPrintDateIssued: nextForm.authorityToPrintDateIssued.trim(),
        approvedSerialRange: nextForm.approvedSerialRange.trim(),
        machineIdentificationNumber:
          nextForm.machineIdentificationNumber.trim(),
        serialNumber: nextForm.serialNumber.trim(),
        businessAddressLines: linesFromTextarea(nextForm.businessAddressText),
        footerLines: linesFromTextarea(nextForm.footerText),
      }),
    onSuccess: (nextSettings) => {
      queryClient.setQueryData(["bir-settings", selectedBranch], nextSettings);
      setDraftState(null);
      setNotice({
        tone: "success",
        message:
          "BIR invoice and report settings saved. Android and Windows POS terminals will use the updated legal print metadata after the next sync.",
      });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save BIR settings.",
      });
    },
  });

  const busy = saveMutation.isPending;

  function updateDraftForm(
    updater: (current: BirSettingsFormState) => BirSettingsFormState,
  ) {
    setDraftState((currentState) => {
      const activeDraft =
        currentState?.branchId === selectedBranch ? currentState.form : null;
      const baseForm = activeDraft ?? savedForm;

      if (!baseForm) {
        return currentState;
      }

      return {
        branchId: selectedBranch,
        form: updater(baseForm),
      };
    });
  }

  function handleSave() {
    if (!form || busy) {
      return;
    }

    saveMutation.mutate(form);
  }

  function resetForm() {
    if (!savedForm || busy) {
      return;
    }

    setDraftState(null);
    setNotice({
      tone: "info",
      message: "Reverted to the last saved BIR invoice settings.",
    });
  }

  return (
    <SectionCard
      title="BIR Compliance"
      description="Control the legal header and footer printed on X-reading and other BIR-facing reports."
      action={
        <div className="rounded-full bg-[color:var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--muted)]">
          {labelForBranch(selectedBranch)}
        </div>
      }
    >
      <div className="space-y-5">
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

        {settingsQuery.isLoading ? (
          <div className="flex min-h-56 items-center justify-center rounded-3xl bg-[color:var(--surface-soft)]">
            <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading BIR settings...
            </div>
          </div>
        ) : settingsQuery.isError && !form ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            Failed to load BIR settings from the backend.
          </div>
        ) : !form ? (
          <div className="flex min-h-56 items-center justify-center rounded-3xl bg-[color:var(--surface-soft)]">
            <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Preparing BIR settings...
            </div>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
            <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5">
              <div className="space-y-1">
                <p className="text-base font-semibold text-[color:var(--ink)]">
                  Receipt Header Fields
                </p>
                <p className="text-sm text-[color:var(--muted)]">
                  These values drive the legal header and footer printed on
                  sales invoices, X-readings, and related BIR-facing outputs.
                </p>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--ink)]">
                    Store name
                  </span>
                  <input
                    value={form.storeName}
                    onChange={(event) =>
                      updateDraftForm((current) => ({
                        ...current,
                        storeName: event.target.value,
                      }))
                    }
                    disabled={busy}
                    placeholder="MAX'S CONVENIENCE STORE"
                    className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--ink)]">
                    Proprietor / owner
                  </span>
                  <input
                    value={form.proprietorName}
                    onChange={(event) =>
                      updateDraftForm((current) => ({
                        ...current,
                        proprietorName: event.target.value,
                      }))
                    }
                    disabled={busy}
                    placeholder="Henry John Garcia Agcaoili"
                    className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--ink)]">
                    VAT REG TIN
                  </span>
                  <input
                    value={form.vatTin}
                    onChange={(event) =>
                      updateDraftForm((current) => ({
                        ...current,
                        vatTin: event.target.value,
                      }))
                    }
                    disabled={busy}
                    placeholder="318-502-162-00008"
                    className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--ink)]">
                    PN / Permit No.
                  </span>
                  <input
                    value={form.permitNumber}
                    onChange={(event) =>
                      updateDraftForm((current) => ({
                        ...current,
                        permitNumber: event.target.value,
                      }))
                    }
                    disabled={busy}
                    placeholder="FP022026-013-0585564-00008"
                    className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--ink)]">
                    MIN
                  </span>
                  <input
                    value={form.machineIdentificationNumber}
                    onChange={(event) =>
                      updateDraftForm((current) => ({
                        ...current,
                        machineIdentificationNumber: event.target.value,
                      }))
                    }
                    disabled={busy}
                    placeholder="26021811495592303"
                    className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--ink)]">
                    Serial number
                  </span>
                  <input
                    value={form.serialNumber}
                    onChange={(event) =>
                      updateDraftForm((current) => ({
                        ...current,
                        serialNumber: event.target.value,
                      }))
                    }
                    disabled={busy}
                    placeholder="5182025070800517"
                    className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--ink)]">
                    Permit date issued
                  </span>
                  <input
                    value={form.permitDateIssued}
                    onChange={(event) =>
                      updateDraftForm((current) => ({
                        ...current,
                        permitDateIssued: event.target.value,
                      }))
                    }
                    disabled={busy}
                    placeholder="02/15/2026"
                    className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--ink)]">
                    Authority to print number
                  </span>
                  <input
                    value={form.authorityToPrintNumber}
                    onChange={(event) =>
                      updateDraftForm((current) => ({
                        ...current,
                        authorityToPrintNumber: event.target.value,
                      }))
                    }
                    disabled={busy}
                    placeholder="ATP-2026-000123"
                    className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--ink)]">
                    ATP date issued
                  </span>
                  <input
                    value={form.authorityToPrintDateIssued}
                    onChange={(event) =>
                      updateDraftForm((current) => ({
                        ...current,
                        authorityToPrintDateIssued: event.target.value,
                      }))
                    }
                    disabled={busy}
                    placeholder="02/15/2026"
                    className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--ink)]">
                    Approved serial range
                  </span>
                  <input
                    value={form.approvedSerialRange}
                    onChange={(event) =>
                      updateDraftForm((current) => ({
                        ...current,
                        approvedSerialRange: event.target.value,
                      }))
                    }
                    disabled={busy}
                    placeholder="SI000001-SI999999"
                    className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              </div>

              <label className="mt-5 block space-y-2">
                <span className="text-sm font-semibold text-[color:var(--ink)]">
                  Store address lines
                </span>
                <textarea
                  value={form.businessAddressText}
                  onChange={(event) =>
                    updateDraftForm((current) => ({
                      ...current,
                      businessAddressText: event.target.value,
                    }))
                  }
                  rows={5}
                  disabled={busy}
                  placeholder={
                    "SITIO TANAP LANGAGAN 3518\nSANCHEZ-MIRA CAGAYAN,\nPHILIPPINES"
                  }
                  className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <div className="mt-5 rounded-2xl bg-[color:var(--bg-soft)] px-4 py-4 text-sm text-[color:var(--muted)]">
                Leave a field blank if you do not want that line printed. The
                POS will keep the section order from the sample receipt.
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-[color:var(--ink)]">
                    Compliance Flags
                  </p>
                  <p className="text-sm text-[color:var(--muted)]">
                    These options control whether the legal header is active and
                    whether end-of-day Z-reading should be automated later.
                  </p>
                </div>

                <div className="mt-4">
                  <SettingRow
                    label="BIR Integration"
                    description="Enable the legal BIR header and footer on printed reports."
                  >
                    <Toggle
                      checked={form.birEnabled}
                      onChange={(nextChecked) =>
                        updateDraftForm((current) => ({
                          ...current,
                          birEnabled: nextChecked,
                        }))
                      }
                      disabled={busy}
                    />
                  </SettingRow>

                  <SettingRow
                    label="Auto Z-Read"
                    description="Store the branch preference for automatic daily Z-reading generation."
                  >
                    <Toggle
                      checked={form.autoZRead}
                      onChange={(nextChecked) =>
                        updateDraftForm((current) => ({
                          ...current,
                          autoZRead: nextChecked,
                        }))
                      }
                      disabled={busy}
                    />
                  </SettingRow>
                </div>
              </div>

              <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5">
                <div className="space-y-2">
                  <p className="text-base font-semibold text-[color:var(--ink)]">
                    Footer Lines
                  </p>
                  <p className="text-sm text-[color:var(--muted)]">
                    Each line is centered at the bottom of the printed X-reading
                    report.
                  </p>
                </div>

                <label className="mt-5 block space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--ink)]">
                    Footer content
                  </span>
                  <textarea
                    value={form.footerText}
                    onChange={(event) =>
                      updateDraftForm((current) => ({
                        ...current,
                        footerText: event.target.value,
                      }))
                    }
                    rows={6}
                    disabled={busy}
                    placeholder={
                      "KAHERO APPS INC.\n3/F, Insular Life Bldg,\nDon Apolinar Velez cor.\nOldarico Akut St. Barangay 14\nCagayan de Oro City."
                    }
                    className="soft-ring w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              </div>

              <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5">
                <div className="space-y-2">
                  <p className="text-base font-semibold text-[color:var(--ink)]">
                    Publish to POS
                  </p>
                  <p className="text-sm text-[color:var(--muted)]">
                    Save these fields so Android and Windows terminals can print
                    the same BIR header and footer.
                  </p>
                </div>

                <div className="mt-5 space-y-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={busy}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save BIR Settings
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={busy}
                    className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reset
                  </button>
                  <p className="text-xs text-[color:var(--muted)]">
                    Last saved: {formatUpdatedAt(settingsQuery.data?.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
