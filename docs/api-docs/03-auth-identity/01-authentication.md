## Authentication

This document defines **how users authenticate**, how tokens are issued, and how access to protected APIs is established in the Virtual Internship Platform.

Authentication answers **“Are you who you claim to be?”**
Authorization (what you can do) is handled separately.

All authentication logic is **centralized** in this domain.

---

## Authentication Principles

Authentication must follow these principles:

* Token-based and stateless
* Backend-enforced
* Role-aware but role-derived (not role-chosen)
* Secure by default
* Explicitly documented

No other domain may implement its own authentication logic.

---

## Supported Authentication Methods

### Primary Method: Credential-Based Authentication

Users authenticate using:

* Email + password (or equivalent credentials)

Future methods (e.g. SSO, OAuth) may be added, but must:

* Follow the same token model
* Not bypass existing security checks

---

## User Registration

### Purpose

Create a new user identity in the system.

### Endpoint

```
POST /api/v1/auth/register
```

### Allowed Roles

* Student
* Employer
  (Admin and Partner accounts are provisioned manually or internally.)

---

### Request Body

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123",
  "role": "STUDENT"
}
```

### Rules

* Email must be unique
* Password must meet security requirements
* Role must be valid and allowed for self-registration
* Role is validated server-side

---

### Success Response

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user_id": "uuid",
    "verification_required": true
  },
  "meta": {}
}
```

---

### Failure Cases

* Email already exists
* Weak password
* Invalid role

---

## Account Verification (Optional / Configurable)

### Purpose

Verify user identity before allowing full access.

Examples:

* Email verification
* Admin approval (employers)

Verification rules are configurable per role.

---

## Login

### Purpose

Authenticate user credentials and issue an access token.

### Endpoint

```
POST /api/v1/auth/login
```

---

### Request Body

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123"
}
```

---

### Success Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "jwt-or-equivalent",
    "expires_in": 3600,
    "role": "STUDENT"
  },
  "meta": {}
}
```

---

### Token Contents (Conceptual)

Access tokens must encode:

* User ID
* Role
* Issued timestamp
* Expiry timestamp

Tokens must be:

* Signed
* Tamper-resistant
* Short-lived

---

### Failure Cases

* Invalid credentials
* Unverified account
* Deactivated account

Error responses must not reveal which field was incorrect.

---

## Logout

### Purpose

Invalidate an active session.

### Endpoint

```
POST /api/v1/auth/logout
```

---

### Rules

* Requires valid authentication
* Token is revoked or blacklisted
* Idempotent (multiple calls safe)

---

### Success Response

```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": {},
  "meta": {}
}
```

---

## Token Refresh (If Supported)

### Purpose

Issue a new access token without re-authentication.

### Endpoint

```
POST /api/v1/auth/refresh
```

---

### Rules

* Requires valid refresh token
* Old access token may remain valid briefly
* Refresh token rotation is recommended

---

## Account Deactivation

### Purpose

Prevent a user from authenticating.

### Triggers

* Admin action
* Policy violation
* User-initiated (optional)

Deactivated accounts:

* Cannot log in
* Cannot refresh tokens
* Retain historical data

---

## Rate Limiting

Authentication endpoints must be rate-limited to prevent abuse:

* Login attempts
* Registration
* Token refresh

Rate limits must be enforced server-side.

---

## Audit Logging

The following must be logged:

* Registration attempts
* Login attempts (success & failure)
* Logout actions
* Token refresh events
* Account deactivation

Logs must never store plaintext passwords.

---

## Relationship to Other Files

This document must be read together with:

* `03-auth-identity / 00-domain-overview.md`
* `03-auth-identity / 02-authorization.md`
* Canon and Conventions sections
