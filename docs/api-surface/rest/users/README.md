# `api-surface/rest/users/README.md`

## Purpose

User profile and identity management endpoints.

These endpoints expose **read/write access to user-owned profile data** after authentication.

**Directly mapped from:**

* `screen-interactions/student/01-profile-setup.md`
* `screen-interactions/employer/01-employer-profile.md`
* `screen-interactions/admin/01-admin-dashboard.md`

---

## Rules

* All endpoints require authentication
* Users may only access **their own profile**
* Admin overrides are handled separately under `api-surface/rest/admin/`
* Profile completeness affects system state but **is not computed here**

---

## Endpoints Index

| Method | Path                  | Purpose                             |
| ------ | --------------------- | ----------------------------------- |
| GET    | `/users/me`           | Fetch own profile                   |
| PATCH  | `/users/me`           | Update own profile                  |
| GET    | `/users/me/status`    | Profile completion & readiness      |
| POST   | `/users/me/documents` | Upload identity / verification docs |

---

# `api-surface/rest/users/get-me.md`

## GET `/users/me`

### Description

Returns the authenticated user’s full profile.

### Headers

```
Authorization: Bearer <token>
```

### Success Response — `200 OK`

```json
{
  "id": "uuid",
  "role": "student",
  "email": "user@example.com",
  "profile": {
    "firstName": "string",
    "lastName": "string",
    "phone": "string",
    "location": "string",
    "skills": ["string"],
    "interests": ["string"]
  },
  "createdAt": "iso-date"
}
```

### Failure

* `401` → AUTH_005

---

# `api-surface/rest/users/update-me.md`

## PATCH `/users/me`

### Description

Updates mutable profile fields for the authenticated user.

### Request Body

```json
{
  "profile": {
    "phone": "string",
    "location": "string",
    "skills": ["string"],
    "interests": ["string"]
  }
}
```

### Success Response — `200 OK`

```json
{
  "updated": true
}
```

### Failure

* `400` → validation error
* `401` → unauthorized

---

# `api-surface/rest/users/status.md`

## GET `/users/me/status`

### Description

Returns profile readiness and system eligibility flags.

Used by frontend to gate preparation, applications, and onboarding.

### Success Response — `200 OK`

```json
{
  "profileComplete": true,
  "eligibleForPreparation": true,
  "eligibleForApplications": false,
  "blockingReasons": [
    "missing_documents"
  ]
}
```

> ⚠️ This endpoint **does not compute logic** — it only exposes backend-evaluated state.

---

# `api-surface/rest/users/documents.md`

## POST `/users/me/documents`

### Description

Uploads verification or onboarding documents.

### Request (multipart/form-data)

* `type`: `"identity" | "resume" | "contract"`
* `file`: binary

### Success Response — `201 Created`

```json
{
  "documentId": "uuid",
  "status": "pending_review"
}
```

---

## ✅ USERS MODULE STATUS

Complete and locked.

---
