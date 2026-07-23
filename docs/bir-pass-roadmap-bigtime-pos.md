# BIGTIME POS BIR Pass Roadmap

Prepared on: April 13, 2026  
System name: BIGTIME POS  
Recommended positioning: `POS software with invoice issuance, audit trail, backend reports, and sales data transmission`

## Best Pass Strategy

The best path for BIGTIME POS is to present it to the BIR as a **POS software platform** and not as a full accounting, payroll, or withholding-tax system.

That means the system should be strongest in these areas:

- invoice issuance at point of sale
- cashier shift and terminal controls
- audit trail and e-journal
- Z-readings and backend reports
- non-volatile local storage and synchronization
- sales data transmission / EIS readiness

The goal is:

- all `applicable` POS and invoice items = `YES`
- only truly out-of-scope items = `N/A`
- no remaining `NO` in the software areas that BIGTIME POS is expected to cover

## Important Compliance Direction

As of **April 13, 2026**, BIGTIME POS should already be operating under the invoicing rules introduced by the Ease of Paying Taxes changes.

- `April 27, 2024`: new invoicing rules took effect
- `December 31, 2024`: transition period for continuing to use `Official Receipt` as the principal sales document ended

Recommended direction for BIGTIME POS:

- use `Invoice` or `Sales Invoice` as the principal sales document
- use `Official Receipt`, payment receipt, collection receipt, refund slip, and similar documents only as supplementary documents when applicable
- do not position the product as a payroll or withholding certificate system unless you intentionally want to expand scope

## 1. Build In Code Now

These are the software changes that give the highest chance of passing BIR evaluation for a POS product.

### A. Convert the primary receipt to `Invoice`

Highest priority.

- change the principal printed sales document from `Official Receipt` to `Invoice` or `Sales Invoice`
- ensure the printed document name, headers, and footer follow current invoice rules
- keep supplementary documents clearly labeled as supplementary

### B. Complete the invoice fields required on the sale document

The POS printout should consistently support:

- seller's registered name
- business name / style, if any
- detailed business address
- `VAT REG TIN` or `NON-VAT REG TIN` with correct TIN and branch code
- `MIN`
- machine / software serial details as applicable
- invoice number with at least six running digits
- transaction date
- quantity
- item description
- unit cost
- total amount
- VAT amount when taxable
- VATable / VAT Exempt / Zero-Rated breakdown where applicable

### C. Separate invoice numbering from transaction reference numbering

- keep the BIR-facing invoice number in its own accountable series
- do not treat internal transaction references as the same series as the invoice number
- standardize numbering convention and zero-padding

### D. Add buyer fields when required

For transactions where buyer details are needed, support:

- buyer name
- buyer address
- buyer TIN and branch code
- buyer business style

This is especially important for VAT buyers that need compliant invoices.

### E. Support discount-specific statutory receipt details

If BIGTIME POS will handle these transactions in live use, the invoice should support:

- Senior Citizen details
- PWD details
- discount breakdown
- VAT exemption breakdown
- signature area where required

If you plan to serve those transactions, implement them fully rather than partially.

### F. Standardize supplementary documents for adjustments

Void, refund, cancellation, return, and other adjustment documents should have:

- a clear document type
- unique serial or reference number
- reason capture
- audit trail entry
- clear relationship to the original invoice

### G. Make reprints fully BIR-safe

- show `REPRINT` on subsequent printouts
- preserve the original content template
- require a reason for reprint
- log all reprint actions in the audit trail

### H. Make audit trail demonstrable and exportable

Keep strengthening:

- append-only or tamper-evident audit logging
- user ID stamping
- transaction timestamps
- void/refund history
- receipt print / reprint / email events
- printable or exportable audit trail output

### I. Finalize backend reports

At minimum, your evaluators should be able to see:

- sales reports
- shift reports
- Z-readings
- terminal reports
- audit trail outputs
- BIR / EIS monitoring views

Each report should have standardized headers including:

- taxpayer name
- registered address
- TIN and branch code
- software name and version
- user who generated the report
- generated date and time

### J. Add formal export options

Where BIR expects exports, prioritize:

- `.csv`
- `.dat`
- printable PDF or report views for demonstration

### K. Tighten the security controls

These software-side controls are worth implementing now:

