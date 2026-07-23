# BIGTIME POS

## Item 13 Compliance Sample

### Printed copy of System Audit Trail / Activity Log

Requirement covered:

"13. Printed copy of System audit trail or activity log containing Date and Time Stamp, User Name/ ID, Activity Performed, and Values of Data Involved in the Activity;"

Prepared on: April 14, 2026
System: BIGTIME POS

---

## Audit Trail Format (Sample Printout)

| Date & Time (PHT) | User Name / ID | Module / Screen | Activity Performed | Values of Data Involved |
|---|---|---|---|---|
| 2026-04-14 08:12:09 | Maria Santos / EMP-1001 | Cashier Login | User login success | Branch=`branch-manila`; Mode=`Online`; Terminal=`POS-WIN-01` |
| 2026-04-14 08:15:33 | Maria Santos / EMP-1001 | Shift Management | Open shift | ShiftNo=`S-20260414-001`; OpeningCash=`2000.00` |
| 2026-04-14 08:21:46 | Maria Santos / EMP-1001 | Sales | Added item to cart | SKU=`BG-CAFE-LATTE-240`; Qty=`1`; UnitPrice=`79.00` |
| 2026-04-14 08:22:05 | Maria Santos / EMP-1001 | Sales / Discount | Applied discount | Type=`SC`; Rate=`20%`; DiscountAmount=`15.80` |
| 2026-04-14 08:22:58 | Maria Santos / EMP-1001 | Payment | Completed cash payment | Subtotal=`79.00`; Discount=`15.80`; Net=`63.20`; Tendered=`100.00`; Change=`36.80` |
| 2026-04-14 08:23:01 | Maria Santos / EMP-1001 | Receipts | SI/OR generated | ORNo=`OR-20260414-000128`; TxnId=`TXN-9A72C4` |
| 2026-04-14 08:23:20 | Maria Santos / EMP-1001 | Receipts | Receipt reprint | ORNo=`OR-20260414-000128`; Reason=`Customer copy request` |
| 2026-04-14 09:10:11 | Juan Dela Cruz / MGR-2001 | Inventory | Updated item stock | SKU=`BG-CAFE-LATTE-240`; OldStock=`55`; NewStock=`60`; Reason=`Delivery` |
| 2026-04-14 09:32:44 | Juan Dela Cruz / MGR-2001 | Sales Adjustment | Void transaction | ORNo=`OR-20260414-000131`; Reason=`Wrong item encoded`; Status=`Voided` |
| 2026-04-14 17:58:31 | Maria Santos / EMP-1001 | End of Day | Generated X-Reading | XReadingNo=`X-20260414-01`; GrossSales=`12480.00` |
| 2026-04-14 18:10:07 | Juan Dela Cruz / MGR-2001 | End of Day | Generated Z-Reading | ZReadingNo=`Z-20260414-01`; GrossSales=`28750.00`; NetSales=`25920.00` |

---

## Data Fields Included (for Item 13 checklist)

1. Date and Time Stamp: **Included**
2. User Name / ID: **Included**
3. Activity Performed: **Included**
4. Values of Data Involved: **Included**

---

## Printout Note

This sample is formatted for printing and filing under Item 13 in Annex B submission. Actual export from BIGTIME POS audit log/report module may be attached together with this cover/sample format.
