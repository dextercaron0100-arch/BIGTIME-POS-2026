---
name: bigtime-pos-system
description: Build, debug, and extend the BIGTIME POS monorepo end-to-end. Use when changing or troubleshooting the NestJS API, React dashboard, Flutter Windows POS, offline sync, branch login/PIN flows, customer face display (CFD), or cross-app data contracts in apps/api-nestjs, apps/dashboard-react, apps/pos-flutter, and packages/shared-types.
---

# BIGTIME POS System Skill

## Work in the right layer

Use the correct app for each task:

- `apps/api-nestjs`: backend API, sync ingestion, CFD media/settings, receipts/ledger persistence, realtime events.
- `apps/dashboard-react`: back-office UI, catalog/settings pages, CFD upload and publish workflow.
- `apps/pos-flutter`: Windows POS terminal and CFD runtime (`--customer-display` mode).
- `packages/shared-types`: shared TS contracts used by API and dashboard.

Treat `src/` and `tests/` at repo root as legacy .NET scaffold unless explicitly requested.

## Respect core contracts

Keep these contracts stable:

- Keep API global prefix as `/api`.
- Keep websocket namespace as `/realtime`.
- Keep API response envelope shape as:
  `{"data": ..., "generatedAt": "ISO_DATE"}`.
- Keep Flutter API parsing aligned with envelope in:
  `apps/pos-flutter/lib/core/services/back_office_client.dart`.
- Keep dashboard API client aligned with envelope in:
  `apps/dashboard-react/src/lib/api-client.ts`.

If you change any payload shape in API DTOs/controllers, update:

1. `packages/shared-types/src/index.ts` (if shared),
2. dashboard request/response parsing,
3. Flutter request/response parsing.

## Use canonical runtime assumptions

Use these defaults unless user explicitly requests otherwise:

- API: `http://localhost:3000/api`
- Dashboard dev server: `http://localhost:5173`
- Flutter Windows POS API URL:
  `--dart-define=API_URL=http://localhost:3000/api`
- Branch IDs: `branch-manila`, `branch-cebu`, `branch-davao`

Current project behavior to remember:

- Dashboard shell is currently pinned to Manila branch in
  `apps/dashboard-react/src/components/shell/app-shell.tsx`.
- Flutter branch inference is employee-code based in
  `apps/pos-flutter/lib/features/app_flow/app_flow_controller.dart`.
- Auth demo accounts live in
  `apps/api-nestjs/src/modules/auth/auth.service.ts`.

## Run and build workflow

Run local stack:

```bash
npm install
npm run dev:api
npm run dev:dashboard
```

Run Flutter POS (Windows):

```bash
cd apps/pos-flutter
flutter pub get
flutter run -d windows --dart-define=API_URL=http://localhost:3000/api
```

Build release POS:

```bash
cd apps/pos-flutter
flutter build windows --release
```

Run release binary:

```bash
apps/pos-flutter/build/windows/x64/runner/Release/pos_flutter.exe
```

Run CFD directly:

```bash
apps/pos-flutter/build/windows/x64/runner/Release/pos_flutter.exe --customer-display
```

## Debug playbooks

### Items added in dashboard not showing in POS

Execute in this order:

1. Verify dashboard is operating on intended branch.
2. Verify API catalog snapshot for branch:
   `GET /api/catalog/snapshot?branchId=<branchId>`.
3. Trigger POS sync and verify sync snackbar/result text.
4. Confirm Flutter cached catalog for that branch exists in Drift.
5. If still stale, inspect backend catalog storage file:
   `apps/api-nestjs/storage/catalog-snapshot.json`.

### CFD media uploaded but not showing on customer display

Execute in this order:

1. Verify dashboard tab:
   `Settings -> Customer Display`.
2. Verify settings endpoint:
   `GET /api/customer-display/settings?branchId=<branchId>`.
3. Verify media URLs in response resolve in browser.
4. Trigger POS sync to pull latest CFD settings/media.
5. Confirm backend files:
   - `apps/api-nestjs/storage/customer-display-settings.json`
   - `apps/api-nestjs/storage/customer-display-media/`
6. Re-open CFD panel from POS if heartbeat/session was stale.

### `413 request entity too large` during sync

Apply both controls:

1. Increase API request body limit with env:
   `REQUEST_BODY_LIMIT=25mb` (or higher if required) in API runtime.
2. Keep POS sync uploads chunked when queue can grow large
   (do not send unbounded `entries` arrays in one request).

### Branch/PIN login not working

Check:

1. Employee code to branch mapping in Flutter app flow controller.
2. Demo credentials and branch IDs in API auth service.
3. Branch ID normalization (`toLowerCase`) in API login path.

## Storage reset operations

Stop API before reset, then remove only the targeted file(s):

- Clear receipts/transactions:
  `apps/api-nestjs/storage/sales-ledger.json`
- Clear catalog snapshot:
  `apps/api-nestjs/storage/catalog-snapshot.json`
- Clear CFD settings:
  `apps/api-nestjs/storage/customer-display-settings.json`
- Clear CFD media cache:
  `apps/api-nestjs/storage/customer-display-media/`

For POS local cache reset, remove local `apex_pos.sqlite` created by Flutter
`getApplicationDocumentsDirectory()` and relaunch app to reseed.

## Windows performance rules for POS/CFD

Prioritize smoothness over visual effects:

- Disable or avoid transition animations on Windows paths.
- Prefer `ListView.builder`/`SliverChildBuilderDelegate` for long lists.
- Add `RepaintBoundary` around independently updating regions.
- Use `cached_network_image` for remote media.
- Offload heavy JSON decode to isolate (`compute`) when needed.
- Keep tap/splash effects minimal on Windows (`NoSplash`, zero animation durations).

## Definition of done

Run relevant checks before handing off:

```bash
# root
npm run build:shared
npm run build:api
npm run build:dashboard

# flutter
cd apps/pos-flutter
flutter analyze
flutter build windows --release
```

When touching sync, catalog, auth, or CFD, also run a manual flow:

1. Update dashboard data/settings.
2. Sync POS.
3. Verify POS and CFD reflect backend changes.
4. Verify no regression in login, sell, payment, receipt, and end-shift path.
