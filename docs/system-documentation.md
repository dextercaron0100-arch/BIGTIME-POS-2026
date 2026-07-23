# BIGTIME POS System Documentation

Last updated: March 23, 2026 (Asia/Manila)

## 1. System Overview

### 1.1 Project Scope
This POS platform is a multi-app monorepo that includes:
- A cashier terminal app for Windows and Android (`apps/pos-flutter`)
- A back-office web dashboard for administrators (`apps/dashboard-react`)
- A central API and business layer (`apps/api-nestjs`)
- Shared TypeScript contracts (`packages/shared-types`)

### 1.2 High-Level Architecture
- Frontend (cashier): Flutter app with local SQLite (Drift) and offline queueing
- Frontend (admin): React dashboard
- Backend: NestJS API with JWT auth, role guards, and module-based services
- Database: PostgreSQL via Prisma schema
- Queue/Realtime infrastructure: Redis, BullMQ, Socket.IO gateway

### 1.3 Runtime Components
- API default base: `http://localhost:3000/api`
- Android emulator API bridge default: `http://10.0.2.2:3000/api`
- Local POS database file: `apex_pos.sqlite` in app documents directory
- Docker services available: PostgreSQL (`54329`) and Redis (`6380`)

## 2. Application Components

### 2.1 API (`apps/api-nestjs`)
Major modules:
- `auth`: login and token refresh
- `pos`: transactions, void, refund, audit trail, storage status
- `sync`: offline batch ingestion and reconciliation
- `catalog`, `inventory`, `pricing`, `payments`
- `reports`, `bir`, `eis`
- `customer-display`
- `employees`

Global protections and middleware:
- `ThrottlerGuard`, `JwtAuthGuard`, `RolesGuard` as app guards
- `ValidationPipe` with whitelist and non-whitelisted rejection
- Helmet enabled, `x-powered-by` disabled
- Config-driven CORS allowlist

### 2.2 POS Terminal (`apps/pos-flutter`)
Primary cashier stages:
- Login
- Open Shift
- Selling
- Payment
- Receipt

Key local capabilities:
- Local catalog cache
- Local sync queue with retry/backoff metadata
- Shift session persistence
- Offline transaction queuing and later server reconciliation
- Hardware hooks (printer, cash drawer)
- Customer-facing display settings and media sync

### 2.3 Dashboard (`apps/dashboard-react`)
Primary capabilities:
- Admin login
- Sales and receipt monitoring
- Catalog and listing management pages
- Inventory pages
- Reports, including BIR and EIS monitoring
- Employees and POS user administration
- Customer display settings management

## 3. Flow of Transactions

### 3.1 Authentication and Session Start
1. Cashier enters `employeeCode` and PIN in POS app.
2. POS calls `POST /auth/login` with branch, terminal, employee code, PIN.
3. API validates credentials and role, then returns:
- `accessToken`
- `refreshToken`
- user profile and permissions
4. POS caches tokens in memory for API calls and refresh.

Offline fallback behavior:
- If back office is unreachable (network-level failure), POS can continue in offline mode and queue records locally.

### 3.2 Shift Opening
1. Cashier enters opening float amount.
2. POS writes shift session locally (`shift_sessions`).
3. POS enqueues shift event in local `sync_queue_entries`.
4. POS attempts immediate sync (`/sync/batch`) when online.

### 3.3 Selling and Cart Build
1. POS reads item catalog from local Drift cache.
2. Cashier scans/searches/adds items and quantities.
3. Totals and VAT are computed in-app from cart state.
4. Background sync periodically refreshes catalog and customer display assets.

### 3.4 Payment and Receipt Issuance
Online path:
1. POS posts sale to `POST /pos/transactions`.
2. Server ledger issues official transaction and OR sequence.
3. POS receives server transaction ID, OR number, reference number.

