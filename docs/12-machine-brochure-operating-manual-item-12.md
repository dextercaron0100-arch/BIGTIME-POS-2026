# BIGTIME POS

## Item 12 Compliance Sample

### Machine Brochure / Operating Manual (if applicable)

Requirement covered:

"12. Machine brochure/ Operating manual, if applicable;"

Prepared on: April 14, 2026
System: BIGTIME POS

---

## 1. System Overview

BIGTIME POS is a point-of-sale system composed of:

- POS Terminal App (Windows/Android)
- Back-office Dashboard (Web)
- Central API and database services

Primary business functions:

- Cashier login and shift handling
- Item selling and payment capture
- SI/OR receipt issuance and printing
- Discounts and adjustments (void/return/refund workflows)
- Inventory and reporting management
- Online/offline operational continuity

---

## 2. Minimum Operating Requirements

POS Terminal:

- Windows device or Android terminal
- Stable printer connection for receipt printing
- Local storage available for offline queue

Back Office:

- Modern web browser
- Network access to API/server

---

## 3. Basic Operating Procedure (Cashier)

1. Launch BIGTIME POS terminal application.
2. Confirm environment indicator:
   - `Network Ready` for online mode
   - `Offline Mode` for offline mode
3. Enter employee code and PIN to log in.
4. Open shift (if prompted).
5. Scan/search items and build customer transaction.
6. Apply discounts where applicable (SC/PWD/National Athletes/Solo Parent).
7. Select payment method and confirm payment.
8. Print/reprint receipt as needed.
9. Perform end-of-shift procedures and generate X/Z reading.

---

## 4. Online and Offline Operations

Online mode:

- Transactions are sent to server services in real time.
- Central records and reports update immediately.

Offline mode:

- Transactions are temporarily queued in local storage.
- System continues sales operation while network is unavailable.
- Queued transactions sync automatically after reconnection.

---

## 5. Daily Operations and Reports

Operational reports and outputs include:

- X-Reading (cashier accountability)
- Z-Reading (end-of-day report)
- Sales summaries and discount breakdown reports
- Adjustment-related transaction documents (void/return/refund)

Back-office users may access additional listing, inventory, employee, and receipt records through dashboard modules.

---

## 6. Safety, Backup, and Continuity Notes

- Keep user credentials confidential.
- Restrict terminal usage to authorized users.
- Ensure regular backup of server data and report exports.
- Follow store SOP for power interruption and network outage handling.

---

## 7. Troubleshooting Quick Guide

1. Cannot log in:
   - Verify employee code/PIN
   - Check network and server availability
2. Printer not printing:
   - Check printer power/connection/paper
   - Retry print from receipt actions
3. Network unavailable:
   - Continue using offline mode
   - Verify sync status once network returns

---

## 8. Document Purpose

This operating manual is prepared as the Item 12 attachment for Annex B submission and serves as a practical usage reference for BIGTIME POS system operation.
