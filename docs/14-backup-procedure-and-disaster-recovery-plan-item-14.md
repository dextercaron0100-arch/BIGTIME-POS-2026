# BIGTIME POS

## Item 14 Compliance Sample

### Narrative Back-up Procedure and Disaster Recovery Plan (DRP)

Requirement covered:

"14. Narrative Back-up Procedure and Disaster Recovery Plan (DRP); and"

Prepared on: April 15, 2026
System: BIGTIME POS

---

## 1. Purpose

This document describes the back-up procedure and disaster recovery plan for BIGTIME POS. It is intended to show how operational and transaction data may be protected, restored, and validated in the event of system failure, connectivity interruption, hardware malfunction, or other operational disruption.

---

## 2. System Components Covered

The backup and recovery scope of BIGTIME POS covers:

- central API services
- central PostgreSQL database
- Redis-backed queue or runtime infrastructure
- POS terminal local data used for offline continuity
- exported reports and compliance-related files
- system configuration records and branch-specific operational settings

---

## 3. Backup Procedure

### 3.1 Central Database Backup

The central database is the primary repository of official transaction and master records when the system is online. Backup procedure should include:

1. Scheduled full database backup at the end of each business day.
2. Additional periodic backup during the day based on transaction volume and store policy.
3. Secure storage of backup files in designated backup media or server storage.
4. Retention of backup generations according to company policy and statutory record-keeping requirements.

Recommended captured records include:

- sales transactions
- receipt and invoice records
- inventory and listing data
- employee and POS user records
- audit trail and report history

### 3.2 Application and Configuration Backup

System configuration and reference data should also be preserved, including:

- branch settings
- BIR-related settings
- report/export templates
- system environment and deployment configuration

### 3.3 POS Local Continuity Data

BIGTIME POS supports local queued records for temporary offline continuity. In the event the terminal operates offline:

- transaction and shift-related data are temporarily stored in local POS storage
- queued records remain available for later synchronization
- local terminal continuity data should be protected through device-level backup, access restriction, and controlled recovery procedures

### 3.4 Export and Document Backup

Generated reports, audit extracts, statutory sample printouts, and submission artifacts should be copied to protected storage or backup media after creation, especially for compliance submissions and end-of-day documentation.

---

## 4. Disaster Recovery Plan

### 4.1 Objective

The disaster recovery objective is to restore BIGTIME POS operations with minimal data loss and acceptable downtime while preserving transaction integrity and required business records.

### 4.2 Common Disaster Scenarios

The DRP addresses scenarios such as:

- server outage
- database corruption
- network interruption
- POS terminal failure
- printer or peripheral failure
- accidental data deletion
- power interruption affecting store operations

### 4.3 Recovery Strategy by Scenario

#### A. Server or API Outage

1. Confirm server or hosting issue.
2. Restore API service from the latest working deployment or standby environment.
3. Validate application health and API accessibility.
4. Restore database from the most recent valid backup if required.
5. Reconnect dashboard and POS clients and verify transaction flow.

#### B. Database Failure or Corruption

1. Stop write operations to prevent further inconsistency.
2. Identify last clean backup set.
3. Restore database to the latest valid recovery point.
4. Validate core records such as receipts, shifts, inventory, and users.
5. Resume application access only after integrity checks are completed.

#### C. Network Interruption

1. Continue selling through offline-capable POS workflow where enabled.
2. Preserve locally queued transactions on the POS terminal.
3. Restore network connectivity.
4. Trigger or monitor synchronization of queued records to central services.
5. Verify successful upload and reconciliation of stored transactions.

#### D. POS Terminal Device Failure

1. Isolate the affected terminal.
2. Replace or repair the device.
3. Reinstall or relaunch the POS application on the replacement device.
4. Reconnect to central services and validate user login and selling functions.
5. Recover local continuity data if available and applicable.

---

## 5. Recovery Validation

After any recovery procedure, the following checks should be performed:

- user login works correctly
- catalog and pricing data are available
- sales transaction posting succeeds
- receipt generation works correctly
- X-reading and Z-reading can be generated
- audit and report views remain accessible
- synchronized records match expected transaction counts

---

## 6. Roles and Responsibilities

- System Administrator / Technical Support:
  - perform backup scheduling, restore actions, and environment validation
- Store Supervisor / Manager:
  - report incidents, validate restored operations, and reconcile store activity
- Cashier:
  - follow offline continuity procedures and report terminal or printer issues immediately

---

## 7. Operational Notes

- Backup logs and restore actions should be documented.
- Access to backups should be restricted to authorized personnel.
- Recovery testing should be performed periodically to confirm that backup files are usable.
- Store-level SOP should define communication, escalation, and sign-off steps after a recovery event.

---

## 8. Document Purpose

This narrative back-up procedure and disaster recovery plan is prepared as the Item 14 attachment for Annex B submission and describes the recommended backup and recovery controls for BIGTIME POS operations.