- failed login lockout or temporary account suspension after repeated attempts
- stronger PIN / password policy where applicable
- controlled role-based access
- single active session per user
- logging of critical record modifications

### L. Make EIS / sales data transmission production-ready

Your EIS capability should be ready for live demonstration with:

- real endpoint configuration
- production API key handling
- signing
- retries
- submission monitoring
- acknowledgment tracking

## 2. Prepare As Documents

These items help you pass, but they are not solved by code alone.

### A. Annex `B` accomplished checklist

- keep the current accomplished draft updated
- justify every `PARTIAL` and `N/A`
- avoid claiming `YES` unless you can demonstrate it live

### B. Annex `C` sworn statement

- explicitly attest to the current POS features
- align all sworn claims with what the product can really do

### C. System description

Include:

- dashboard scope
- API scope
- POS Android / Windows scope
- data flow
- sync flow
- receipt / invoice flow
- report flow
- security controls

### D. Process flow and backup / recovery procedure

Prepare a clear write-up for:

- transaction flow
- offline queue and synchronization
- backup schedule
- restore process
- retention policy

### E. Security and access SOP

Document:

- user onboarding approval
- role assignment
- user deactivation on resignation / transfer
- password or PIN issuance policy
- device and terminal access policy

### F. Hosting / infrastructure controls

Whether cloud or on-premise, prepare documentation for:

- firewalling
- HTTPS / TLS
- monitoring
- backup storage
- power / disaster recovery controls
- access control to servers or hosting consoles

If you are hosted in managed cloud infrastructure, document the provider controls rather than trying to fake this in software.

### G. Sample outputs for the BIR demo

Prepare sample outputs before the evaluation:

- sample invoice
- sample reprint
- sample void or refund document
- sample audit trail
- sample Z-reading
- sample backend report
- sample EIS monitoring screen or extract

### H. Comparative matrix if this is an upgraded accredited version

If BIGTIME POS is being submitted as a major enhancement to a previously accredited version, prepare:

- old features vs new features
- receipt changes
- invoice changes
- security changes
- reporting changes

## 3. Leave As `N/A`

These items should stay `N/A` unless you intentionally expand BIGTIME POS beyond POS scope.

### A. Withholding tax certificate generation

Leave `N/A` unless BIGTIME POS will truly generate:

- BIR Form 2306
- BIR Form 2307
- BIR Form 2316

This is usually outside the natural scope of a POS application.

### B. Dial-up specific security controls

Leave `N/A` if BIGTIME POS does not use dial-up connectivity.

### C. Full CAS-only outputs, if you are not registering BIGTIME POS as a full CAS product

If BIGTIME POS is being positioned strictly as POS software and not as a complete CAS / accounting suite, do not force unrelated accounting modules into the product just to chase `YES`.

Examples that may remain `N/A` or outside your immediate build scope unless the BIR application path specifically requires them:

- full General Journal generation
- full General Ledger generation
- full Purchase Journal generation
- full accounting-book suite beyond POS backend reports

Use caution here: if your application is being presented as `POS as component of CAS`, these may no longer be safely `N/A`.

## 4. Decision Rule For BIGTIME POS

For the best chance of passing:

- make invoice compliance perfect
- make POS audit and reporting demonstrable
- prepare strong documents and sample outputs
- keep irrelevant items honestly marked as `N/A`
- do not bloat the system into a fake accounting suite unless you are truly changing product scope

## 5. Recommended Order Of Work

### Phase 1 - Immediate software fixes

1. Rename principal receipt to `Invoice`
2. Complete invoice fields and footer
3. Separate invoice series from internal transaction references
4. Finalize reprint and supplementary document handling
5. Add buyer fields where required

### Phase 2 - Compliance and demo readiness

1. Finalize audit trail export
2. Finalize Z-reading and backend report headers
3. Add `.csv` / `.dat` exports where needed
4. Tighten login lockout and security policy controls
5. Prepare production EIS configuration

### Phase 3 - Documentary package

1. Annex `B`
2. Annex `C`
3. system description
4. backup / recovery SOP
5. security and access SOP
6. sample invoices and reports

## Source References

- BIR official Annex `B`: `RMC No. 5-2021 Annex B`
- BIR accreditation digest: `RMO No. 24-2023 Digest`
- BIR invoicing transition rules: `RR No. 11-2024`
- BIR clarification digest on invoicing rules: `RMC No. 77-2024 Digest`
