# BIGTIME POS — User Provisioning and Offboarding SOP

**Document No.:** 16  
**Annex B Reference:** Items — Standard procedure for user access; user rights eliminated upon termination or transfer  
**Date Prepared:** 2026-04-16

---

## 1. Purpose

This document defines the standard operating procedure for creating, managing, and deactivating user accounts in BIGTIME POS, ensuring that access rights are properly controlled and revoked upon employee termination or transfer.

---

## 2. User Roles in BIGTIME POS

| Role | Access Level |
|---|---|
| ADMIN | Full system access including user management, reports, BIR settings |
| SUPERVISOR | Transaction approval, void/refund authorization, shift oversight |
| CASHIER | POS terminal — sales, payments, receipts only |
| INVENTORY | Inventory management and stock adjustments |
| AUDITOR | Read-only access to reports and audit trail |

---

## 3. User Provisioning (New Employee)

### Step 1 — Authorization
- HR submits a written request (email or form) to the System Administrator specifying:
  - Employee name and employee code
  - Branch assignment
  - Role/position (determines system role)
  - Start date

### Step 2 — Account Creation
- System Administrator logs into the BIGTIME POS Dashboard (`/employees` panel)
- Navigates to **Employee Management → Add User**
- Enters: Employee Code, Full Name, Role, Branch
- Sets an initial PIN (minimum 6 characters, alphanumeric — must contain at least one letter and one digit)
- User is created with `isActive: true`

### Step 3 — Handover
- System Administrator communicates the initial PIN securely to the employee
- Employee is required to change their PIN on first login via **Account Settings → Change PIN**
- PIN change requirement is enforced by the system (30-day maximum PIN age)

### Step 4 — Audit Log
- Account creation is automatically logged in the system audit trail:
  - Action: `USER_CREATED`
  - Timestamp, branch, role, created by (admin user)

---

## 4. Access Modification (Transfer or Role Change)

- When an employee transfers to a different branch or changes position:
  1. HR notifies the System Administrator
  2. Administrator updates the employee's branch and/or role via the Dashboard
  3. Change is logged in the audit trail (`USER_STATUS_UPDATED`)
  4. Old branch access is revoked immediately upon save

---

## 5. User Offboarding (Resignation, Termination, or Leave)

### Immediate Action (Same Day)
- System Administrator logs into Dashboard → Employee Management
- Locates the employee by name or employee code
- Clicks **Deactivate** (sets `isActive: false`)
- The account is immediately locked — the user cannot log in

### System Enforcement
- The BIGTIME POS API checks `isActive` on every login attempt
- Deactivated users receive: *"This POS user is inactive."*
- All active sessions are invalidated (JWT tokens are rejected on next use)

### Audit Trail
- Deactivation is automatically logged:
  - Action: `USER_STATUS_UPDATED`
  - Timestamp, deactivated by (admin user), previous status

### Documentation
- HR maintains a physical or digital offboarding record referencing the system deactivation timestamp

---

## 6. PIN Policy Summary

| Policy | Value |
|---|---|
| Minimum PIN length | 6 characters |
| Maximum PIN length | 12 characters |
| Complexity requirement | Must contain at least one letter and one digit |
| PIN maximum age | 30 days |
| Failed login lockout | 5 attempts → 30-minute lockout |
| Dashboard access | ADMIN role only |

---

## 7. Responsibility

| Role | Responsibility |
|---|---|
| HR Department | Notify IT of new hires, transfers, and terminations |
| System Administrator | Create, modify, and deactivate user accounts |
| Branch Manager | Verify staff have appropriate access for their role |
| Internal Auditor | Periodically review active user list and audit log |
