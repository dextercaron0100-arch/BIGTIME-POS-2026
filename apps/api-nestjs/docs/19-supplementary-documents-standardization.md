# BIGTIME POS — Supplementary Documents Standardization

**Document No.:** 19  
**Annex B Reference:** Item — Mechanism for adjustment to sales/revenue via supplementary documents issued to other parties  
**Date Prepared:** 2026-04-16

---

## 1. Purpose

This document confirms that BIGTIME POS supports the generation of supplementary documents for sales adjustments (void, refund, return, and cancellation), and describes the standardized format and workflow for each adjustment type.

---

## 2. Supported Adjustment Types

| Adjustment Type | BIR Classification | System Support |
|---|---|---|
| **VOID** | Cancel posted transaction before end of day | ✓ Implemented — void reference number auto-generated |
| **REFUND** | Return of goods/services after SI issuance | ✓ Implemented — creates linked refund transaction |
| **RETURN** | Partial return of items | ✓ Implemented — refund transaction with partial line items |
| **CANCELLED SALE** | Transaction cancelled before posting | ✓ Implemented — held transactions discarded without OR issuance |

---

## 3. System-Generated Reference Numbers

For every void and refund, BIGTIME POS automatically generates a system reference number:

- **Void Reference:** `VOID-{branchId}-{timestamp}` (generated in `pos-ledger.service.ts` via `buildReferenceNumber('VOID', branchId)`)
- **Refund Reference:** Standard reference number linked to original transaction via `originalTxnId`

These reference numbers are:
- Printed on the adjustment slip
- Stored permanently in the central ledger (append-only)
- Included in the audit trail with SHA-256 hash
- Exported in the audit trail CSV available from the Dashboard

---

## 4. Supplementary Document Templates

Sample adjustment document templates are provided in:

> [`docs/05-sample-sales-adjustment-documents-item-5.md`](./05-sample-sales-adjustment-documents-item-5.md)

Templates include:
1. **VOID TRANSACTION ADJUSTMENT SLIP** — for voided sales
2. **REFUND TRANSACTION ADJUSTMENT SLIP** — for refunded sales
3. **RETURN ADJUSTMENT SLIP** — for partial returns
4. **CANCELLED SALE NOTICE** — for pre-posting cancellations

Each template includes:
- Adjustment type and reference number
- Original SI/OR number and date
- Transaction details (items, amounts, VAT)
- Reason for adjustment
- Cashier and supervisor approval fields
- Audit stamp (system-generated reference)

---

## 5. Workflow

### Void (Same-Day Cancellation)
1. Cashier or Supervisor selects the transaction in the POS
2. Enters void reason
3. Supervisor approves (supervisor ID captured)
4. System creates void record linked to original transaction
5. Void reference number is generated and printed on adjustment slip

### Refund (Post-Day Return)
1. Customer presents original receipt
2. Cashier initiates refund in POS, enters reason
3. System creates refund transaction referencing original OR
4. Adjustment slip is printed with refund reference number
5. Original SI/OR status is updated to `RETURNED`/`REFUNDED`

---

## 6. Audit Trail

All adjustment transactions are:
- Permanently stored in the central ledger
- Included in the Dashboard Receipts page (filterable by status: VOID, REFUNDED, RETURNED)
- Exported in the Audit Trail CSV (`downloadAuditTrailCsv()` in `receipts-page.tsx`)
- Available for BIR inspection at any time

---

## 7. Operational Procedure

The deploying organization must:
1. Print adjustment slips for all void and refund transactions
2. Have the customer sign the adjustment slip (for refunds)
3. Retain printed adjustment slips in the daily shift file
4. Include adjustment slips in the end-of-day document bundle submitted to accounting
