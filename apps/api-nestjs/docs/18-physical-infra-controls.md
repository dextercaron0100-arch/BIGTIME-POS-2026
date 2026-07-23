# BIGTIME POS — Physical Infrastructure and Network Security Controls

**Document No.:** 18  
**Annex B Reference:** Items — Server room physical controls; network/firewall controls; remote access encryption; unused network ports disabled  
**Date Prepared:** 2026-04-16

---

## 1. Purpose

This document serves as a checklist and evidence template for physical infrastructure and network security controls required by BIR Annex B. These controls are operational/deployment-level requirements that must be satisfied by the organization deploying BIGTIME POS.

---

## 2. Server Room and Data Center Controls

The following controls must be implemented in the production hosting environment:

### 2.1 Access Control
- [ ] Server room and data center are locked at all times
- [ ] Access is restricted to authorized IT personnel only
- [ ] Access log is maintained (physical logbook or electronic access control system)
- [ ] Visitor access requires escort by authorized personnel

### 2.2 Environmental Controls
- [ ] Air conditioning is installed and maintained to keep server equipment within safe operating temperature range
- [ ] Temperature and humidity are monitored (manual or automated)

### 2.3 Power Protection
- [ ] Uninterruptible Power Supply (UPS) is installed for all critical servers
- [ ] Generator backup is available for extended outages
- [ ] Power logs are maintained

### 2.4 Fire Suppression
- [ ] Fire suppression system (fire extinguisher or automatic suppression) is installed in the server room
- [ ] Fire detection (smoke/heat alarms) is operational
- [ ] Annual fire safety inspection is conducted

### 2.5 Cable Management
- [ ] Network and power cables are properly labeled and organized
- [ ] No cables obstruct access pathways or ventilation
- [ ] Cable routing is documented

---

## 3. Network Security Controls

### 3.1 Firewall
- [ ] A hardware or software firewall is deployed between the internet and the internal network
- [ ] Firewall rules are documented and reviewed quarterly
- [ ] Only required ports are open (443/HTTPS for API, 5432/PostgreSQL internal only)
- [ ] Firewall logs are retained for at least 1 year

### 3.2 Unused Network Ports
- [ ] Unused physical network ports on switches are disabled
- [ ] Unused logical ports are closed via firewall rules
- [ ] Port scan audit is conducted annually

### 3.3 Remote Access Encryption
- [ ] All remote access to the server is conducted over encrypted channels:
  - HTTPS/TLS 1.2+ for API and dashboard access
  - SSH with key-based authentication for server administration (no password-only SSH)
  - VPN for internal network access from outside the office
- [ ] SSL/TLS certificates are issued by a trusted Certificate Authority and renewed before expiry
- [ ] HTTP is redirected to HTTPS (no unencrypted access permitted)

### 3.4 Access to External Networks
- [ ] All internet-bound traffic passes through the firewall
- [ ] Outbound traffic is monitored and logged
- [ ] Access logs are reviewed monthly by the IT administrator

---

## 4. Application-Level Security (Implemented in Code)

The following network security controls are enforced at the application layer by BIGTIME POS:

| Control | Implementation |
|---|---|
| Authentication required for all API endpoints | JWT bearer token, validated on every request |
| Role-based access control | Admin, Supervisor, Cashier, Inventory, Auditor roles enforced at API layer |
| Account lockout after failed logins | 5 attempts → 30-minute lockout (configurable via `AUTH_MAX_FAILED_LOGIN_ATTEMPTS`) |
| Admin-only dashboard access | Dashboard login restricted to ADMIN role |
| PIN complexity enforcement | Minimum 6 characters, alphanumeric required |
| Audit trail | All critical actions logged with user, timestamp, and SHA-256 hash |

---

## 5. Deployment Verification Sign-Off

The deploying organization must complete and sign the following:

| Control | Implemented | Responsible Person | Date |
|---|---|---|---|
| Server room locked and access-controlled | ☐ Yes / ☐ No | | |
| Air conditioning operational | ☐ Yes / ☐ No | | |
| UPS and fire suppression installed | ☐ Yes / ☐ No | | |
| Cables properly installed | ☐ Yes / ☐ No | | |
| Firewall deployed and documented | ☐ Yes / ☐ No | | |
| Unused network ports disabled | ☐ Yes / ☐ No | | |
| Remote access via HTTPS/TLS only | ☐ Yes / ☐ No | | |
| Firewall monitoring and logging active | ☐ Yes / ☐ No | | |

**Signed by:** _________________________________ **Date:** _____________  
**Position:** _________________________________
