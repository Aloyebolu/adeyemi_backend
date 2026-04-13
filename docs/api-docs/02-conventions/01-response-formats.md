## Response Formats

This document defines the **mandatory response structure** for all API endpoints in the Virtual Internship Platform.

Consistency here is **non-negotiable**.
Frontend stability and backend safety depend on this.

Every endpoint must follow the formats below exactly.

---

## Standard Response Envelope

All API responses (success or failure) must be wrapped in a **standard envelope**.

No endpoint may return raw data.

---

## ✅ Success Response Format

```json
{
  "success": true,
  "message": "Action completed successfully",
  "data": {},
  "meta": {
    "timestamp": "2026-01-29T15:00:00Z",
    "request_id": "uuid"
  }
}
```

### Field Definitions

| Field           | Description                           |
| --------------- | ------------------------------------- |
| success         | Always `true` for successful requests |
| message         | Human-readable summary                |
| data            | Payload specific to the endpoint      |
| meta.timestamp  | Server timestamp (UTC)                |
| meta.request_id | Unique request identifier             |

---

## ❌ Error Response Format

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "issue": "invalid_format"
    }
  ],
  "meta": {
    "timestamp": "2026-01-29T15:00:00Z",
    "request_id": "uuid"
  }
}
```

### Error Object Rules

Each error must include:

| Field | Description                       |
| ----- | --------------------------------- |
| field | Field or domain causing the error |
| issue | Machine-readable error code       |

Multiple errors may be returned at once.

---

## HTTP Status Code Usage

| Status | Usage                   |
| ------ | ----------------------- |
| 200    | Successful GET          |
| 201    | Successful creation     |
| 400    | Validation error        |
| 401    | Unauthenticated         |
| 403    | Unauthorized            |
| 404    | Resource not found      |
| 409    | State conflict          |
| 422    | Business rule violation |
| 500    | Server error            |

Status codes must match **actual failure type**, not convenience.

---

## Business Rule Violations (422)

Used when:

* State transition is invalid
* Canonical rule is violated
* Preconditions are not met

Example:

```json
{
  "success": false,
  "message": "Preparation not completed",
  "errors": [
    {
      "field": "preparation",
      "issue": "hard_gate_not_passed"
    }
  ]
}
```

---

## Empty Data Responses

If no data exists:

* `data` must be an empty object `{}` or empty array `[]`
* Never omit the `data` field

Example:

```json
{
  "success": true,
  "message": "No internships found",
  "data": [],
  "meta": {}
}
```

---

## Partial Success Is Forbidden

Responses must be **binary**:

* Fully successful
* Fully failed

There is no “partial success” response.

---

## Localization & Messages

* `message` is for humans
* `issue` codes are for frontend logic
* Messages may be localized in the future
* Issue codes must remain stable

---

## Meta Object Rules

The `meta` object:

* Must always exist
* Must not contain business data
* May be extended safely in future versions

---

## Relationship to Other Conventions

This document must be read alongside:

* `02-conventions / 00-api-standards.md`
* `02-conventions / 02-error-handling.md`
