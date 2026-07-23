# BIGTIME POS — Play Store Launch Plan (Multi-Tenant, 30-Day Free Trial)

Last updated: 2026-07-22

## 0) Decisions locked in

- **Distribution model:** multi-tenant self-serve SaaS. Any business can install the app, sign up, and get their own isolated account — not manual per-customer setup.
- **Trial enforcement:** server-side. The API tracks trial start date and subscription status per tenant and gates access once expired. This is the source of truth, not a client-side flag.
- **Payments:** out of scope for this phase. The plan builds trial/licensing infrastructure only. Converting expired trials into paying subscribers (Play Billing, GCash, PayMongo, Stripe, etc.) is a separate follow-up project — this plan should leave clean seams for it (a `Subscription`/`Plan` model that a billing integration can later write to) but does not implement checkout.

## 1) Why this is a bigger lift than a config change

Current state (confirmed by architecture audit):

- **Single-tenant, hardcoded.** `apps/api-nestjs/src/modules/auth/auth.service.ts` ships a fixed `demoUsers` array tied to three hardcoded branches (`branch-manila`, `branch-cebu`, `branch-davao`). There is no concept of a customer "account" above a branch.
- **No tenant/organization entity anywhere.** Prisma's schema (`apps/api-nestjs/prisma/schema.prisma`) models `Branch → User/Terminal/Warehouse` but has no `Tenant`/`Organization` root, and grepping the whole repo for `tenant|organization|subscription|license` returns nothing real.
- **No license/trial/payment code exists.** The "Billing & Subscriptions" panel in `apps/dashboard-react/src/pages/settings-page.tsx` is decorative UI state only — no backend behind it.
- **Storage is flat JSON, not a real multi-tenant DB.** `apps/api-nestjs/storage/*.json` (sales-ledger, catalog-snapshot, employees-admin, etc.) is one shared file set per running backend instance. Prisma/Postgres is scaffolded but not wired into any module.
- **Flutter app points at a backend URL baked in at build time** (`--dart-define=API_URL`), with no in-app flow for a customer to register their business and get routed to their own tenant.

Bottom line: today this is single-operator software. Turning it into a Play Store product where strangers sign up and each gets an isolated 30-day trial requires adding a tenancy layer, wiring real persistence, and building trial-gating into the API — not just a Play Store listing.

## 2) Target architecture

### 2.1 New domain concept: Tenant (Organization)

Add an `Organization` (tenant) entity that owns everything a customer currently has scattered across hardcoded branches:

```
Organization
  id, name, ownerEmail, createdAt
  status: TRIAL | ACTIVE | EXPIRED | SUSPENDED
  trialStartedAt, trialEndsAt
  planId (nullable until payments phase)
  └── Branch (existing model, now FK'd to organizationId)
        └── User / Terminal / Warehouse / Transaction (existing models, unchanged relationships)
```

Every existing model that's currently branch-scoped stays branch-scoped; branches just gain an `organizationId` and cascade from Organization. This avoids a full data-model rewrite — it inserts one new root above what already exists.

### 2.2 Wire Prisma/Postgres for real, retire the JSON files

The flat `storage/*.json` files cannot hold multiple tenants' data safely (no isolation, no concurrent-write safety). Since Prisma's schema already models branches/users/transactions correctly:

1. Add `Organization` and `Subscription` models to `schema.prisma`.
2. Migrate each existing JSON-file-backed service (`sales-ledger`, `catalog-snapshot`, `employees-admin`, `bir-settings`, `customer-display-settings`) to read/write through Prisma instead of `fs`.
3. Every Prisma query gets scoped by `organizationId` pulled from the authenticated request — this is the actual tenant-isolation boundary. Missing this scoping anywhere is the #1 way tenants leak data into each other, so it needs a lint rule or a shared repository helper that forces the filter, not developer discipline alone.

This is the largest single piece of work in the plan — budget for it accordingly.

### 2.3 Signup + trial issuance flow

New, unauthenticated endpoint: `POST /api/organizations/signup`