Offline or fallback path:
1. POS creates local provisional transaction ID and reference.
2. POS stores transaction payload in sync queue.
3. On next successful sync, server returns reconciliation receipt ack:
- local transaction ID -> server transaction ID
- final OR label and reference number
- total, VAT, and change amounts

### 3.5 Receipt Event Logging
1. Print/Reprint/Email actions are logged as `receipt_events` in local queue.
2. Sync service uploads these events via `POST /sync/batch`.
3. Backend records receipt event trail for audit visibility.

### 3.6 Shift Close and Reconciliation
1. POS computes expected cash from opening float + cash sales.
2. Cashier enters blind count and manager code when variance threshold is exceeded.
3. POS closes local shift, prints reconciliation slip, and queues shift update.
4. Queue is uploaded when connectivity/session is valid.

### 3.7 BIR and EIS Pipeline
- POS sale/void/refund operations enqueue EIS submissions in backend services.
- Dashboard exposes BIR reports, EIS queue status, flush, and retry endpoints.

## 4. Security Controls

### 4.1 Authentication and Authorization
- JWT bearer authentication on protected API routes
- Refresh token rotation flow through `/auth/refresh`
- Role-based access controls using `@Roles(...)` + global `RolesGuard`
- Admin-only restriction for dashboard terminal login pattern in auth service

### 4.2 Brute-Force and Abuse Protection
- Global throttling enabled
- Additional route-level throttle on auth login/refresh endpoints

### 4.3 Input Validation and API Hardening
- DTO validation with class-validator
- Global `ValidationPipe` with:
- `whitelist: true`
- `forbidNonWhitelisted: true`
- `forbidUnknownValues: true`
- Request body size parsing and safety cap (max 100 MB)
- Strict CORS origin parsing and allowlist behavior
- Helmet middleware enabled
- `x-powered-by` header disabled

### 4.4 Secrets and Production Safety Checks
Production bootstrap blocks startup if:
- JWT secret is weak/default
- Optional refresh secret is too short
- Demo users are allowed in production
- EIS simulation is allowed in production
- EIS signing secret is weak/default

### 4.5 Credential and PIN Handling
- Managed user PINs are stored hashed with bcrypt
- Login PIN format is validated (4-6 numeric characters)
- Token verification requires expected payload fields and HS256 validation

### 4.6 Transaction Integrity and Traceability
- Server-side OR sequencing for official sales
- Append-only enforcement for key sync tables (`transactions`, `payments`, `shift_sessions`, `receipt_events`, `stock_movements`)
- Sync idempotency key generation (SHA-256 based)
- Receipt action events and audit trail endpoints available for trace reviews

### 4.7 Offline Sync Reliability Controls
- Local queue persistence
- Adaptive chunk upload
- Retry backoff with next-retry scheduling
- Partial success handling (accepted/rejected IDs)

## 5. Data Model and Storage

### 5.1 Central Data (PostgreSQL via Prisma)
Core domains represented in schema:
- Branches, terminals, users, shifts
- Items, categories, variants, taxes, discounts
- Transactions, transaction items, payments
- Inventory and stock movement
- Employees and time entries
- BIR Z-readings and audit log

### 5.2 Terminal Local Data (Flutter Drift)
Local tables:
- `catalog_cache_items`
- `sync_queue_entries`
- `shift_sessions`

Purpose:
- Fast local UX
- Offline continuity
- Deferred sync to backend

## 6. Operational Notes

### 6.1 Startup
From workspace root:
- `npm install`
- `npm run dev:api`
- `npm run dev:dashboard`

For Flutter POS:
- `cd apps/pos-flutter`
- `flutter pub get`
- `flutter run -d windows` or `flutter run -d <android-device>`

### 6.2 Security and Compliance Notes
- Dashboard auth session is stored in browser local storage.
- Local terminal SQLite data is persisted on device and should be protected at OS/device level.
- For stricter compliance, disable offline sale queue and require live receipt issuance in production builds.
