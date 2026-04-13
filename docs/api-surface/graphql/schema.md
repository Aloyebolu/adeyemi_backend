# `api-surface/graphql/schema.md`

## Purpose

This document defines the **authoritative GraphQL schema** exposed by the platform.

GraphQL exists to:

* Aggregate REST-backed data efficiently
* Support complex screen queries
* Reduce over-fetching in rich dashboards

GraphQL **does not introduce new behavior**.
Every field maps directly to existing REST-backed state.

---

## Source Mapping (Authoritative)

The schema defined here mirrors data already exposed by:

* `api-surface/rest/users/`
* `api-surface/rest/preparation/`
* `api-surface/rest/internships/`
* `api-surface/rest/applications/`
* `api-surface/rest/execution/`
* `api-surface/rest/kpis/`
* `api-surface/rest/certificates/`

If a field does not exist in REST, it **must not** exist here.

---

## Global GraphQL Rules

1. GraphQL is **read-heavy**
2. Mutations map 1:1 to REST actions
3. No business logic lives in resolvers
4. Authorization mirrors REST rules
5. Errors follow unified error codes (see appendix)
6. Pagination is explicit
7. Nullability is intentional

---

## Scalar Types

```graphql
scalar DateTime
scalar Date
scalar UUID
```

---

## Enums

```graphql
enum UserRole {
  STUDENT
  EMPLOYER
  ADMIN
}

enum ApplicationStatus {
  DRAFT
  SUBMITTED
  SHORTLISTED
  REJECTED
  ACCEPTED
}

enum InternshipStatus {
  DRAFT
  PUBLISHED
  ACTIVE
  COMPLETED
}

enum CertificateStatus {
  ISSUED
}
```

---

## Core Types

### `User`

```graphql
type User {
  id: UUID!
  email: String!
  role: UserRole!
  profile: UserProfile!
  createdAt: DateTime!
}
```

### `UserProfile`

```graphql
type UserProfile {
  firstName: String!
  lastName: String!
  phone: String
  location: String
  skills: [String!]!
  interests: [String!]!
}
```

---

### `Internship`

```graphql
type Internship {
  id: UUID!
  title: String!
  description: String!
  duration: String!
  status: InternshipStatus!
  kpis: [String!]!
}
```

---

### `Application`

```graphql
type Application {
  id: UUID!
  status: ApplicationStatus!
  internship: Internship!
  appliedAt: DateTime!
}
```

---

### `Task`

```graphql
type Task {
  id: UUID!
  title: String!
  dueDate: Date
  status: String!
}
```

---

### `KPI`

```graphql
type KPI {
  key: String!
  score: Int!
}
```

---

### `Certificate`

```graphql
type Certificate {
  id: UUID!
  internshipTitle: String!
  issuedAt: DateTime!
  verificationCode: String!
}
```

---

## Root Query Type

```graphql
type Query {
  me: User!

  internships(
    page: Int = 1
    limit: Int = 10
  ): [Internship!]!

  myApplications: [Application!]!

  myTasks: [Task!]!

  myKPIs: [KPI!]!

  myCertificates: [Certificate!]!
}
```

Each query maps to an existing REST read endpoint.
Resolvers must **delegate**, not compute.

---

## Root Mutation Type (Declared Only)

> Full definitions live in `mutations.md`

```graphql
type Mutation {
  login(email: String!, password: String!): AuthPayload!
  applyToInternship(internshipId: UUID!, coverNote: String): Application!
  submitTask(taskId: UUID!, note: String): Boolean!
}
```

---

## Error Handling

* GraphQL errors must include:

  * `code`
  * `message`
* Codes map directly to:

  ```
  api-surface/99-appendix/error-codes.md
  ```

---

## Non-Goals (Explicit)

This schema does **not** define:

* Resolver logic
* Caching strategy
* Authorization internals
* Subscription mechanics

Those are defined elsewhere.

---