## 1. Purpose

This document defines how **performance signals are collected, aggregated, and tracked over time** during an internship.

Performance tracking is **continuous**, while KPI finalization is **discrete**.

This file defines **how data flows**, not how final decisions are made.

---

## 2. Performance Signal Sources

Performance tracking consumes **immutable signals** from execution domains:

| Source Domain | Signal Type                    |
| ------------- | ------------------------------ |
| Attendance    | Clock-in records               |
| Tasks         | Submissions, reviews, lateness |
| Training      | Completion events              |
| Employer      | Qualitative inputs             |

Signals are **append-only** and never edited.

---

## 3. Tracking Frequency

* Signals are ingested **in near real time**
* Aggregations may run:

  * Daily
  * Weekly
  * On-demand (read-only)
* No aggregation mutates raw data

Raw signals always remain queryable.

---

## 4. Performance Aggregates

### 4.1 Aggregate Record (Conceptual)

```json
{
  "internshipInstanceId": "inst_3001",
  "aggregationWindow": "weekly",
  "periodStart": "2026-03-01",
  "periodEnd": "2026-03-07",
  "metrics": {
    "attendanceRate": 0.92,
    "tasksCompleted": 4,
    "tasksLate": 1,
    "trainingCompleted": 2
  }
}
```

Aggregates are **derived views**, not authoritative records.

---

## 5. Real-Time vs Lagged Metrics

| Metric Type  | Freshness      |
| ------------ | -------------- |
| Attendance   | Near real-time |
| Task status  | Near real-time |
| Training     | Near real-time |
| KPI progress | Lagged         |

Students must never assume real-time KPI accuracy.

---

## 6. Visibility Rules

| Role        | Visibility                     |
| ----------- | ------------------------------ |
| Student     | High-level progress indicators |
| Employer    | Detailed aggregates            |
| Admin       | Full aggregates + raw signals  |
| AI Services | Read-only, anonymized          |

Students never see raw signal data.

---

## 7. Threshold Monitoring (Internal)

* System continuously checks KPI thresholds
* Falling below threshold:

  * Does **not** terminate internship
  * Flags risk state internally
* Risk state may:

  * Trigger notifications
  * Require employer attention

No automatic penalties are applied here.

---

## 8. Data Consistency Guarantees

* Aggregations are idempotent
* Re-running aggregation yields same result
* Aggregation errors do not corrupt raw data

Failures are logged and retried.

---

## 9. Error Scenarios

### 9.1 Aggregation Unavailable

```json
{
  "error": {
    "code": "PERFORMANCE_DATA_UNAVAILABLE",
    "message": "Performance data is temporarily unavailable"
  }
}
```

---

## 10. Non-Negotiable Constraints

* No editing of aggregates
* No manual KPI injections
* No admin overrides
* No AI-driven score changes

---

## 🔒 Lock Statement

Performance tracking is **observational and immutable**.
No domain may tamper with performance signals or aggregates.