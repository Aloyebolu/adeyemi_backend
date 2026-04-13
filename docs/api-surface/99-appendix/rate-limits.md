# `api-surface/99-appendix/rate-limits.md`

## Purpose

This document defines **rate limiting policies** applied across the API surface.

Rate limits exist to:

* Protect system stability
* Prevent abuse and accidental overload
* Ensure fair usage across tenants and roles

Rate limiting is **orthogonal to authorization** and **does not encode business rules**.

---

## Global Principles

1. Rate limits are enforced **server-side**
2. Limits apply per **authenticated identity** unless stated otherwise
3. Exceeding a limit returns a deterministic error code
4. Limits are consistent across REST and GraphQL
5. WebSocket connections are rate-limited on **events**, not messages

---

## Error Signaling

When a rate limit is exceeded:

* **HTTP Status:** `429 Too Many Requests`
* **Error Code:** `SYS_001`
* **Message:** Human-readable, non-contractual

Example (REST):

```json
{
  "code": "SYS_001",
  "message": "Rate limit exceeded"
}
```

GraphQL must surface the same code via `errors[].extensions.code`.

---

## Rate Limit Dimensions

Rate limits may be applied on one or more of the following axes:

* User ID
* Role (student / employer / admin)
* IP address (fallback only)
* Endpoint category
* Time window

The **most restrictive applicable limit wins**.

---

## REST API Limits

### Authentication Endpoints

| Endpoint              | Limit               |
| --------------------- | ------------------- |
| `POST /auth/login`    | 5 requests / minute |
| `POST /auth/register` | 3 requests / minute |

**Rationale:**
Mitigate brute-force and abuse.

---

### General Authenticated Endpoints

| Scope    | Limit                 |
| -------- | --------------------- |
| Per user | 120 requests / minute |

Applies to:

* `/users/*`
* `/preparation/*`
* `/internships/*`
* `/applications/*`
* `/execution/*`
* `/kpis/*`
* `/certificates/*`

---

### File Upload Endpoints

| Endpoint                 | Limit             |
| ------------------------ | ----------------- |
| Resume / document upload | 10 uploads / hour |

**Rationale:**
Protect storage and scanning pipelines.

---

## GraphQL Limits

GraphQL requests are limited by **request complexity**, not raw count.

### Baseline

* **Max queries:** 60 / minute / user
* **Max mutations:** 30 / minute / user

### Complexity Rules

* Each field has a cost
* Nested lists multiply cost
* Requests exceeding max cost are rejected

Exact cost calculation is implementation-defined.

---

## WebSocket Limits

### Connection Limits

| Scope                  | Limit      |
| ---------------------- | ---------- |
| Concurrent connections | 3 per user |

---

### Event Delivery Limits

| Scope           | Limit               |
| --------------- | ------------------- |
| Outbound events | 100 / minute / user |

If exceeded:

* Events may be coalesced
* Low-priority notifications may be dropped

No retry is guaranteed.

---

## Administrative Overrides

Admins may:

* Temporarily raise limits
* Disable rate limiting for internal tooling
* Trigger manual throttling

These actions are **audited**.

---

## Client Expectations

Clients should:

* Respect `429` responses
* Implement exponential backoff
* Avoid retry storms
* Treat rate limits as normal operating conditions

Clients must **not** attempt to infer internal thresholds.

---

## Non-Goals (Explicit)

This file does **not** define:

* Header formats (`Retry-After`, etc.)
* Distributed rate-limit coordination
* Abuse detection heuristics
* Billing or quota enforcement

Those belong to infrastructure and ops.

---