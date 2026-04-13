# New Semester Setup & Notes

This document outlines all tasks, checks, and automated processes that should run when a new academic semester starts.

---

## 1. Student Status Checks

### 1.1 Active Students
- Ensure all students with `status: active` have their `session` updated to the new semester.
- Verify all course registrations are cleared for the new semester.

### 1.2 Probation
- Check students with `probationStatus: probation`.
- Verify CGPA conditions and update status if probation is lifted or continues.

### 1.3 Suspended Students
- Iterate over `suspensions` array:
  - Check which suspensions are **still active** (`status: true`).
  - Determine if suspension has **exceeded thresholds** (e.g., consecutive semesters).
  - Flag students who may be **at risk of termination**.
- Types of suspension to check:
  - NO_REGISTRATION
  - ACADEMIC_FAILURE
  - DISCIPLINARY
  - ADMINISTRATIVE
  - SCHOOL_APPROVED (if treating LOA as temporary suspension)

### 1.4 Leave of Absence
- Verify `leaveOfAbsence.status` and `startSemesterId` / `endSemesterId`.
- Ensure students on LOA cannot register courses or perform restricted actions.
- Display appropriate warnings in portal.

### 1.5 Terminated / Withdrawn / Expelled
- Ensure these students remain **blocked** from registration or other portal actions.
- Update reports for graduation eligibility.

---

## 2. Notifications & Alerts

### 2.1 Pre-Registration Warnings
- Warn students with **active NO_REGISTRATION suspensions**:
  - Show on portal dashboard
  - Send email / push notification
  - Include **reason, semester, potential consequences**
  
### 2.2 Multi-Semester Risk
- Identify students with suspensions spanning **consecutive semesters**.
- Send a **critical warning** that they may be terminated if issues are unresolved.

### 2.3 Leave of Absence Reminders
- Notify students on LOA about:
  - Semester start
  - Duration remaining
  - Required action to return

### 2.4 Probation Reminders
- Notify students under probation about:
  - CGPA target to lift probation
  - Deadlines for course registration

---

## 3. Portal Restrictions

- Block all actions for students with **active suspensions**:
  - Registration
  - Course requests
  - Assignment submission
- Only allow **view actions**:
  - Profile
  - Results
  - Historical academic info
- Portal warnings should include **reason and duration**.

---

## 4. CGPA & Academic Checks

- Run **end-of-semester CGPA updates**.
- Identify students eligible for:
  - Graduation
  - Probation lift
  - Academic failure suspension
- Update `probationStatus` and `suspension` array as necessary.

---

## 5. Mastersheet & Reports

- Prepare:
  - Active students list
  - Suspended students list with reasons
  - Students on LOA
  - Terminated / withdrawn / expelled students
  - Students on probation
- Ensure **suspension history is preserved** and **termination triggers** are flagged correctly.

---

## 6. Future Automations (Optional / To Implement Later)

- Auto-send semester start reminders based on student status.
- Track students who have multiple overlapping suspensions.
- Auto-terminate students after policy thresholds are reached.
- Maintain **full audit trail** of all suspensions, warnings, and actions.

---

### Notes
- All actions should respect **array-based suspension system** to prevent overwriting reasons.
- Warnings and notifications should be **visible in portal and sent via email/push**.
- Ensure **backend checks** enforce restrictions even if frontend bypassed.