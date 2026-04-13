# `implementation-notes/operations/security.md`

## Purpose

This document provides **security guidance** for implementing and operating the Virtual Internship Platform.

Security practices described here aim to:

* Protect user data
* Reduce attack surface
* Support compliance and audits
* Minimize blast radius of failures

This document is **advisory** and must not contradict authoritative contracts.

---

## Core Principle

> **Assume breach, limit impact.**

Security is not about preventing every attack, but about:

* Making attacks difficult
* Detecting them early
* Containing damage effectively

---

## Authentication & Identity Security

### Credential Handling

* Never store plaintext passwords
* Use strong, adaptive hashing
* Enforce password policies server-side
* Rate-limit authentication attempts

### Session Management

* Use short-lived access tokens
* Rotate tokens regularly
* Invalidate tokens on logout or suspension
* Protect tokens at rest and in transit

---

## Authorization Practices

* Enforce authorization at the service boundary
* Never rely on frontend checks alone
* Validate role and ownership on every write
* Prefer deny-by-default policies

Authorization rules must align with `api-docs/`.

---

## API Security

### Input Validation

* Validate all incoming data
* Enforce schemas strictly
* Reject unexpected fields
* Avoid implicit coercion

### Output Control

* Never expose internal identifiers unnecessarily
* Avoid leaking implementation details
* Sanitize error messages

---

## WebSocket Security

* Authenticate connections explicitly
* Scope events to authorized users
* Avoid broadcasting sensitive data
* Disconnect on authentication failure

WebSocket events must respect the same permissions as REST.

---

## Data Protection

### In Transit

* Enforce TLS everywhere
* Use secure WebSocket connections
* Reject insecure clients

### At Rest

* Encrypt sensitive data
* Protect backups
* Limit access to storage systems

---

## File Upload Security

* Validate file types
* Enforce size limits
* Scan uploads for malware
* Store files outside execution paths

Uploads must never be executed or rendered directly.

---

## Secrets Management

* Never commit secrets to source control
* Use managed secret stores
* Rotate secrets periodically
* Scope secrets to minimum required access

---

## Auditing & Accountability

Audit the following actions:

* Admin overrides
* Certificate issuance
* Authentication failures
* Permission denials

Audit logs should be immutable and retained according to policy.

---

## Dependency & Supply Chain Security

* Keep dependencies up to date
* Monitor for known vulnerabilities
* Minimize dependency footprint
* Pin versions where appropriate

---

## Incident Response Readiness

* Define escalation paths
* Practice incident drills
* Maintain runbooks
* Ensure logs and metrics are accessible during incidents

Security incidents should be assumed and rehearsed.

---

## Non-Goals (Explicit)

This document does **not** define:

* Compliance frameworks (GDPR, ISO, etc.)
* Penetration testing processes
* Vendor security assessments
* Legal policies

Those belong to governance and legal domains.

---