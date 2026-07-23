# BIGTIME POS Workspace

Monorepo scaffold for a multi-platform POS system:

- `apps/api-nestjs` - NestJS API, Prisma, BullMQ, Redis integration
- `apps/dashboard-react` - React + Tailwind back-office dashboard
- `apps/pos-flutter` - Flutter POS terminal shell for Windows and Android
- `packages/shared-types` - Shared TypeScript contracts for the API and dashboard

The original `.NET` scaffold under `src/` and `tests/` is preserved and not used by this workspace.

## Quick start

```bash
npm install
npm run dev:api
npm run dev:dashboard
```

Flutter POS:

```bash
cd apps/pos-flutter
flutter pub get
flutter run -d windows
```

## What is implemented

- NestJS feature modules for auth, POS, catalog, inventory, pricing, payments, reports, employees, BIR, and offline sync
- Prisma schema covering the planned branch, catalog, sales, inventory, HR, and BIR tables
- React dashboard routes for dashboard, receipts, catalog, inventory, reports, and employees
- Flutter POS shell for PIN login, open shift, sell screen, payment, and receipt flow
- Local Drift catalog cache plus sync queue scaffolding in Flutter

## Verification

- `npm run build:shared`
- `npm run build:api`
- `npm run build:dashboard`
- `npm run lint -w @apex-pos/api`
- `npm run test:e2e -w @apex-pos/api -- --runInBand`
- `flutter analyze`
- `flutter test`
