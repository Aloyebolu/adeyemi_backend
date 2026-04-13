# `api-surface/99-appendix/error-codes.md`

## Purpose

This document defines the **canonical error codes** used across the entire API surface.

Error codes exist to:

* Provide consistent, machine-readable failures
* Decouple client logic from HTTP status text
* Enable predictable error handling across REST, GraphQL, and WebSocket

This file is the **single source of truth** for error semantics.

---

## Global Rules

1. Every error response **must include a code**
2. Codes are **stable and versioned**
3. Codes are shared across REST and GraphQL
4. HTTP status codes still apply, but are secondary
5. Messages are human-readable, not contractual
6. Clients must branch on `code`, not message

---

## Error Response Shape

### REST

```json
{
  "code": "AUTH_001",
  "message": "Invalid credentials"
}
```
### WebSocket

```json
{
    "code": "AUTH_001",
    "message": "Invalid credentials"
}
```
### GraphQL

```json
{
  "errors": [
    {
      "message": "Invalid credentials",
      "extensions": {
        "code": "AUTH_001"
      }
    }
  ]
}
```

---

## Error Code Categories

| Prefix | Domain                    |
| ------ | ------------------------- |
| AUTH   | Authentication & identity |
| USER   | User profile & access     |
| PREP   | Preparation & drills      |
| INTR   | Internship lifecycle      |
| APP    | Applications              |
| EXEC   | Internship execution      |
| KPI    | Performance & evaluation  |
| CERT   | Certification             |
| SYS    | System & infrastructure   |

---

## Authentication Errors (`AUTH_*`)

| Code     | Meaning              |
| -------- | -------------------- |
| AUTH_001 | Invalid credentials  |
| AUTH_002 | Account not verified |
| AUTH_003 | Account suspended    |
| AUTH_004 | Token expired        |
| AUTH_005 | Unauthorized         |

---

## User Errors (`USER_*`)

| Code     | Meaning                |
| -------- | ---------------------- |
| USER_001 | Profile incomplete     |
| USER_002 | Access denied          |
| USER_003 | Document missing       |
| USER_004 | Invalid profile update |

---

## Preparation Errors (`PREP_*`)

| Code     | Meaning                   |
| -------- | ------------------------- |
| PREP_001 | Resume not submitted      |
| PREP_002 | Interview session invalid |
| PREP_003 | Preparation locked        |

---

## Internship Errors (`INTR_*`)

| Code     | Meaning                  |
| -------- | ------------------------ |
| INTR_001 | Internship not found     |
| INTR_002 | Internship not published |
| INTR_003 | Internship not active    |

---

## Application Errors (`APP_*`)

| Code    | Meaning                   |
| ------- | ------------------------- |
| APP_001 | Already applied           |
| APP_002 | Application not found     |
| APP_003 | Invalid application state |
| APP_004 | Not eligible to apply     |

---

## Execution Errors (`EXEC_*`)

| Code     | Meaning                |
| -------- | ---------------------- |
| EXEC_001 | Internship not active  |
| EXEC_002 | Already clocked in     |
| EXEC_003 | Task submission locked |
| EXEC_004 | Task not found         |

---

## KPI Errors (`KPI_*`)

| Code    | Meaning                      |
| ------- | ---------------------------- |
| KPI_001 | KPI not available            |
| KPI_002 | Evaluation already submitted |

---

## Certificate Errors (`CERT_*`)

| Code     | Meaning                |
| -------- | ---------------------- |
| CERT_001 | Certificate not issued |
| CERT_002 | Certificate not found  |
| CERT_003 | Verification failed    |

---

## System Errors (`SYS_*`)

| Code    | Meaning             |
| ------- | ------------------- |
| SYS_001 | Rate limit exceeded |
| SYS_002 | Service unavailable |
| SYS_003 | Timeout             |
| SYS_004 | Internal error      |

---

## Mapping Rules

* One failure → one code
* Do not overload codes
* New codes require appendix update
* Deprecated codes are never reused

---

## Non-Goals (Explicit)

This file does **not** define:

* HTTP status mappings
* Retry strategies
* Localization
* Logging formats

Those belong to other layers.

---