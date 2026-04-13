## Pagination, Filtering, and Sorting

This document defines the **standard mechanisms** for paginating, filtering, and sorting list-based API responses.

These rules ensure:

* Predictable frontend behavior
* Efficient backend queries
* Consistent UX across screens

All list endpoints **must** follow these conventions.

---

## Pagination (Mandatory for Lists)

### Query Parameters

```http
?page=1
&limit=20
```

| Parameter | Description                |
| --------- | -------------------------- |
| page      | 1-based page index         |
| limit     | Number of records per page |

Default values:

* `page = 1`
* `limit = 20`
* Maximum `limit = 100`

---

### Pagination Response Meta

```json
"meta": {
  "page": 1,
  "limit": 20,
  "total": 145
}
```

| Field | Description            |
| ----- | ---------------------- |
| page  | Current page           |
| limit | Page size              |
| total | Total matching records |

The `total` count is required.

---

## Filtering

### Filtering Syntax

```http
?filter[status]=ACTIVE
```

Multiple filters are allowed:

```http
?filter[status]=ACTIVE&filter[type]=REMOTE
```

---

### Filtering Rules

* Only documented filters are allowed
* Unknown filters must be ignored or rejected (per endpoint decision)
* Filters must not change API behavior beyond data scope

Examples of filterable fields:

* status
* date ranges
* role
* internship type

Each endpoint must explicitly document its supported filters.

---

## Sorting

### Sorting Syntax

```http
?sort=created_at:desc
```

Multiple sort fields are allowed (priority order):

```http
?sort=status:asc,created_at:desc
```

---

### Sorting Rules

* Default sorting must be documented
* Unsupported sort fields must be rejected
* Sorting must be stable and deterministic

---

## Search (Optional)

Where full-text search is supported:

```http
?search=frontend
```

Rules:

* Search behavior must be documented
* Search must not override filters
* Search is case-insensitive unless specified

---

## Empty Result Sets

If no records match:

* Return HTTP `200`
* Return empty array in `data`
* Still include pagination meta

Example:

```json
{
  "success": true,
  "message": "No records found",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0
  }
}
```

---

## Performance Considerations

* Pagination is mandatory to prevent overload
* Unbounded list endpoints are forbidden
* Expensive filters may be rate-limited

---

## Relationship to Other Conventions

This document complements:

* `02-conventions / 00-api-standards.md`
* `02-conventions / 01-response-formats.md`
