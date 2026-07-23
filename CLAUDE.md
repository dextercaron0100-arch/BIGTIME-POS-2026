# CLAUDE.md

## BIGTIME POS - Project Memory (Under 5k Tokens)

Last updated: 2026-04-14

Purpose: fast resume context for this repository.
Rule: keep this file lean. Move overflow notes to `docs/`.

---

## 1) Project Summary & Active Features

BIGTIME POS is a monorepo POS platform:

- Back-office dashboard (`apps/dashboard-react`)
- Central API (`apps/api-nestjs`)
- POS terminal app (`apps/pos-flutter`)
- Shared TS contracts (`packages/shared-types`)

Core active features:

- Cashier flow: login -> open shift -> sell -> pay -> receipt
- SI/OR issuance and receipt lifecycle (print/reprint/email events)
- Inventory, listing, catalog, employee, reports modules
- BIR/EIS related monitoring, queue/retry, audit-oriented exports
- Offline-capable POS queue/sync model (Flutter + Drift)

Recent session focus:

- Dashboard readability and card consistency adjustments
- Receipts page cards aligned to dashboard visual system
- Annex B evidence docs generated (items 4,5,6,7,8,10 + PDFs/txt)

---

## 2) Tech Stack

- Dashboard: React + TypeScript + Vite + Tailwind + TanStack Query
- API: NestJS + TypeScript + Prisma + PostgreSQL + Redis/BullMQ
- POS: Flutter (Windows/Android) + Drift local storage
- Runtime: Node >= 22

---

## 3) Repo Map (Primary)

- `apps/api-nestjs`: API modules, DTOs, Prisma, queues
- `apps/dashboard-react`: routes/pages/components and styling
- `apps/pos-flutter`: terminal UI + offline transaction queue
- `packages/shared-types`: shared contracts
- `docs`: accreditation and submission artifacts

Key docs already present:

- `docs/system-description-bigtime-pos.md`
- `docs/bir-accreditation-readiness.md`
- `docs/annex-b-functional-checklist-bigtime-pos.md` (+ PDF)
- `docs/annex-b-submission-tracker.md` (+ PDF)
- Item docs: `04`, `05`, `06`, `07`, `08`, `10` evidence files

---

## 4) Build / Run Commands

From repo root:

- `npm install`
- `npm run dev:api`
- `npm run dev:dashboard`
- `npm run build:shared`
- `npm run build:api`
- `npm run build:dashboard`

POS app:

- `cd apps/pos-flutter`
- `flutter pub get`
- `flutter run -d windows`
- `flutter analyze`
- `flutter test`

---

## 5) Code Style & Naming Conventions

General:

- Prefer explicit domain names (`Receipt`, `Bir`, `Inventory`, `Shift`)
- Keep functions/components focused and readable
- Avoid magic values; use constants or shared config

Dashboard:

- Reuse existing card/panel visual language
- Preserve readability and contrast first
- Prefer shared variables/utilities over one-off color overrides

API:

- Keep module boundaries by business domain
- Preserve DTO validation + guards patterns

POS:

- Protect offline queue/sync behavior when changing transaction flow

Docs:

- For Annex/BIR evidence, keep one requirement per file when practical
- Use numbering that directly maps to Annex B checklist lines

---

## 6) Known Gaps / Next TODOs

Compliance and delivery tasks still open:

1. Final statutory field checks (TIN/branch format, discount edge cases)
2. Final Books of Accounts output validation (journal/ledger/purchase/inventory)
3. End-to-end validation of all required generated report exports
4. Final infra controls evidence pack (backup/DR/security policy artifacts)
5. Item 10 screenshot completeness: software name + version visibility on required screens
6. If evaluator requests: produce a single combined PDF with cover + screenshots

---

## 7) Pending Test Scenarios (Not Fully Closed)

1. Live SI/OR strict-mode issuance end-to-end
2. Discount flows in real transactions (SC/PWD/National Athletes/Solo Parent)
3. Adjustment document chain integrity (cancel/void/return/refund linkage)
4. Report export consistency per branch and report type
5. POS offline -> reconnect reconciliation under unstable network
6. Role/permission boundary checks for sensitive dashboard/API actions

---

## 8) Session Workflow

End of session:

1. Run:

```bash
/compact Focus on code samples and API usage
```

2. Prompt:

```text
Append that summary to docs/progress.md
Also save a standalone summary to session_summary.md
```

3. Do not run `/clear` unless a full reset is intended.

Start of session:

- Load:
  - `@CLAUDE.md`
  - `@docs/progress.md` (if exists)
  - `@session_summary.md` (optional)

Every ~40 messages:

```bash
/compact Focus on code samples and API usage
```

Then:

```text
Save that summary to session_summary.md
```

If `docs/progress.md` or `session_summary.md` do not exist yet, create them on first write.

---

## 9) Token Efficiency Rules

- Keep this file operational and concise.
- Move bulky history/future plans into `docs/*.md`.
- Use focused prompts and grouped asks to reduce context bloat.
- Prefer modular `@file` loading over long pasted context.