- Input: business name, owner email, owner name, initial PIN.
- Creates `Organization` with `status = TRIAL`, `trialStartedAt = now()`, `trialEndsAt = now() + 30 days`.
- Creates a default `Branch` and an `ADMIN` `User` for the owner (replacing today's hardcoded `demoUsers` seed for real signups; keep the demo seed only behind `AUTH_ALLOW_DEMO_USERS` for dev/demo builds as it already is).
- Returns a login session immediately (no email verification blocking first use, though email verification can be layered in for abuse prevention — see §5).

### 2.4 Trial enforcement (server-side gate)

Add a NestJS guard (e.g. `TrialGuard`) applied globally alongside existing auth guards:

- Resolves the caller's `organizationId` from the JWT (add `organizationId` to `AuthTokenPayload` in `auth.service.ts`).
- Loads `Organization.status` / `trialEndsAt` (cache in Redis, since this runs on every request — already have Redis/BullMQ in the stack).
- If `TRIAL` and `trialEndsAt < now()`: flip status to `EXPIRED` and reject with `403` + a machine-readable code (`TRIAL_EXPIRED`) the dashboard/Flutter app can special-case into an upgrade screen, distinct from a generic error toast.
- Exempt a small allowlist of routes needed to see the expired state and manage billing later (`/api/organizations/me`, `/api/auth/*`, future `/api/billing/*`).

A background job (BullMQ, already in the stack via `QueueModule`) sweeps for trials crossing `trialEndsAt` so status flips even without a live request, keeping reporting/notifications accurate.

### 2.5 Flutter app changes

- Add a real **"Create your business" / "Sign in to existing business"** entry flow instead of assuming one fixed backend. Practically: the app talks to a **fixed, hosted production API URL** (not per-tenant subdomains — tenancy is handled server-side by the logged-in user's org, not by DNS), so the current build-time `--dart-define=API_URL` becomes "point at our hosted API" rather than "point at a customer's private server." This is the one existing assumption that most needs to flip.
- Add a trial-status banner/screen reacting to the `TRIAL_EXPIRED` error code from §2.4.
- Keep the LAN/offline queue behavior — it's unrelated to tenancy and already sound per the current architecture.

### 2.6 Dashboard changes

- Add the same signup flow as a web page (useful for back-office-first customers).
- Replace the decorative billing panel in `settings-page.tsx` with a real read view: plan name, trial/active status, days remaining — sourced from `GET /api/organizations/me`. Still no checkout button yet (payments phase), but no more fake dropdowns wired to nothing.
- Add a persistent trial-countdown banner once inside `<7` days remaining.

## 3) Phased roadmap

**Phase 1 — Tenancy foundation (highest risk, do first)**
- `Organization` + `Subscription` Prisma models, migration, `organizationId` FKs on `Branch`.
- Wire Prisma into the services still reading/writing `storage/*.json`.
- Add `organizationId` to JWT payload and every guard/service that currently assumes a single global dataset.

**Phase 2 — Signup & trial gating**
- `POST /api/organizations/signup` endpoint + seed logic.
- `TrialGuard` + BullMQ sweep job + `TRIAL_EXPIRED` handling contract.
- `GET /api/organizations/me` for status/day-count.

**Phase 3 — Client-facing trial UX**
- Dashboard signup page + billing panel wired to real data + trial banner.
- Flutter signup/sign-in entry flow + trial-expired screen.

**Phase 4 — Play Store submission mechanics**
- Confirm release signing (`keystore.properties` already scaffolded in `android/app/build.gradle.kts` — finalize the real production keystore).
- Bump `applicationId`/branding away from placeholder `com.apex.pos.pos_flutter` if that's not the intended public package name.
- Privacy policy page (required by Play Console's Data Safety form — this app collects sales/PII data, so this is not optional) and Data Safety form answers.
- Store listing assets: icon, feature graphic, phone/tablet screenshots, short/long description, content rating questionnaire.
- Internal testing track → closed testing (get a few real trial signups through it) → production rollout.

**Phase 5 — Hardening before public trial traffic**
- Rate-limit `/organizations/signup` (abuse/spam trial creation) — `ThrottlerModule` is already in the stack, so this is mostly configuration.
- Basic email verification or CAPTCHA on signup if trial abuse becomes a problem.
- Monitoring: alert if the BullMQ trial-sweep job stalls (trials silently never expiring is a revenue leak, not just a bug).

## 4) Explicitly deferred (next project, not this one)

- Payment provider integration (Play Billing / GCash / PayMongo / Stripe) and the checkout flow itself.
- Plan tiers / feature-flagging by plan (today: trial gives access to everything, per your instruction).
- Multi-currency / multi-region billing.

## 5) Open risks worth flagging now

- **BIR compliance scope**: the existing `docs/bir-accreditation-readiness.md` work assumes a specific accredited deployment. Confirm whether BIR accreditation needs to be re-validated per tenant, or whether it's a claim about the software in general — this affects whether Phase 1's multi-tenant rewrite needs to preserve any per-installation BIR artifacts (sequential OR/SI numbering, e-journal) *per organization* rather than globally as it is today.
- **Data isolation is the one bug class that actually matters here.** Recommend a lightweight automated test that spins up two organizations and asserts zero cross-tenant leakage on every list/report endpoint before Phase 1 is called done.
- **Trial abuse** (one business creating repeat 30-day trials) — worth a decision on whether to tie signup to a verified email/phone before Phase 5, or accept the risk initially and revisit.
