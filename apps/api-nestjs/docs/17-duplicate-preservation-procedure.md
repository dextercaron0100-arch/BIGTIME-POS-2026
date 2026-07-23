# BIGTIME POS — Duplicate Preservation Procedure

**Document No.:** 17  
**Annex B Reference:** Item — Commercial invoices prepared in duplicate; original issued, duplicate preserved  
**Date Prepared:** 2026-04-16

---

## 1. Purpose

This document describes how BIGTIME POS preserves electronic duplicates of all issued sales invoices (SI) and official receipts (OR), satisfying the BIR requirement that commercial invoices be prepared in at least duplicate, with the original issued to the customer and the duplicate retained by the business.

---

## 2. Mechanism

### 2.1 Original Issuance

When a sale is completed on the POS terminal:

1. The transaction is submitted to the central API
2. The API creates an immutable `LedgerTransaction` record in PostgreSQL
3. An OR number is assigned sequentially and permanently linked to the transaction
4. A printed receipt is issued to the customer (the **original**)

### 2.2 Electronic Duplicate Retention

The system automatically preserves the duplicate through two complementary mechanisms:

| Mechanism | Location | Description |
|---|---|---|
| **Central server record** | PostgreSQL (API database) | Every transaction is stored with full line items, VAT breakdown, customer info, payment details, and a SHA-256 integrity hash. Records are append-only and cannot be modified after creation. |
| **Local POS record** | Flutter app — Drift SQLite database | The POS terminal retains a local copy of all transactions until confirmed sync with the central server. This provides continuity during network interruptions. |

### 2.3 Immutability

- The central ledger uses append-only writes — no UPDATE or DELETE is permitted on transaction records
- Each record includes a `recordHash` (SHA-256) that is verified during audit exports
- Void and refund transactions create new records linked to the original via `originalTxnId` — the original record is never deleted or overwritten

---

## 3. Access to Duplicates

Authorized personnel can access duplicate records through:

1. **Dashboard → Receipts** — view, reprint, or export any historical SI/OR
2. **Dashboard → Reports → Books of Accounts → Sales Journal** — full sales journal CSV export
3. **Dashboard → Reports → Receipts Export** — CSV export of all transactions with BIR metadata

All exports include the registered business name, TIN, MIN, permit number, and generation timestamp.

---

## 4. Retention

Electronic duplicates are retained in accordance with the [Backup and Retention Policy (Doc. 15)](./15-backup-retention-policy.md) for a minimum of **ten (10) years**.

---

## 5. Physical Duplicates (Optional)

For businesses that require physical duplicate copies (e.g., carbon copy or printed duplicate):

- The BIGTIME POS receipt printer can be configured to print two copies per transaction
- The cashier retains the second copy in the shift file
- The shift file is collected by the branch manager at end of day and stored securely

---

## 6. Declaration

BIGTIME POS satisfies the duplicate preservation requirement electronically through its immutable central ledger and local POS database. The deploying organization confirms that backup procedures (Doc. 15) are in place to preserve these records for the mandatory retention period.
