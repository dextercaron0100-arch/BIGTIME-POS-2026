# BIGTIME POS

## Item 9 Compliance Sample

### Narrative system description and design / structure of the Sales Machine / Software being applied for accreditation

Requirement covered:

"9. Narrative system description and design/ structure of the 'Sales Machine/Software' being applied for accreditation;"

Prepared on: April 15, 2026
System: BIGTIME POS

---

## 1. Narrative System Description

BIGTIME POS is an integrated sales and back-office platform designed for cashiering, receipt issuance, inventory control, reporting, and operational administration. The system is intended for use in retail environments where transactions must continue in both online and temporary offline conditions while preserving central records and statutory outputs.

The platform is composed of three primary layers:

- POS Terminal Application used by cashiers on Windows or Android devices
- Back-office Dashboard used by administrators, managers, and authorized office users
- Central API and database services used for business rules, transaction processing, synchronization, and reports

BIGTIME POS supports the full transaction cycle from cashier login up to receipt generation, shift accountability, and end-of-day operational reporting. The system also supports inventory and listing maintenance, employee management, receipt retrieval, report generation, and audit visibility.

---

## 2. System Design and Structure

### 2.1 POS Terminal Layer

The POS terminal is the front-line cashier application. It is designed for guided operational flow and practical in-store usage. The normal sequence of use is:

1. Cashier login
2. Shift opening
3. Selling and cart building
4. Payment confirmation
5. Receipt issuance

The POS terminal supports:

- employee code and PIN login
- shift cash handling
- item search and sale entry
- discount application
- payment processing
- receipt printing and reprinting
- X-reading and Z-reading generation
- temporary offline continuity using local storage and queued sync records

### 2.2 Back-Office Dashboard Layer

The dashboard is the centralized administration and monitoring interface. It is used to maintain business data and review outputs produced by the POS and central services.

Major dashboard modules include:

- receipts
- catalog and listing maintenance
- inventory and stock operations
- employee and POS user administration
- reports and compliance-oriented report views
- settings and account management

The dashboard is browser-based and depends on the central API for authenticated access and data retrieval.

### 2.3 Central API and Data Layer

The central API is the business logic layer of BIGTIME POS. It provides authenticated endpoints and coordinates the processing of transactions and operational data.

Core responsibilities of the API include:

- authentication and access control
- transaction intake and receipt generation
- pricing, catalog, inventory, and employee services
- audit visibility and receipt event logging
- report generation and compliance-related endpoints
- synchronization handling for offline terminal records
- realtime and queue-assisted backend operations

Central persistence is maintained in PostgreSQL. Queue-oriented infrastructure is supported through Redis. For offline continuity, the POS terminal keeps local records using SQLite through Drift until synchronization is completed.

---

## 3. High-Level Operating Structure

The design structure of BIGTIME POS can be summarized as follows:

- Cashier transactions originate from the POS terminal
- Central business validation and record management are handled by the API
- Administrative review and maintenance are performed in the dashboard
- Central records are stored in the database
- Offline transactions are temporarily stored locally and synchronized later

This structure allows store operations to continue during short connectivity interruptions while preserving the role of the server as the authoritative source of centrally stored records when connection is available.

---

## 4. Users and Roles

The system supports different operational user roles:

- Cashier: performs sales, payment, receipt issuance, and shift handling in the POS terminal
- Supervisor or Manager: oversees operations, adjustments, and end-of-day accountability
- Administrator / Back-office User: maintains master data, reviews reports, manages users, and monitors statutory outputs

Each layer is intended for its proper user group and operational purpose.

---

## 5. Compliance-Relevant Design Characteristics

BIGTIME POS includes structural characteristics relevant to accreditation and operational control:

- guided sales flow from login to receipt
- centralized receipt and transaction record handling
- audit-aware event visibility
- reporting and export support
- online and offline operating modes
- shift and end-of-day reporting processes
- centralized administrative maintenance of key business data

---

## 6. Document Purpose

This narrative system description is prepared as the Item 9 attachment for Annex B submission and describes the design and operating structure of the BIGTIME POS sales software being applied for accreditation.
