# `api-surface/graphql/mutations.md`

## Purpose

This document defines all **GraphQL mutation operations** supported by the platform.

Mutations exist to:

* Provide a GraphQL façade over REST write operations
* Support clients that standardize on GraphQL
* Preserve REST as the source of truth

Every mutation maps **1:1** to an existing REST endpoint.
No mutation may introduce new state transitions or side effects.

---

## Source Mapping (Authoritative)

Mutations in this file are backed directly by:

* `api-surface/rest/auth/`
* `api-surface/rest/applications/`
* `api-surface/rest/execution/`

Resolvers must **delegate**, not compute.

---

## Global Mutation Rules

1. Mutations must be **explicit**
2. Authorization mirrors REST permissions
3. Each mutation maps to exactly one REST write
4. Partial success is not allowed
5. Errors must be surfaced verbatim from REST
6. Idempotency behavior mirrors REST

---

## Input Types

```graphql
input LoginInput {
  email: String!
  password: String!
}

input ApplicationInput {
  internshipId: UUID!
  coverNote: String
}

input TaskSubmissionInput {
  taskId: UUID!
  note: String
}
```

---

## Payload Types

```graphql
type AuthPayload {
  token: String!
  user: User!
}
```

---

## Mutations

### `login`

Authenticates a user and returns a session token.

**Maps to:**

* `POST /auth/login`

```graphql
mutation Login($input: LoginInput!) {
  login(email: $input.email, password: $input.password) {
    token
    user {
      id
      role
    }
  }
}
```

---

### `applyToInternship`

Submits an application for an internship.

**Maps to:**

* `POST /applications`

```graphql
mutation ApplyToInternship($input: ApplicationInput!) {
  applyToInternship(
    internshipId: $input.internshipId
    coverNote: $input.coverNote
  ) {
    id
    status
  }
}
```

---

### `submitTask`

Submits a completed internship task.

**Maps to:**

* `POST /execution/tasks/{id}/submit`

```graphql
mutation SubmitTask($input: TaskSubmissionInput!) {
  submitTask(
    taskId: $input.taskId
    note: $input.note
  )
}
```

---

## Error Handling

* REST error codes are forwarded without translation
* GraphQL `errors[].extensions.code` must match:

  ```
  api-surface/99-appendix/error-codes.md
  ```
* No mutation swallows REST failures

---

## Non-Goals (Explicit)

This file does **not** define:

* Authentication refresh
* Batch mutations
* Subscriptions
* Transaction orchestration

---

