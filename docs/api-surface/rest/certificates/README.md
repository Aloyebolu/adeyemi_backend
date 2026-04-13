# `api-surface/rest/execution/README.md`

## Purpose

Internship **execution-phase** endpoints used after an application is accepted.

These endpoints power:

* Internship dashboard
* Daily attendance (clock-in)
* Task submission
* Training access

**Mapped directly from:**

* `screen-interactions/student/07-internship-dashboard.md`
* `screen-interactions/employer/04-interviews.md` (post-acceptance only)
* `screen-interactions/admin/04-reports.md` (read-only)

---

## Rules

* Only **accepted** students may access execution endpoints
* Execution data is immutable once submitted (except admin override)
* Attendance is date-bound and idempotent
* Tasks belong to an internship instance, not the listing

---

## Endpoints Index

| Method | Path                           | Purpose              |
| ------ | ------------------------------ | -------------------- |
| GET    | `/execution/dashboard`         | Internship dashboard |
| POST   | `/execution/clock-in`          | Daily clock-in       |
| GET    | `/execution/tasks`             | List assigned tasks  |
| POST   | `/execution/tasks/{id}/submit` | Submit task          |
| GET    | `/execution/training`          | Training modules     |

---

# `api-surface/rest/execution/dashboard.md`

## GET `/execution/dashboard`

### Description

Returns execution overview for the active internship.

### Success Response

```json
{
  "internshipId": "uuid",
  "title": "Backend Intern",
  "progress": 45,
  "kpiCompletion": 40,
  "daysRemaining": 32
}
```

---

# `api-surface/rest/execution/clock-in.md`

## POST `/execution/clock-in`

### Description

Registers daily attendance.

### Request Body

```json
{
  "date": "YYYY-MM-DD"
}
```

### Success Response

```json
{
  "clockedIn": true,
  "timestamp": "iso-date"
}
```

### Failure

* `409` → already clocked in
* `403` → internship not active

---

# `api-surface/rest/execution/tasks.md`

## GET `/execution/tasks`

### Description

Returns tasks assigned to the student.

### Success Response

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Implement API endpoint",
      "dueDate": "iso-date",
      "status": "pending"
    }
  ]
}
```

---

# `api-surface/rest/execution/task-submit.md`

## POST `/execution/tasks/{id}/submit`

### Description

Submits a completed task.

### Request Body

```json
{
  "submissionNote": "string",
  "attachments": ["file-id"]
}
```

### Success Response

```json
{
  "submitted": true,
  "submittedAt": "iso-date"
}
```

---

# `api-surface/rest/execution/training.md`

## GET `/execution/training`

### Description

Returns training modules linked to the internship.

### Success Response

```json
{
  "modules": [
    {
      "id": "uuid",
      "title": "Company Onboarding",
      "completed": false
    }
  ]
}
```

---

## ✅ EXECUTION MODULE STATUS

Complete. Locked.

---