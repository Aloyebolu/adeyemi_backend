## Global Rules

This document defines **system-wide rules** that apply across all domains, roles, and endpoints in the Virtual Internship Platform.

These rules are **always active**, regardless of feature, screen, or API version.

If a domain-specific rule conflicts with a global rule, the **global rule wins**.

---

## Rule 1: Backend Is the Final Enforcer

All critical rules must be enforced **server-side**.

This includes:

* Role checks
* State transitions
* Ownership validation
* Canonical constraints

Frontend validations are **informational only** and must never be trusted as enforcement.

---

## Rule 2: No Implicit Actions

The system must never:

* Auto-trigger hidden actions
* Change state without explicit endpoints
* Infer user intent

If something happens, there must be:

* A documented endpoint
* A documented trigger
* A documented result

---

## Rule 3: Atomic Operations Only

Critical actions must be atomic.

Examples:

* Accepting an internship offer
* Completing an internship
* Issuing a certificate
* Admin overrides

If any step fails, **nothing is persisted**.

Partial success is not allowed.

---

## Rule 4: Idempotency for Sensitive Actions

Endpoints that trigger important actions must be idempotent.

Examples:

* Offer acceptance
* Certificate issuance
* Clock-in submission

Repeated requests must not create duplicate records or inconsistent states.

---

## Rule 5: Ownership Must Be Explicitly Checked

Every protected resource must validate:

* Who owns the resource
* Whether the actor has access to it

IDs alone are not sufficient.

---

## Rule 6: Soft Deletion Only

Data must not be physically deleted unless legally required.

Instead:

* Records are marked inactive
* Historical references remain valid
* Audit trails are preserved

---

## Rule 7: Audit Logging Is Mandatory

The following actions **must always be logged**:

* Admin overrides
* State transitions
* Evaluations
* Certificate issuance and revocation
* Permission-sensitive updates

Audit logs must capture:

* Actor
* Action
* Target
* Timestamp
* Reason (if applicable)

---

## Rule 8: Consistent Error Semantics

The same error condition must:

* Return the same error code
* Return the same error structure
* Be predictable by frontend logic

No “custom one-off errors” are allowed.

---

## Rule 9: Read vs Action Separation

Endpoints must be clearly separated into:

* **Read operations** (GET)
* **Action operations** (POST / PATCH)

GET endpoints must never:

* Trigger state changes
* Cause side effects
* Write logs beyond access logs

---

## Rule 10: Version Boundaries Are Sacred

Breaking changes must:

* Introduce a new API version
* Preserve old behavior during deprecation
* Be clearly documented

Silent breaking changes are forbidden.

---

## Rule 11: Security Over Convenience

When in doubt:

* Reject the request
* Require explicit confirmation
* Escalate to admin workflows

Security, correctness, and auditability always beat UX shortcuts.

---

## Rule 12: Documentation Is Law

If a behavior is:

* Not written
* Not agreed
* Not reviewed

Then it **does not exist**, even if implemented in code.

---

## Rule 13: Protect backend errors leakage

If an unexpected error happens from the backend:

* The frontend must not see the exact message
* The backend either defines a custom error message or the frontend gets **message**:```server error```

## Relationship to Canon

This document completes the canon and must be read together with:

* `01-canon / 00-canonical-decisions.md`
* `01-canon / 01-roles-and-permissions.md`
* `01-canon / 02-state-machines.md`
