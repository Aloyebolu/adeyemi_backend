# Student — Internship Dashboard

## 1. Screen Purpose

The **Internship Dashboard** is the student’s **primary operational workspace** during an active internship.

Its purpose is to:

* Centralize all day-to-day internship activities
* Make expectations, tasks, and progress transparent
* Enable structured performance tracking
* Act as the single source of truth for internship execution

Once a student is onboarded, **this becomes their default screen**.

---

## 2. Actor & Preconditions

### Actor

* **Role:** Student

### Preconditions

* Student is authenticated
* Student has been **accepted** for an internship
* Offer has been accepted
* Internship status is **active**
* Onboarding (if required) is completed

If the internship has not started or is completed, access is restricted or read-only.

---

## 3. Required Data to Render

To render the Internship Dashboard, the system provides:

* Internship summary (role, organization, duration)
* Internship start and end dates
* Current internship status
* Assigned tasks and milestones
* Daily attendance / clock-in status
* Training modules (if applicable)
* KPI definitions and current progress
* Messages or announcements related to the internship

All data is scoped strictly to the active internship.

---

## 4. Screen Structure & Sections

The dashboard is structured for **clarity and routine use**, typically including:

1. **Internship Overview**

   * Role and organization
   * Timeline and status indicator

2. **Daily Actions Panel**

   * Clock-in / clock-out
   * Daily activity submission (if required)

3. **Tasks & Assignments**

   * Task list with due dates
   * Submission status

4. **Training & Learning**

   * Assigned modules
   * Completion indicators

5. **KPI & Performance Tracker**

   * KPI list
   * Progress indicators
   * Feedback summaries (if available)

6. **Notifications & Updates**

   * Announcements
   * Important reminders

Only internship-relevant features appear here.

---

## 5. User Actions

The student can:

* Clock in and out (as permitted)
* View assigned tasks
* Submit task deliverables
* Complete training modules
* View KPI progress
* Read internship-related notifications

The student **cannot** modify KPIs, deadlines, or evaluations.

---

## 6. System Responses (Conceptual)

### On Dashboard Load

* System validates internship status
* Current-day actions are enabled or disabled accordingly

### On Clock-In / Clock-Out

* Attendance entry is recorded
* Daily status is updated immediately

### On Task Submission

* Submission is validated
* Task status updates to **submitted**
* Timestamp is recorded

### On Training Completion

* Module status updates
* Progress contributes to KPI metrics if applicable

---

## 7. Success & Failure Flows

### Normal Operation

* Student performs daily actions
* Progress updates in real time
* Dashboard reflects latest state

### Restricted Actions

* Attempting actions outside allowed time or state

  * Clear explanation shown
  * No state change occurs

### Failure Cases

* Submission failure → retry allowed
* Temporary system issue → dashboard enters safe fallback mode

Failures never erase completed work.

---

## 8. State Transitions

| Previous State    | Action              | New State            |
| ----------------- | ------------------- | -------------------- |
| Accepted          | Internship starts   | Active Internship    |
| Active Internship | Daily participation | Active Internship    |
| Active Internship | Internship ends     | Completed Internship |

The dashboard remains accessible in read-only mode after completion.

---

## 9. Exit Conditions

The student exits this screen when:

* Internship status changes to **completed**
* Student navigates to certificate view (when available)
* Student logs out

There is no navigation back to application or discovery flows from an active internship.

---
