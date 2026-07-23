# BIGTIME POS production security checklist

Production release is blocked until every required item is evidenced and signed off.

## Identity and access

- Demo users are disabled and all default credentials are removed.
- Access and refresh secrets are independently generated, stored in a secret manager, and rotated at least every 90 days.
- Administrator MFA is enabled before public or multi-site deployment.
- Each administrator enrolls a TOTP authenticator, downloads the one-time recovery codes, and proves a fresh MFA login before launch. Recovery codes are stored offline and never in tickets or chat.
- Cross-organization and cross-branch negative tests pass for every API resource.
- Terminated users and credential resets revoke all sessions immediately.

## Network and data

- Dashboard, API, and WebSockets use HTTPS/WSS with valid certificates.
- PostgreSQL and Redis are private, authenticated, encrypted in transit, and not internet-accessible.
- Server volumes, POS device databases, media, and backups use encryption at rest.
- `DATA_ENCRYPTION_KEY` is a unique base64-encoded 32-byte key held in the production secret manager. It must differ from both JWT secrets and be included in the controlled disaster-recovery key escrow.
- Production storage files are outside the application source tree with least-privilege filesystem permissions.
- Backups are encrypted, access-logged, retained according to policy, and restore-tested quarterly.

## Application and operations

- `npm run security:audit`, builds, tests, and security lint checks pass.
- No unresolved critical or high finding exists in code, dependencies, infrastructure, or the penetration-test report.
- Centralized security logs alert on repeated login failures, privilege changes, exports, session replay, and denied tenant access.
- The incident response roster and 72-hour breach assessment procedure have current contacts.
- A Privacy Impact Assessment, processing inventory, retention schedule, and vendor agreements are approved by the DPO.

## Release evidence

Record the release version, date, approver, audit output, restore-test date, penetration-test report, and any formally accepted residual risk.

Generate the application encryption key outside source control:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Rotating `DATA_ENCRYPTION_KEY` requires decrypting and re-encrypting protected values in a controlled maintenance window. Do not replace it without a migration, or existing MFA enrollments will become unreadable.
