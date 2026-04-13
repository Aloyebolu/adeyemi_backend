# `api-surface/caching/read-models.md`

## Purpose

This document defines the **read models** used by the platform to optimize data access and screen rendering.

Read models exist to:

* Serve frequently accessed, aggregated data efficiently
* Support fast UI rendering without complex joins
* Reduce load on transactional stores

Read models **do not introduce new data**.
They are **derived projections** of authoritative REST-backed state.

---

## Source Mapping (Authoritative)

All read models defined here are derived exclusively from:

* `api-surface/rest/users/`
* `api-surface/rest/preparation/`
* `api-surface/rest/internships/`
* `api-surface/rest/applications/`
* `api-surface/rest/execution/`
* `api-surface/rest/kpis/`
* `api-surface/rest/certificates/`

If data is not available via REST, it **must not** appear in a read model.

---

## Global Read Model Rules

1. Read models are **read-only**
2. They are eventually consistent
3. They may denormalize data
4. They are invalidated via events or writes
5. They never accept client writes
6. REST remains the source of truth

---

## Defined Read Models

### `StudentDashboardReadModel`

#### Purpose

Supports fast rendering of the student dashboard.

#### Derived From

* `/users/me`
* `/preparation/overview`
* `/execution/dashboard`
* `/kpis/me`

#### Shape

```json
{
  "studentId": "uuid",
  "profileComplete": true,
  "preparation": {
    "resumeStatus": "completed",
    "interviewStatus": "in_progress"
  },
  "internship": {
    "active": true,
    "title": "Backend Intern",
    "daysRemaining": 32
  },
  "kpis": {
    "overallScore": 78
  }
}
```

---

### `EmployerInternshipOverviewReadModel`

#### Purpose

Supports employer views of internships and applicants.

#### Derived From

* `/internships/{id}`
* `/applications/internship/{internshipId}`
* `/kpis/internship/{internshipId}`

#### Shape

```json
{
  "internshipId": "uuid",
  "title": "Frontend Intern",
  "applicants": {
    "total": 42,
    "shortlisted": 6
  },
  "averageKpiScore": 81
}
```

---

### `AdminReportingReadModel`

#### Purpose

Supports admin dashboards and reports.

#### Derived From

* `/execution/clock-in`
* `/kpis/`
* `/certificates/`

#### Shape

```json
{
  "activeInternships": 120,
  "attendanceRate": 93,
  "certificatesIssued": 87
}
```

---

## Update Strategy

Read models are updated via:

* REST write completion hooks
* Internal domain events
* Scheduled reconciliation jobs (fallback only)

Clients are **not aware** of read model boundaries.

---

## Non-Goals (Explicit)

This file does **not** define:

* Cache storage technology
* TTL values
* Invalidation mechanics
* Query routing

Those are defined elsewhere.

---