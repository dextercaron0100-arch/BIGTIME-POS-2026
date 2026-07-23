# Source Code Declaration and Ownership Declaration

Document date: March 23, 2026 (Asia/Manila)  
Project: BIGTIME POS  
Repository path: `C:\Users\dex\Desktop\PROJECT 2026\POS SYSTEM`

## 1. Declarant Information

Declarant full name: ______________________________  
Position/Role: ______________________________  
Organization: ______________________________  
Government ID or Company ID (optional): ______________________________

## 2. Declaration Statement

I, the undersigned declarant, state that:

1. I am the rightful owner, authorized representative, or legally designated custodian of the source code for the BIGTIME POS project located at the repository path above.
2. The source code and related technical artifacts in this repository were developed for the BIGTIME POS software system and are under my or our lawful control.
3. To the best of my knowledge, the declared proprietary code is original work of the declared owner/team, except for third-party libraries and frameworks that remain under their respective licenses.
4. I authorize this declaration for documentation, accreditation, compliance, procurement, and legal reference purposes where needed.

## 3. Declared Codebase Scope

This declaration covers the following project components:

### 3.1 Core Application Modules
- `apps/api-nestjs`  
  NestJS backend API, business logic, sync processing, reporting, and integrations.
- `apps/dashboard-react`  
  React admin dashboard for back-office operations and reporting.
- `apps/pos-flutter`  
  Flutter POS terminal app for Windows and Android, including offline queue and customer display.
- `packages/shared-types`  
  Shared TypeScript contracts used by API and dashboard.

### 3.2 Supporting Assets and Infrastructure
- `docker-compose.yml` and `docker/` startup assets
- `docs/` technical and operational documentation
- Build and workspace configuration files at repository root

## 4. Ownership Matrix

Use this table to identify ownership boundaries.

| Component | Path | Ownership Status | Owner/Team | Notes |
|---|---|---|---|---|
| Backend API | `apps/api-nestjs` | Owned / Controlled | ____________________ | NestJS + Prisma modules |
| Dashboard | `apps/dashboard-react` | Owned / Controlled | ____________________ | Admin web UI |
| POS Terminal | `apps/pos-flutter` | Owned / Controlled | ____________________ | Windows + Android app |
| Shared Contracts | `packages/shared-types` | Owned / Controlled | ____________________ | Shared data types |
| Legacy Scaffold (if unused) | `src`, `tests` | Legacy / Reference | ____________________ | Preserved scaffold |

## 5. Third-Party Components and License Acknowledgment

This project uses open-source software packages, including but not limited to:
- NestJS, Prisma, BullMQ, Redis clients
- React, Vite, TypeScript ecosystem packages
- Flutter SDK and Dart packages (Riverpod, Drift, etc.)

These third-party components are not claimed as proprietary ownership and remain subject to their original licenses.

## 6. Intellectual Property and Confidentiality Statement

Except for third-party dependencies, all proprietary business logic, custom workflows, and project-specific implementation details in the declared owned components are considered intellectual property of:

Owner / Company Name: ______________________________

Unauthorized copying, redistribution, or commercial use without owner consent may be restricted by applicable law and contract.

## 7. Warranty and Liability Clause (Optional)

The declarant affirms this statement in good faith based on available project records. Any dispute, claim, or correction shall be resolved according to applicable law and governing agreements.

## 8. Signature Block

Printed Name: ______________________________  
Signature: ______________________________  
Date Signed: ______________________________  
Place Signed: ______________________________

Witness / Notary (if required): ______________________________

## 9. Optional Annex A: Repository Fingerprint

Fill these at signing time:
- Git remote URL: ______________________________
- Current branch: ______________________________
- Commit hash: ______________________________
- Tagged release (if any): ______________________________

## 10. Optional Annex B: Delivered Build Artifacts

- API build output: `apps/api-nestjs/dist`
- Dashboard build output: `apps/dashboard-react/dist`
- Flutter APK/Windows build outputs: project build directories

This section may be attached to support deployment or accreditation evidence.
