## Canonical Decisions

This document defines the **non-negotiable system decisions** that govern behavior across the entire Virtual Internship Platform.

These decisions are considered **canonical**:

* They apply to all domains
* They override domain-specific preferences
* They cannot be silently changed or bypassed

If any future requirement conflicts with canon, one of the following must happen:

* The requirement is rejected
* A **new API version** is created
* The canon is explicitly amended and documented

---

## Purpose of Canon

The canon exists to:

* Prevent contradictory implementations
* Eliminate implicit assumptions
* Protect system integrity as the platform scales
* Provide a stable reference point across teams and time

All developers **must read and understand this section** before implementing or consuming APIs.

---

## Canon 1: Authority Hierarchy

### Decision

The platform follows a **clear authority hierarchy**:

1. **Admin** – ultimate authority
2. **Employer** – authority over internship-specific evaluations
3. **System** – authority over computed KPIs and states
4. **Student** – no authority to alter official records

### Implications

* Admin can override any decision with justification
* Employers cannot override system-calculated KPIs
* Students cannot directly modify evaluations or outcomes

### Enforcement

* Overrides require reason + audit log
* Authority is enforced at backend level

---

## Canon 2: One Active Internship Rule

### Decision

A student may have **only one ACTIVE internship** at any given time.

### Implications

* Students may apply to multiple internships
* Students may receive multiple offers
* Accepting an offer automatically invalidates other active offers

### Enforcement

* Backend rejects offer acceptance if another internship is ACTIVE
* Frontend must display clear blocking messages

---

## Canon 3: Internship Completion Model (Hybrid)

### Decision

Internship completion is **hybrid** and requires:

* Minimum internship duration reached
* Required KPIs satisfied
* Minimum task completion threshold met

Meeting only one condition is insufficient.

### Implications

* Time alone does not guarantee completion
* Task completion alone does not guarantee completion
* Manual completion without KPIs is not allowed

---

## Canon 4: Preparation as a Hard Gate

### Decision

Preparation is **mandatory** before internship application.

This includes:

* Resume Drill completion
* Interview Drill completion

### Implications

* Students cannot apply without preparation
* Preparation data influences AI recommendations
* No “apply anyway” bypass exists

---

## Canon 5: Attendance (Clock-In) Is Mandatory

### Decision

Clock-in is required on designated internship working days.

### Implications

* Missing clock-ins negatively affect KPIs
* Excessive absence blocks internship completion
* Clock-in data contributes to performance scoring

Clock-in is **not optional** and not cosmetic.

---

## Canon 6: AI Recommendations Are Advisory

### Decision

AI-generated rankings and recommendations are **decision support**, not decision makers.

### Implications

* Employers may override AI suggestions
* Overrides must be logged
* AI data remains visible for analysis

The system must never auto-select candidates solely based on AI.

---

## Canon 7: Immutability of Finalized Records

### Decision

Once finalized, the following records are **immutable**:

* KPI results
* Employer evaluations
* Issued certificates

### Implications

* No edits or deletions are allowed
* Corrections require admin-led revocation and reissue
* History must be preserved

---

## Canon 8: Certification as a Formal Outcome

### Decision

Certificates represent **official platform outcomes**.

### Implications

* Certificates are issued only after verification
* Certificates must be verifiable by third parties
* Certificate issuance implies internship completion

Certificates are not decorative assets.

---

## Canon 9: Backend-Enforced Rules

### Decision

All canonical rules are enforced **server-side**.

### Implications

* Frontend validations are advisory only
* API must reject invalid actions even if frontend allows them
* Clients must handle rejection gracefully

---

## Canon 10: Auditability Is Mandatory

### Decision

All sensitive actions must be auditable.

This includes:

* Overrides
* Evaluations
* Certification actions
* State transitions

### Implications

Audit records must capture:

* Actor
* Action
* Target
* Timestamp
* Reason (where applicable)

---

## Canon Change Policy

Canonical decisions may only change if:

* The change is documented
* The impact is assessed
* A version boundary is respected

Ad-hoc changes are forbidden.