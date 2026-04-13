# `api-surface/rest/applications/README.md`

## Purpose

Internship application submission and employer-side review.

These endpoints cover:

* Student applications
* Employer shortlisting & decisions
* Application state transitions

**Mapped directly from:**

* `screen-interactions/student/06-application-flow.md`
* `screen-interactions/employer/03-applicant-review.md`

---

## Rules

* Students may only apply once per internship
* Employers may only access applications for internships they own
* Application state transitions are **strict**
* No interview scheduling here (see execution / interviews)

---

## Application States

```
draft → submitted → shortlisted → rejected → accepted
```

No other transitions are valid.

---

## Endpoints Index

| Method | Path                                      | Purpose                     |
| ------ | ----------------------------------------- | --------------------------- |
| POST   | `/applications`                           | Submit application          |
| GET    | `/applications/me`                        | Student application list    |
| GET    | `/applications/{id}`                      | Application detail          |
| GET    | `/applications/internship/{internshipId}` | Employer view of applicants |
| POST   | `/applications/{id}/shortlist`            | Shortlist candidate         |
| POST   | `/applications/{id}/reject`               | Reject application          |
| POST   | `/applications/{id}/accept`               | Accept candidate            |

---

# `api-surface/rest/applications/create.md`

## POST `/applications`

### Description

Submits a student application for an internship.

### Request Body

```json
{
  "internshipId": "uuid",
  "coverNote": "string"
}
```

### Success Response — `201 Created`

```json
{
  "applicationId": "uuid",
  "status": "submitted"
}
```

### Failure

* `409` → already applied
* `403` → not eligible to apply

---

# `api-surface/rest/applications/my-applications.md`

## GET `/applications/me`

### Description

Returns applications submitted by the authenticated student.

### Success Response

```json
{
  "items": [
    {
      "id": "uuid",
      "internshipTitle": "Frontend Intern",
      "status": "shortlisted",
      "appliedAt": "iso-date"
    }
  ]
}
```

---

# `api-surface/rest/applications/detail.md`

## GET `/applications/{id}`

### Description

Returns full application detail.

### Success Response

```json
{
  "id": "uuid",
  "status": "submitted",
  "student": {
    "id": "uuid",
    "name": "string"
  },
  "coverNote": "string"
}
```

---

# `api-surface/rest/applications/by-internship.md`

## GET `/applications/internship/{internshipId}`

### Description

Returns all applications for a specific internship (employer-only).

### Success Response

```json
{
  "items": [
    {
      "id": "uuid",
      "studentName": "string",
      "status": "submitted",
      "aiRank": 1
    }
  ]
}
```

---

# `api-surface/rest/applications/shortlist.md`

## POST `/applications/{id}/shortlist`

### Description

Marks an application as shortlisted.

### Success Response

```json
{
  "status": "shortlisted"
}
```

---

# `api-surface/rest/applications/reject.md`

## POST `/applications/{id}/reject`

### Description

Rejects an application.

### Success Response

```json
{
  "status": "rejected"
}
```

---

# `api-surface/rest/applications/accept.md`

## POST `/applications/{id}/accept`

### Description

Accepts an application and triggers onboarding eligibility.

### Success Response

```json
{
  "status": "accepted"
}
```

---

## ✅ APPLICATIONS MODULE STATUS

Complete. Locked.

---
