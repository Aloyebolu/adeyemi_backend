# `api-surface/graphql/queries.md`

## Purpose

This document defines all **GraphQL query operations** supported by the platform.

Queries exist to:

* Aggregate REST-backed read data
* Support complex screen rendering
* Reduce over-fetching for dashboards

Every query here maps **directly** to existing REST read endpoints.
No query may expose data or behavior not already available via REST.

---

## Source Mapping (Authoritative)

Queries in this file correspond to data exposed by:

* `api-surface/rest/users/`
* `api-surface/rest/preparation/`
* `api-surface/rest/internships/`
* `api-surface/rest/applications/`
* `api-surface/rest/execution/`
* `api-surface/rest/kpis/`
* `api-surface/rest/certificates/`

Resolvers must delegate to REST-backed services.

---

## Global Query Rules

1. Queries are **side-effect free**
2. Authorization mirrors REST permissions
3. Pagination must be explicit
4. Nullability reflects REST guarantees
5. No query performs computation or ranking

---

## Queries

### `me`

Returns the authenticated user and profile data.

**Maps to:**

* `GET /users/me`

```graphql
query Me {
  me {
    id
    email
    role
    profile {
      firstName
      lastName
      location
      skills
    }
  }
}
```

---

### `internships`

Returns internships visible to the authenticated user.

**Maps to:**

* `GET /internships`

```graphql
query Internships($page: Int!, $limit: Int!) {
  internships(page: $page, limit: $limit) {
    id
    title
    duration
    status
  }
}
```

---

### `myApplications`

Returns applications submitted by the student.

**Maps to:**

* `GET /applications/me`

```graphql
query MyApplications {
  myApplications {
    id
    status
    internship {
      id
      title
    }
    appliedAt
  }
}
```

---

### `myTasks`

Returns tasks assigned to the authenticated student.

**Maps to:**

* `GET /execution/tasks`

```graphql
query MyTasks {
  myTasks {
    id
    title
    dueDate
    status
  }
}
```

---

### `myKPIs`

Returns KPI progress for the active internship.

**Maps to:**

* `GET /kpis/me`

```graphql
query MyKPIs {
  myKPIs {
    key
    score
  }
}
```

---

### `myCertificates`

Returns certificates issued to the authenticated student.

**Maps to:**

* `GET /certificates/me`

```graphql
query MyCertificates {
  myCertificates {
    id
    internshipTitle
    issuedAt
    verificationCode
  }
}
```

---

## Error Handling

* Errors follow GraphQL standard error format
* Each error must include a `code` matching:

  ```
  api-surface/99-appendix/error-codes.md
  ```
* Partial data is allowed where applicable

---

## Non-Goals (Explicit)

This file does **not** define:

* Mutations
* Subscriptions
* Resolver implementation
* Performance optimizations

---