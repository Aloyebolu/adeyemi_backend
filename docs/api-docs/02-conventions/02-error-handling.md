## Error Handling

This document defines **how errors are classified, structured, and handled** across the Virtual Internship Platform.

Errors are part of the API contract.
They must be **predictable, stable, and actionable**.

No endpoint may invent its own error style.

---

## Error Categories

All errors fall into **one of four categories**:

1. Authentication Errors
2. Authorization Errors
3. Validation Errors
4. Business Rule Errors

Each category has clear semantics and usage rules.

---

## 1️⃣ Authentication Errors (401)

### When to Use

* Missing access token
* Expired token
* Invalid token signature

### Response Rules

* HTTP status: `401 Unauthorized`
* Do not leak internal auth details
* Message must prompt re-authentication

### Example

```json
{
  "success": false,
  "message": "Authentication required",
  "errors": [
    {
      "field": "authorization",
      "issue": "token_missing_or_invalid"
    }
  ],
  "meta": {}
}
```

---

## 2️⃣ Authorization Errors (403)

### When to Use

* User is authenticated but lacks permission
* Role mismatch
* Ownership violation

### Response Rules

* HTTP status: `403 Forbidden`
* Do not reveal existence of restricted resources

### Example

```json
{
  "success": false,
  "message": "Access denied",
  "errors": [
    {
      "field": "role",
      "issue": "insufficient_permissions"
    }
  ],
  "meta": {}
}
```

---

## 3️⃣ Validation Errors (400)

### When to Use

* Invalid request payload
* Missing required fields
* Incorrect data formats

### Response Rules

* HTTP status: `400 Bad Request`
* Return **all** validation issues, not just the first

### Example

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "issue": "invalid_format"
    },
    {
      "field": "start_date",
      "issue": "required"
    }
  ],
  "meta": {}
}
```

---

## 4️⃣ Business Rule Errors (422)

### When to Use

* Canonical rule violations
* Invalid state transitions
* Hard-gate failures
* Workflow constraints

### Response Rules

* HTTP status: `422 Unprocessable Entity`
* Must clearly explain **why** the action is blocked

### Example

```json
{
  "success": false,
  "message": "Cannot apply for internship",
  "errors": [
    {
      "field": "preparation",
      "issue": "resume_drill_incomplete"
    }
  ],
  "meta": {}
}
```

---

## State Conflict Errors (409)

### When to Use

* Concurrent updates
* Duplicate submissions
* Idempotency conflicts

### Example

```json
{
  "success": false,
  "message": "Action already performed",
  "errors": [
    {
      "field": "action",
      "issue": "duplicate_request"
    }
  ],
  "meta": {}
}
```

---

## Error Code Stability

* `issue` codes are **API contracts**
* Once introduced, they must not change meaning
* New codes may be added, old ones deprecated only with versioning

Frontend logic must rely on `issue`, not `message`.

---

## Error Message Guidelines

* Messages must be human-readable
* No stack traces
* No internal system details
* Clear enough for UI display

---

## Multiple Errors Rule

* Validation errors may return multiple issues
* Business rule errors usually return one primary blocker
* Mixed error categories in one response are forbidden

---

## Logging & Monitoring

All errors must be:

* Logged server-side
* Traceable via `request_id`
* Monitorable for trends and abuse detection

---

## Relationship to Canon

This document enforces:

* Canon 1 (Authority hierarchy)
* Canon 2 (Workflow enforcement)
* Canon 9 (Backend enforcement)
* Canon 10 (Auditability)
