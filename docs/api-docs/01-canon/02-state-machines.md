## State Machines

This document defines the **authoritative state machines** for core entities in the Virtual Internship Platform.

State machines control:

* What actions are allowed
* When actions are allowed
* How entities transition over time

No endpoint may bypass or “soft-handle” state logic.

If an action is not valid for the current state, the API **must reject it**.

---

## General State Rules (Global)

These rules apply to **all stateful entities**:

1. States are **explicit**, not inferred
2. Transitions are **one-directional unless stated otherwise**
3. State changes are **atomic operations**
4. Invalid transitions result in **hard errors**
5. All state changes are **auditable**

---

## 1️⃣ Student Lifecycle State Machine

### States

```
REGISTERED
→ PROFILE_COMPLETED
→ PREPARATION_COMPLETED
→ APPLIED
→ ACCEPTED
→ ACTIVE
→ COMPLETED
→ CERTIFIED
```

---

### State Definitions

| State                 | Meaning                                       |
| --------------------- | --------------------------------------------- |
| REGISTERED            | Account created, profile incomplete           |
| PROFILE_COMPLETED     | Profile & documents completed                 |
| PREPARATION_COMPLETED | Resume & interview drills finished            |
| APPLIED               | At least one internship application submitted |
| ACCEPTED              | Internship offer accepted                     |
| ACTIVE                | Internship currently ongoing                  |
| COMPLETED             | Internship finished, awaiting certification   |
| CERTIFIED             | Certificate issued                            |

---

### Allowed Transitions

| From                  | To                    | Trigger                  |
| --------------------- | --------------------- | ------------------------ |
| REGISTERED            | PROFILE_COMPLETED     | Profile submission       |
| PROFILE_COMPLETED     | PREPARATION_COMPLETED | Drill completion         |
| PREPARATION_COMPLETED | APPLIED               | Internship application   |
| APPLIED               | ACCEPTED              | Offer acceptance         |
| ACCEPTED              | ACTIVE                | Internship start date    |
| ACTIVE                | COMPLETED             | Completion checks passed |
| COMPLETED             | CERTIFIED             | Certificate issued       |

---

### Invalid Transitions (Examples)

* REGISTERED → APPLIED
* PROFILE_COMPLETED → ACTIVE
* ACTIVE → CERTIFIED
* CERTIFIED → any other state

All must be rejected.

---

## 2️⃣ Internship Lifecycle State Machine

### States

```
DRAFT
→ PUBLISHED
→ APPLICATIONS_OPEN
→ SHORTLISTING
→ OFFERED
→ ACTIVE
→ COMPLETED
→ CLOSED
```

---

### State Definitions

| State             | Meaning                 |
| ----------------- | ----------------------- |
| DRAFT             | Created but not visible |
| PUBLISHED         | Visible but not open    |
| APPLICATIONS_OPEN | Accepting applications  |
| SHORTLISTING      | Reviewing candidates    |
| OFFERED           | Offers issued           |
| ACTIVE            | Internship ongoing      |
| COMPLETED         | Internship ended        |
| CLOSED            | Archived, read-only     |

---

### Allowed Transitions

| From              | To                | Trigger            |
| ----------------- | ----------------- | ------------------ |
| DRAFT             | PUBLISHED         | Employer publish   |
| PUBLISHED         | APPLICATIONS_OPEN | Open applications  |
| APPLICATIONS_OPEN | SHORTLISTING      | Employer action    |
| SHORTLISTING      | OFFERED           | Offer issuance     |
| OFFERED           | ACTIVE            | Offer acceptance   |
| ACTIVE            | COMPLETED         | End conditions met |
| COMPLETED         | CLOSED            | Admin close        |

---

### Special Rules

* An internship cannot be ACTIVE without at least one ACCEPTED student
* An internship cannot return to APPLICATIONS_OPEN after OFFERED
* CLOSED internships are immutable

---

## 3️⃣ Application State Machine

### States

```
DRAFT
→ SUBMITTED
→ SHORTLISTED
→ REJECTED
→ OFFERED
→ ACCEPTED
→ WITHDRAWN
```

---

### Key Rules

* SUBMITTED is only allowed if preparation is completed
* ACCEPTED triggers student ACCEPTED state
* WITHDRAWN is only allowed before OFFERED
* REJECTED is terminal

---

## 4️⃣ Internship Execution State Machine (Student-Level)

### States

```
NOT_STARTED
→ IN_PROGRESS
→ ON_HOLD
→ COMPLETED
```

---

### Rules

* IN_PROGRESS begins at internship start date
* ON_HOLD requires admin or employer action
* COMPLETED requires KPI & attendance checks

---

## 5️⃣ Certificate State Machine

### States

```
PENDING
→ ISSUED
→ REVOKED
```

---

### Rules

* ISSUED only after internship COMPLETED
* REVOKED requires admin action + reason
* REVOKED certificates cannot be reactivated (new issue required)

---

## 6️⃣ State Enforcement Requirements

For every state-changing endpoint:

* Current state must be validated
* Transition must be allowed
* Transition reason must be logged (if sensitive)
* Resulting state must be persisted atomically

No partial transitions are allowed.

---

## 7️⃣ Relationship to Canon

This document must be read together with:

* `01-canon / 00-canonical-decisions.md`
* `01-canon / 01-roles-and-permissions.md`
* `01-canon / 03-global-rules.md`