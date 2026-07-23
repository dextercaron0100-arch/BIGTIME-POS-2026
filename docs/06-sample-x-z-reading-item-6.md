# BIGTIME POS

## Item 6 Compliance Sample

### Sample print copy of X-Reading and Z-Reading

Requirement covered:

"A sample print copy of the X-Reading (Cashier's Accountability / End-of-shift Report) and Z-Reading (End-of-day Report)."

Prepared on: April 14, 2026
System: BIGTIME POS

---

## A. X-READING (Cashier's Accountability / End-of-shift)

```text
BIGTIME POS - X-READING REPORT
Reading No.: XR-2026-04-14-0007
Date/Time Generated: 2026-04-14 16:42:10
Branch: MAIN BRANCH
Terminal: POS-01
Cashier: CSH-001 / JUAN DELA CRUZ
Shift: MORNING

OR RANGE COVERED
From OR/SI: SI 000431
To OR/SI:   SI 000452
Total Transactions: 22

SALES SUMMARY
Gross Sales:                PHP 18,540.00
VATable Sales:              PHP 16,553.57
VAT Amount (12%):           PHP 1,986.43
VAT-Exempt Sales:           PHP 0.00
Zero-Rated Sales:           PHP 0.00
Discounts (SC/PWD/Others): PHP 1,145.50
Refunds/Returns:            PHP 224.00
Net Sales:                  PHP 17,170.50

TENDER BREAKDOWN
Cash:                       PHP 11,290.00
Card:                       PHP 3,950.00
GCash/Maya:                 PHP 1,930.50
Split:                      PHP 0.00

Cash-in-Drawer (Expected):  PHP 11,290.00

Prepared by: CSH-001
Checked by: SUP-002

Software: BIGTIME POS v1.0.0
```

## B. Z-READING (End-of-day)

```text
BIGTIME POS - Z-READING REPORT
Reading No.: ZR-2026-04-14-0002
Date/Time Generated: 2026-04-14 23:58:39
Branch: MAIN BRANCH
Terminal: POS-01
Business Date: 2026-04-14

DAILY OR RANGE
From OR/SI: SI 000401
To OR/SI:   SI 000498
Total Transactions: 98

DAILY SALES TOTALS
Gross Sales:                PHP 83,760.00
VATable Sales:              PHP 74,785.71
VAT Amount (12%):           PHP 8,974.29
VAT-Exempt Sales:           PHP 0.00
Zero-Rated Sales:           PHP 0.00
Total Discounts:            PHP 4,918.00
Total Refunds/Returns:      PHP 1,236.00
Net Sales:                  PHP 77,606.00

PAYMENT SUMMARY
Cash:                       PHP 47,925.00
Card:                       PHP 17,140.00
GCash/Maya:                 PHP 12,541.00
Split:                      PHP 0.00

CONTROL INFORMATION
Machine Identification No. (MIN): MIN-00045
Serial Number: SN-BTP-2026-001
Permit No.: PTU-2026-01458

Prepared by: SYSTEM AUTO-CLOSE
Verified by: BRANCH ADMIN

Software: BIGTIME POS v1.0.0
```

---

## Item 6 Compliance Notes

1. X-Reading shows end-of-shift accountability per cashier/terminal.
2. Z-Reading shows end-of-day consolidated totals and OR span.
3. Replace sample figures with actual printed readings from your live/pre-prod POS run before final BIR submission.
