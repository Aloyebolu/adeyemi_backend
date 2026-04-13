## API Standards

This document defines the **mandatory technical standards** for all APIs in the Virtual Internship Platform.

These standards exist to ensure:

* Consistency across domains
* Predictability for frontend developers
* Safety for backend developers
* Long-term maintainability

No endpoint may violate these standards.

---

## Base URL & Versioning

### Base Path

All API endpoints must be prefixed with:

```
/api/v1
```

### Versioning Rules

* Breaking changes require a **new version** (`/api/v2`)
* Non-breaking additions are allowed within the same version
* Old versions must remain supported during deprecation periods

Versioning applies to **behavior**, not just structure.

---

## Resource Naming Conventions

### General Rules

* Use **plural nouns**
* Use **kebab-case**
* Be descriptive, not clever

✅ Good:

```
/students
/internships
/internship-applications
```

❌ Bad:

```
/studentData
/getInternship
/applyNow
```

---

## URL Structure Rules

### Resource-Based URLs

Endpoints must represent **resources**, not actions.

Examples:

```
GET    /internships
GET    /internships/{internshipId}
POST   /internship-applications
```

---

### Action Endpoints (Controlled)

Actions are allowed **only** when state changes are involved and must be explicit.

Format:

```
POST /{resource}/{id}/actions/{action-name}
```

Examples:

```
POST /applications/{id}/actions/accept
POST /internships/{id}/actions/close
POST /certificates/{id}/actions/revoke
```

Actions must:

* Be documented
* Validate state
* Be auditable

---

## HTTP Method Usage

| Method | Meaning                    |
| ------ | -------------------------- |
| GET    | Read-only, no side effects |
| POST   | Create or trigger actions  |
| PUT    | Full replacement (rare)    |
| PATCH  | Partial updates            |
| DELETE | Soft delete only           |

GET requests **must never** change state.

---

## Request Body Standards

### JSON Only

* All requests must use JSON
* `Content-Type: application/json` is mandatory

---

### Field Naming

* Use `snake_case`
* Be explicit
* Avoid abbreviations unless industry-standard

Example:

```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "start_date": "2026-02-01"
}
```

---

## Date & Time Standards

* Use **ISO 8601**
* Always UTC

Example:

```
2026-01-29T14:30:00Z
```

No local time assumptions are allowed.

---

## Authentication Standard

* All protected endpoints require authentication
* Authentication is token-based
* Tokens must include:

  * User ID
  * Role
  * Expiry
  * Scope (if applicable)

Unauthenticated requests must return `401 Unauthorized`.

---

## Authorization Standard

* Role is derived from token
* Ownership checks are mandatory
* Unauthorized access returns `403 Forbidden`

No endpoint may rely on frontend checks.

---

## Pagination Standard

Used for all list endpoints.

### Query Parameters

```
?page=1
&limit=20
```

### Response Meta

```json
"meta": {
  "page": 1,
  "limit": 20,
  "total": 120
}
```

---

## Sorting & Filtering

### Sorting

```
?sort=created_at:desc
```

### Filtering

```
?filter[status]=ACTIVE
```

Filters must be documented per endpoint.

---

## Nullability Rules

* Missing data must be `null`
* Fields must not disappear conditionally
* Optional fields must still be present

This prevents frontend crashes and guesswork.

---

## Relationship to Canon

This document enforces:

* Canon 9 (Backend enforcement)
* Canon 10 (Auditability)
* Canon 12 (Documentation is law)
