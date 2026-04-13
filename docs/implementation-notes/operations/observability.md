# `implementation-notes/operations/observability.md`

## Purpose

This document provides **guidance on observability** for operating the Virtual Internship Platform in production.

Observability exists to:

* Understand system behavior
* Detect and diagnose failures
* Measure performance and reliability
* Support safe iteration and scaling

This document is **advisory** and does not mandate tooling.

---

## Core Principle

> **If you can’t observe it, you can’t operate it.**

Observability must be designed in, not added later.

---

## Three Pillars of Observability

A healthy system balances **logs**, **metrics**, and **traces**.

---

### 1. Logging

#### Purpose

* Understand *what happened*
* Debug unexpected behavior
* Audit sensitive operations

#### Guidance

* Use structured logs (key–value)
* Include correlation IDs
* Avoid logging sensitive data
* Log at appropriate levels

#### Recommended Log Fields

* `service`
* `requestId`
* `userId` (where applicable)
* `operation`
* `status`
* `errorCode` (if any)
* `durationMs`

---

### 2. Metrics

#### Purpose

* Understand *how the system behaves over time*
* Detect regressions
* Support alerting

#### Key Metric Categories

**Traffic**

* Request rate
* WebSocket connections
* Event delivery rate

**Errors**

* Error rate by code
* Authentication failures
* Rate-limit violations

**Latency**

* Endpoint response times
* P95 / P99 latencies
* Task evaluation time

**Business Signals**

* Applications submitted
* Internships started
* Certificates issued

Metrics should be cheap to collect and easy to aggregate.

---

### 3. Tracing

#### Purpose

* Understand *why* something is slow or broken
* Follow a request across services

#### Guidance

* Use distributed tracing
* Propagate trace IDs across services
* Trace only critical paths if overhead is a concern

Traces are especially valuable for:

* Application submission
* Internship acceptance
* Certificate issuance

---

## Correlation & Context

Every external request should have:

* A request ID
* A trace ID
* Clear service attribution

These identifiers must flow through:

* REST calls
* GraphQL resolvers
* Event producers
* Background jobs

---

## Alerting Strategy

Alerts should be:

* Actionable
* Tied to user impact
* Limited in volume

### Good Alert Examples

* Login failure rate spike
* Internship execution endpoints failing
* WebSocket connection churn
* Certificate issuance failures

Avoid alerts for:

* Single failures
* Expected retries
* Non-user-impacting noise

---

## Realtime & Event Observability

For WebSockets and events:

* Track connection counts
* Monitor dropped events
* Measure event delivery latency
* Log schema validation failures

Event systems should fail **loudly but safely**.

---

## Security & Compliance Considerations

* Audit admin actions
* Track permission denials
* Log certificate issuance and verification
* Retain logs according to policy

Logs may be subject to retention and privacy regulations.

---

## Failure Scenarios to Observe

* Partial outages
* Dependency failures
* Slow downstream services
* Backpressure on event systems
* Cache invalidation failures

Observability should support **root-cause analysis**, not guesswork.

---

## Non-Goals (Explicit)

This document does **not** define:

* Monitoring vendors
* Dashboard layouts
* Alert thresholds
* Incident response procedures

Those belong to operational playbooks.

---