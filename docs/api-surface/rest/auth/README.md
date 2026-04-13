# `api-surface/rest/auth/README.md`

## Purpose

Authentication and identity endpoints used by all roles (student, employer, admin).
These endpoints support login, registration, session validation, and logout.

**Source of truth:**
Mapped from:

* `screen-interactions/student/01-profile-setup.md`
* `screen-interactions/employer/01-employer-profile.md`
* `screen-interactions/admin/01-admin-dashboard.md`

---

## Common Rules

* All endpoints return JSON
* All authenticated endpoints require `Authorization: Bearer <token>`
* Tokens are opaque (implementation not exposed)
* Refresh strategy is server-defined (see appendix)

---

## Error Codes (Auth-Specific)

| Code     | Meaning              |
| -------- | -------------------- |
| AUTH_001 | Invalid credentials  |
| AUTH_002 | Account not verified |
| AUTH_003 | Account suspended    |
| AUTH_004 | Token expired        |
| AUTH_005 | Unauthorized         |

(Full list in `api-surface/99-appendix/error-codes.md`)

---

## Endpoints Index

| Method | Path             | Purpose           |
| ------ | ---------------- | ----------------- |
| POST   | `/auth/register` | Create account    |
| POST   | `/auth/login`    | Authenticate user |
| POST   | `/auth/logout`   | End session       |
| GET    | `/auth/session`  | Validate session  |

---

# `api-surface/rest/auth/register.md`

## POST `/auth/register`

### Description

Creates a new user account and initializes role-based identity.

### Request Body

```json
{
  "email": "user@example.com",
  "password": "string",
  "role": "student | employer",
  "profile": {
    "firstName": "string",
    "lastName": "string"
  }
}
```

### Success Response — `201 Created`

```json
{
  "userId": "uuid",
  "role": "student",
  "status": "pending_verification"
}
```

### Failure Responses

* `400` → validation errors
* `409` → email already exists

---

# `api-surface/rest/auth/login.md`

## POST `/auth/login`

### Description

Authenticates user credentials and issues a session token.

### Request Body

```json
{
  "email": "user@example.com",
  "password": "string"
}
```

### Success Response — `200 OK`

```json
{
  "token": "jwt-or-opaque-token",
  "user": {
    "id": "uuid",
    "role": "student",
    "status": "active"
  }
}
```

### Failure Responses

* `401` → AUTH_001
* `403` → AUTH_002 / AUTH_003

---

# `api-surface/rest/auth/session.md`

## GET `/auth/session`

### Description

Validates the current session and returns user identity.

### Headers

```
Authorization: Bearer <token>
```

### Success Response — `200 OK`

```json
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "role": "student",
    "status": "active"
  }
}
```

### Failure

* `401` → AUTH_004 / AUTH_005

---

# `api-surface/rest/auth/logout.md`

## POST `/auth/logout`

### Description

Invalidates the current session token.

### Success Response — `204 No Content`

---

## ✅ AUTH MODULE STATUS

Complete.
No further auth behavior is allowed outside these endpoints.

---