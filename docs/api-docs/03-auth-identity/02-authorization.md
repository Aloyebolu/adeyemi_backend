## Authorization

This document defines **how authenticated users are authorized** to access resources and perform actions in the Virtual Internship Platform.

Authorization answers **“Are you allowed to do this?”**
It always runs **after authentication** and **before business logic**.

---

## Authorization Principles

Authorization in this platform is:

* Role-based
* Ownership-aware
* State-aware
* Enforced exclusively on the backend
* Canon-driven

If authorization fails, the request **must not** reach business logic.

---

## Authorization Layers

Every protected endpoint must enforce authorization in **four layers**, in order:

1. Authentication validation
2. Role validation
3. Ownership validation
4. State validation

Failure at any layer results in request rejection.

---

## 1️⃣ Role-Based Authorization

### Role Validation Rules

* Each endpoint explicitly lists allowed roles
* Roles are derived from the access token
* Role escalation is forbidden

Example:

* A `STUDENT` token cannot access employer-only endpoints
* An `EMPLOYER` cannot access admin-only actions

If role validation fails:

* Return `403 Forbidden`
* Do not leak endpoint purpose

---

## 2️⃣ Ownership-Based Authorization

### Ownership Rules

Ownership determines **which specific resources** a user can access.

Examples:

* A student can access only their own applications
* An employer can access only internships they created
* An admin can access all resources

Ownership checks must:

* Be explicit
* Use server-validated identifiers
* Never rely on frontend-provided ownership flags

---

### Ownership Failure Response

```json
{
  "success": false,
  "message": "Access denied",
  "errors": [
    {
      "field": "ownership",
      "issue": "resource_not_owned"
    }
  ],
  "meta": {}
}
```

---

## 3️⃣ State-Based Authorization

### State Validation Rules

Actions are allowed **only** in valid states.

Examples:

* Applications can be submitted only when internships are open
* Tasks can be submitted only when internship is ACTIVE
* Certificates can be issued only after completion

State checks must:

* Reference canonical state machines
* Be enforced before executing actions

Invalid state transitions return:

* HTTP `409 Conflict` or `422 Unprocessable Entity`

---

## 4️⃣ Cross-Role Interaction Rules

Authorization must also respect **cross-role boundaries**:

### Student ↔ Student

* No access to other students’ data

### Employer ↔ Employer

* No access to internships owned by others

### Employer ↔ Student

* Employers see only data relevant to their internships

### Admin ↔ All

* Admin has read/write access, but actions are logged

---

## Admin Override Authorization

### Special Case: Admin Overrides

Admins may bypass normal authorization rules **only through explicit override endpoints**.

Rules:

* Overrides must be intentional
* Overrides require justification
* Overrides are logged
* Overrides must not silently mutate immutable records

---

## Authorization Failure Semantics

| Scenario                              | Status    |
| ------------------------------------- | --------- |
| Not authenticated                     | 401       |
| Authenticated but unauthorized        | 403       |
| Valid role, invalid ownership         | 403       |
| Valid role & ownership, invalid state | 409 / 422 |

Error responses must follow standard conventions.

---

## Authorization Is Not UI Logic

Frontend must:

* Assume backend will reject invalid actions
* Handle authorization failures gracefully
* Never hide backend authorization gaps

Authorization rules must never depend on UI flow correctness.

---

## Relationship to Canon

This document enforces:

* Canon 1 (Authority hierarchy)
* Canon 2 (Workflow enforcement)
* Canon 9 (Backend enforcement)
* Canon 10 (Auditability)
