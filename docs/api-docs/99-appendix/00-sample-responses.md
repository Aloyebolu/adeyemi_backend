## 1. Purpose

This appendix provides **canonical sample API responses** used across the platform.

These samples exist to:

* Standardize frontend expectations
* Reduce ambiguity during implementation
* Serve as reference templates for all domains

They do **not** introduce new behavior.
They **illustrate already-defined rules**.

---

## 2. Standard Success Response Envelope

All successful API responses follow this structure:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_8821",
    "timestamp": "2026-01-20T10:00:00Z"
  }
}
```

Rules:

* `data` contains the actual payload
* `meta` is always present
* Empty responses still return `data: {}`

---

## 3. Standard Error Response Envelope

All error responses follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation"
  },
  "meta": {
    "requestId": "req_8821",
    "timestamp": "2026-01-20T10:00:00Z"
  }
}
```

Rules:

* No stack traces
* No internal error details
* Error codes are stable and documented

---

## 4. Authentication Error Examples

### 4.1 Unauthorized

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication is required"
  }
}
```

---

### 4.2 Forbidden

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action"
  }
}
```

---

## 5. Validation Error Example

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input provided",
    "fields": {
      "email": "Invalid email format",
      "startDate": "Start date must be in the future"
    }
  }
}
```

Field-level errors are optional but recommended.

---

## 6. Gating Error Example

```json
{
  "error": {
    "code": "PREPARATION_INCOMPLETE",
    "message": "Complete required preparation steps to continue"
  }
}
```

Used across:

* Discovery
* Applications
* Execution entry points

---

## 7. Pagination Response Example

```json
{
  "data": [
    { "id": "item_1" },
    { "id": "item_2" }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 134
  }
}
```

Pagination shape must follow conventions in `02-conventions`.

---

## 8. Empty State Example

```json
{
  "data": [],
  "meta": {
    "message": "No results found"
  }
}
```

Empty states are **not errors**.

---

## 9. Idempotent Action Response Example

```json
{
  "data": {
    "status": "already_completed"
  },
  "meta": {
    "idempotent": true
  }
}
```

Used for retries and duplicate-safe actions.

---

## 🔒 Lock Statement

These samples are **reference-grade contracts**.
Any deviation must be justified at the Conventions level.
