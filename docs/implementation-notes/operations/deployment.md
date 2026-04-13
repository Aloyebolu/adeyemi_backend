# `implementation-notes/operations/deployment.md`

## Purpose

This document provides **guidance on deploying** the Virtual Internship Platform safely and predictably.

Deployment strategy exists to:

* Minimize downtime
* Reduce deployment risk
* Support incremental rollout
* Enable fast rollback when needed

This document is **advisory** and does not prescribe infrastructure tooling.

---

## Core Principle

> **Deploy often, deploy small, and make rollback boring.**

A good deployment strategy prioritizes **recoverability** over perfection.

---

## Deployment Units

### Service-Level Deployments

Each backend service should be:

* Built
* Deployed
* Scaled
* Rolled back

**independently**.

Avoid monolithic release cycles across services.

---

### Frontend Deployments

Frontend applications should:

* Be deployable independently of backend
* Tolerate backend version skew
* Gracefully handle missing or new fields

Backward compatibility is critical.

---

## Versioning Strategy

### Backend APIs

* Prefer backward-compatible changes
* Additive changes only (new fields, new endpoints)
* Avoid breaking schema changes
* Deprecate before removal

API contracts in `api-surface/` must remain stable.

---

### Frontend Compatibility

Frontend should:

* Assume optional fields
* Handle unknown enum values safely
* Fail gracefully when data is unavailable

Never rely on deployment order.

---

## Rollout Strategies

### Recommended Approaches

* **Rolling deployments** for stateless services
* **Blue–green** for high-risk changes
* **Canary releases** for critical paths (auth, applications)

Choose strategy based on risk profile.

---

## Database & Schema Changes

Guidelines:

* Apply schema changes before code that depends on them
* Use backward-compatible migrations
* Avoid long-running migrations during peak hours

Schema changes must be reversible where possible.

---

## Feature Flags

Feature flags are recommended for:

* Gradual feature rollout
* Testing in production
* Emergency disablement

Flags should be:

* Server-controlled
* Short-lived
* Cleaned up regularly

---

## Configuration Management

* Separate config from code
* Use environment-specific configuration
* Never hardcode secrets
* Rotate credentials regularly

Configuration changes should not require redeploys where possible.

---

## Failure & Rollback Strategy

A deployment must always have:

* A clear rollback path
* Known blast radius
* Observable success criteria

If rollback is complex, the deployment is too risky.

---

## Deployment Verification

After deployment:

* Run health checks
* Verify critical user flows
* Monitor error rates and latency
* Watch realtime systems closely

Deployments are not complete until verified.

---

## Non-Goals (Explicit)

This document does **not** define:

* CI/CD pipelines
* Container orchestration
* Cloud providers
* Infrastructure-as-code tools

Those choices belong to the ops team.

---
