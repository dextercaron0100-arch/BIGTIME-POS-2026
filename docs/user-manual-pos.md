# BIGTIME POS User Manual

Version: 1.0  
Prepared on: March 23, 2026 (Asia/Manila)

## 1. Purpose
This manual explains how to operate your POS system based on the current implementation in:
- `apps/pos-flutter` (cashier terminal)
- `apps/dashboard-react` (admin back office)
- `apps/api-nestjs` (server API)

## 2. Supported Users and Roles
- Cashier: sell items, receive payments, print receipts, end shift
- Supervisor/Admin: view/handle operational controls (void/refund via API/dashboard tools)
- Admin: back-office login and management pages

## 3. Getting Started

### 3.1 Start Backend and Dashboard
From workspace root:
```powershell
npm install
npm run dev:api
npm run dev:dashboard
```

### 3.2 Start POS Terminal
```powershell
cd "C:\Users\dex\Desktop\PROJECT 2026\POS SYSTEM\apps\pos-flutter"
flutter pub get
flutter run -d windows
```

For Android device or emulator:
```powershell
flutter run -d <device_id>
```

## 4. Cashier Workflow (POS App)

### 4.1 Login
1. Open POS app.
2. Enter employee code and PIN (4 to 6 digits).
3. Tap `Login`.
4. If API is reachable, session is validated online.
5. If API is temporarily unreachable, POS can continue in offline mode and queue transactions.

### 4.2 Open Shift
1. Enter opening cash float.
2. Tap `Start selling`.
3. Shift data is saved locally and queued for sync.

### 4.3 Selling Screen
1. Search item by name/SKU/barcode or select from list.
2. Adjust quantity using `+` or `-`.
3. Use `Clear Cart` if needed.
4. Tap `Charge` to move to payment.

### 4.4 Payment
1. Select payment method (`Cash`, `Card`, `GCash`, `Maya`, `Split`).
2. For cash, enter tendered amount and verify change.
3. Tap `Confirm Payment`.

Result:
- Online: transaction is posted to server and official OR/reference are returned.
- Offline: local provisional receipt is created and reconciled on next successful sync.

### 4.5 Receipt Actions
On receipt screen:
- `Print`: sends receipt to printer
- `Reprint`: requires reason and logs event
- `Email` (Windows): opens email handoff draft
- `New transaction`: returns to selling screen

Receipt action events are queued and synced to backend for audit visibility.

### 4.6 End Shift
1. Ensure cart is empty.
2. Tap shift end action.
3. Enter blind cash count.
4. If variance is above configured threshold, manager approval code is required.
5. Shift close summary is printed and queued for sync.

## 5. Customer-Facing Display (CFD)

### 5.1 Open CFD Controls
From POS header, open customer display controls.

### 5.2 Configure Content
- Set thank-you message
- Choose fullscreen behavior
- Set image duration
- Add/remove image or video assets

### 5.3 Second Screen on Android
- CFD can be launched on secondary display through Android display handling when supported by device hardware and OS.
- If second display is not available, CFD falls back to in-app display route.

## 6. Back Office Workflow (Dashboard)

### 6.1 Admin Login
1. Open dashboard URL.
2. Sign in with admin code and PIN.
3. Non-admin users are blocked from back-office access.

### 6.2 Main Navigation Areas
- Dashboard overview
- Receipts
- Catalog and listing pages
- Inventory pages
- Reports (sales, cash balancing, BIR, EIS)
- Employees
- POS users
- Settings and account

### 6.3 Typical Admin Tasks
- Review daily sales and transaction activity
- Manage catalog and inventory records
- Monitor BIR and EIS submission status
- Review employee data and audit-related records
- Manage customer display settings and media

## 7. Offline and Sync Behavior

### 7.1 What Happens Offline
- POS keeps working with local data and queue.
- New records are stored in local sync queue.
- Queue is uploaded when internet/session are available.

### 7.2 Sync Outcomes
- Success: records marked synced
- Partial failure: failed records keep retry metadata
- No session: user must log in online again

### 7.3 Retry Strategy
- Automatic retries with backoff
- Chunked upload with adaptive split for payload limits

## 8. Troubleshooting

### 8.1 Login Fails
- Verify API is running on configured URL.
- Confirm employee code, branch mapping, and PIN.
- If session expired, login again while online.

### 8.2 No Items on POS
- Trigger sync from POS selling screen.
- Confirm catalog snapshot endpoint is reachable.

### 8.3 Receipt Not Printing
- Verify printer and hardware connection.
- Continue operation and retry print; receipt event remains auditable.

### 8.4 Queue Not Clearing
- Check internet connectivity.
- Confirm API is available and auth session is valid.
- Review outbox panel for retry errors.

## 9. Recommended Daily Operating Sequence
1. Start API and dashboard services.
2. Start POS terminal.
3. Login cashier and open shift.
4. Process sales throughout day.
5. Review sync status periodically.
6. End shift and perform cash reconciliation.
7. Review reports from dashboard.
