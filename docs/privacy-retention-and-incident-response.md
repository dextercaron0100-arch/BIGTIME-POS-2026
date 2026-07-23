# Privacy, retention, and incident response baseline

This document is an operational baseline and must be reviewed by the organization's Data Protection Officer and Philippine privacy counsel before production use.

## Data handling

- Collect only fields required for sales, BIR records, employment, inventory, supplier management, and security.
- Restrict access by organization, branch, and role; record administrative access and exports.
- Publish a privacy notice identifying purposes, lawful basis, recipients, retention, rights, and DPO contact details.
- Provide authenticated procedures for access, correction, portability/export where applicable, objection, and deletion where no statutory retention duty applies.

## Retention defaults

| Data | Default rule |
| --- | --- |
| Official sales, tax, and audit records | Retain for the applicable BIR/statutory period; never delete through ordinary account controls |
| Active employee/account records | Employment/account lifetime plus the approved legal retention period |
| Revoked sessions and security events | 12 months unless an investigation or legal hold requires longer |
| Failed upload remnants and temporary exports | Delete immediately after processing or failure |
| Backups | Rolling encrypted schedule approved by the DPO; expired copies securely destroyed |

The DPO must replace defaults with the final legal schedule and document exceptions and legal holds.

## Incident response

1. Contain: revoke exposed sessions/secrets, isolate affected hosts, and preserve evidence.
2. Assess: identify affected systems, people, data categories, time window, and likely harm.
3. Escalate immediately to the incident lead and DPO; start the regulatory notification clock.
4. Notify the National Privacy Commission and affected data subjects within the applicable deadline when required; target completion within 72 hours of knowledge of a notifiable breach.
5. Recover from verified clean backups, rotate credentials, monitor for recurrence, and document all decisions.
6. Complete a post-incident review with corrective actions, owners, and deadlines.

Never place customer data, access tokens, PINs, secrets, or full production records in tickets, chat, screenshots, or source control.
