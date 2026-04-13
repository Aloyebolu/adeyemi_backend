## 1. Purpose

This FAQ answers **frequently asked questions** that arise during implementation, review, and stakeholder discussions.

These answers are **canonical interpretations** of the documentation.
If an answer here conflicts with an implementation idea, **the idea is wrong**.

---

## 2. Can admins manually complete an internship?

**No.**

Admins cannot:

* Mark preparation as complete
* Mark an internship as completed
* Bypass minimum duration
* Override KPI thresholds

Admins may only:

* Pause or terminate internships
* Resolve compliance issues
* Observe and audit

Completion is a **system decision**.

---

## 3. Can a student apply to internships before preparation?

**No.**

Resume Drill and Interview Drill are **hard gates**.

UI hints do not matter.
Backend enforcement is absolute.

---

## 4. Can a student have multiple internships?

**No.**

A student may have:

* Multiple applications
* Multiple offers

But **only one active internship at a time**.

Acceptance of one offer invalidates others.

---

## 5. Are AI recommendations required for discovery?

**No.**

AI recommendations are:

* Optional
* Suppressible
* Advisory only

If AI is down, discovery still works.

---

## 6. Can employers see preparation or KPI details?

**Partially.**

Employers can see:

* Task submissions
* Attendance summaries
* Employer evaluation context

Employers cannot see:

* Resume drill feedback
* Interview drill feedback
* KPI formulas or thresholds
* Internal system flags

---

## 7. Can KPIs be recalculated or fixed?

**Only before finalization.**

* KPI signals are append-only
* Aggregates can be recomputed
* Once KPIs are finalized:

  * They are immutable
  * They cannot be changed by anyone

---

## 8. Can certificates be edited or replaced?

**Certificates cannot be edited.**

They may be:

* Re-generated (same certificate ID)
* Revoked (with reason)

Any replacement must:

* Reference the original
* Be auditable

---

## 9. What happens if a third-party service fails?

**Nothing critical breaks.**

* Email failure ≠ application failure
* AI failure ≠ discovery failure
* Webhook failure ≠ certification failure

Failures are logged and retried.

---

## 10. Why is everything so strict?

Because this platform is:

* Credential-bearing
* Audit-sensitive
* Career-impacting
* Legally relevant

Ambiguity is the enemy.

---

## 🔒 Lock Statement

This FAQ reflects **intentional design decisions**.
They are not negotiable during implementation.