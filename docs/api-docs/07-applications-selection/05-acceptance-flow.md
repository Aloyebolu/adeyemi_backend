## 1. Purpose

This document defines how **internship offers are issued** by employers after interviews are completed.

An offer represents a **formal intent** to onboard a student and is the **final employer-controlled decision** in the selection process.

---

## 2. Who Can Issue Offers

Only users with role:

* `employer`

Admins, AI services, and students **cannot** issue offers.

---

## 3. Offer Preconditions (Hard Rules)

An offer may be issued only if:

* Application state = `interview_completed`
* Internship is still `open`
* No offer has already been issued for this application
* Student does not already have an active internship

All checks are enforced server-side.

---

## 4. Offer Object (Conceptual)

```json
{
  "offerId": "offer_4419",
  "applicationId": "app_5512",
  "internshipId": "intern_7781",
  "issuedAt": "2026-02-07T11:30:00Z",
  "status": "pending",
  "validUntil": "2026-02-10T23:59:59Z"
}
```

Offers are **time-bound** by default.

---

## 5. Offer Issuance Flow

### 5.1 Issuance Action

When an employer issues an offer:

* Offer record is created
* Application state → `offered`
* Offer status → `pending`
* Student is notified immediately

This action is **explicit and auditable**.

---

## 6. Offer Validity & Expiry

* Offers have a `validUntil` timestamp
* If not accepted by expiry:

  * Offer status → `expired`
  * Application state → `rejected`
* Expiry is enforced automatically by backend jobs

---

## 7. Multiple Offers Constraint

* A student may receive **multiple offers**
* A student may accept **only one**
* Acceptance of one offer auto-invalidates others

No employer is informed of other offers unless required by policy.

---

## 8. Offer Visibility

| Role        | Visibility            |
| ----------- | --------------------- |
| Student     | Own offers            |
| Employer    | Offers issued by them |
| Admin       | Read-only             |
| AI Services | ❌ None                |

Offer contents are not public.

---

## 9. Error Scenarios

### 9.1 Offer Issuance Not Allowed

```json
{
  "error": {
    "code": "OFFER_NOT_ALLOWED",
    "message": "Offer cannot be issued in the current application state"
  }
}
```

---

### 9.2 Active Internship Conflict

```json
{
  "error": {
    "code": "ACTIVE_INTERNSHIP_EXISTS",
    "message": "Student already has an active internship"
  }
}
```

---

## 10. Non-Negotiable Constraints

* Offers cannot be edited after issuance
* Admins cannot create or force offers
* AI cannot recommend offer issuance
* Offers cannot bypass interview completion

---

## 🔒 Lock Statement

Offer issuance is a **final, employer-controlled decision point**.
No downstream domain may fabricate or modify offers.