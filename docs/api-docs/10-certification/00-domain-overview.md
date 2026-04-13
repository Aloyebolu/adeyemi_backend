## 1. Domain Purpose

The **Certification** domain governs how an internship is **formally concluded and certified**.

Certification represents the **official recognition** that a student has:

* Completed the internship
* Met all mandatory requirements
* Passed all KPI and evaluation thresholds

Once issued, certification is **authoritative and immutable**.

---

## 2. Canonical Constraints (Reinforced)

This domain operates under the following **non-negotiable rules**:

* Certification is issued **only after completion**
* Completion is **hybrid**:

  * Minimum internship duration
  * Mandatory KPI thresholds met
* KPI results and evaluations are **immutable**
* Certificates are **immutable once issued**
* Admin has final issuance authority
* Backend is the final enforcer of all rules

---

## 3. In-Scope Responsibilities

This domain is responsible for:

* Determining certification eligibility
* Locking final internship snapshots
* Issuing certificates
* Managing certificate metadata
* Supporting verification and revocation

---

## 4. Out-of-Scope Responsibilities

Explicitly excluded:

* Internship execution
  → handled by `08-internship-execution`
* KPI calculation
  → handled by `09-kpis-performance`
* Notifications
  → handled by `11-notifications-logs`
* Admin system permissions
  → handled by `12-admin-system`

---

## 5. Primary Actors

### 5.1 Student

* Views certificate
* Downloads certificate
* Shares certificate externally

### 5.2 Employer

* Submits final evaluation (already completed upstream)
* No authority to issue certificates

### 5.3 Admin

* Reviews completion readiness
* Issues certificates
* Revokes certificates (with strict controls)

---

## 6. Certification Eligibility (High-Level)

An internship is **eligible for certification** only if:

* Internship state = `completed`
* Minimum duration satisfied
* All mandatory KPIs finalized and passed
* Employer evaluation submitted
* No compliance holds exist

Eligibility is computed server-side.

---

## 7. Certification Snapshot (Critical)

At certification time, the system snapshots:

* Student profile (immutable)
* Internship details
* KPI results
* Employer evaluation
* Completion timestamps

This snapshot is:

* Immutable
* Used for verification
* Legally authoritative

---

## 8. Certificate Concept

A certificate represents:

* Proof of internship completion
* Proof of performance validation
* A verifiable artifact for external use

Certificates may be issued by:

* Admin
* Partner NGOs
* Government bodies (if integrated)

Issuance authority is controlled by admin policy.

---

## 9. Visibility Rules

| Role              | Visibility                           |
| ----------------- | ------------------------------------ |
| Student           | Own certificates                     |
| Employer          | ❌ None                               |
| Admin             | All certificates                     |
| External Verifier | Limited (verification endpoint only) |

---

## 10. Dependency Map

This domain depends on:

* `09-kpis-performance`

This domain feeds into:

* `11-notifications-logs`
* External verification systems

---

## 11. Files in This Domain

```
10-certification/
├── 00-domain-overview.md   ✅ (this file)
├── 01-completion-criteria.md
├── 02-certificate-issuance.md
└── 03-verification-revocation.md
```

---

## 🔒 Domain Lock Statement

Certification rules are **final, authoritative, and legally sensitive**.
No domain may issue, alter, or invalidate certificates outside this domain.
