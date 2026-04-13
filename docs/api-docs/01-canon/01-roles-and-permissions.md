## Roles and Permissions

This document defines the **authoritative role model** for the Virtual Internship Platform.

Roles determine:

* What data a user can access
* What actions a user can perform
* What states a user can transition

Permissions are enforced **strictly at the backend level**.
Frontend checks are informational only.

---

## Role Model Overview

The system recognizes the following roles:

| Role     | Code       | Description                          |
| -------- | ---------- | ------------------------------------ |
| Student  | `STUDENT`  | Internship participant               |
| Employer | `EMPLOYER` | Internship provider and evaluator    |
| Admin    | `ADMIN`    | Platform authority and auditor       |
| Partner  | `PARTNER`  | External verifier / reporting access |
| System   | `SYSTEM`   | Internal services and AI consumers   |

Each authenticated user has **exactly one primary role**.

---

## Permission Fundamentals

### 1. Role Is Token-Derived

* Roles are embedded in access tokens
* Roles are never passed manually in requests
* Requests with mismatched role access are rejected

---

### 2. Least Privilege Principle

Each role receives:

* Only permissions required for its responsibilities
* No implied or inherited access

---

### 3. Ownership Enforcement

Beyond role checks, the system enforces **ownership rules**:

* Students can only access their own records
* Employers can only access internships they own
* Partners see only explicitly shared data

---

## Role Definitions & Capabilities

---

### STUDENT Role

#### Primary Capabilities

* Register and authenticate
* Manage personal profile and documents
* Complete preparation drills
* Browse and apply for internships
* Accept internship offers
* Perform internship activities (clock-in, tasks, training)
* View KPIs, evaluations, and certificates

#### Explicit Restrictions

* Cannot modify evaluations or KPIs
* Cannot alter internship states
* Cannot access other students’ data
* Cannot issue or revoke certificates

---

### EMPLOYER Role

#### Primary Capabilities

* Create and manage employer profile
* Create and publish internships
* View and manage applications
* Shortlist candidates
* Schedule interviews
* Issue internship offers
* Submit intern evaluations
* View internship performance data

#### Explicit Restrictions

* Cannot override system KPIs
* Cannot edit student preparation records
* Cannot issue certificates
* Cannot access internships owned by other employers

---

### ADMIN Role

#### Primary Capabilities

* Full read access across the system
* Override any workflow state with justification
* Review and adjust KPIs (via correction workflows)
* Issue, revoke, and reissue certificates
* Manage system settings
* Access audit logs and reports
* Resolve disputes

#### Explicit Restrictions

* Cannot silently alter immutable records
* Cannot bypass audit logging

Admin power is **broad but traceable**.

---

### PARTNER Role

#### Primary Capabilities

* View verification data (certificates, summaries)
* Access reports explicitly shared with partners
* Verify authenticity of certificates

#### Explicit Restrictions

* No write access to core system data
* No access to raw internship execution data
* No access to personal student documents unless authorized

---

### SYSTEM Role

#### Primary Capabilities

* Generate AI recommendations
* Compute KPIs
* Trigger background workflows
* Emit system events

#### Explicit Restrictions

* Cannot act as a human user
* Cannot override admin decisions
* Cannot access data beyond defined scopes

System actions must always be attributable.

---

## Cross-Role Interaction Rules

### Student ↔ Employer

* Communication is always mediated by the platform
* No direct data sharing outside documented endpoints

---

### Employer ↔ Admin

* Employers may request reviews or escalations
* Admin decisions are final

---

### Student ↔ Admin

* Students may request reviews
* Students cannot directly modify outcomes

---

## Permission Conflict Resolution

If two roles appear to have conflicting permissions:

1. Canonical authority hierarchy applies
2. Admin authority prevails
3. System-enforced rules override user intent

---

## Enforcement Requirements

Every protected endpoint must:

* Validate authentication
* Validate role
* Validate ownership
* Validate state

Failure at any step results in request rejection.

---

## Relationship to Other Canon Files

This document must be read alongside:

* `01-canon / 00-canonical-decisions.md`
* `01-canon / 02-state-machines.md`
