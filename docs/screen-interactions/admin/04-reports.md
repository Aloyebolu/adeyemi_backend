# Admin — Reports

## 1. Screen Purpose

The **Reports** screen allows administrators to **analyze platform activity, outcomes, and performance** through structured reports.

Its purpose is to:

* Provide visibility into platform effectiveness
* Support operational, strategic, and compliance decisions
* Enable reporting to partners, NGOs, or authorities
* Act as the primary analytics and accountability surface

This screen is **observational and export-oriented**, not operational.

---

## 2. Actor & Preconditions

### Actor
* **Role:** Admin

### Preconditions
* Admin is authenticated
* Admin has reporting access permissions
* Reportable data exists in the system

If access is restricted, only permitted reports are visible.

---

## 3. Required Data to Render

To render the Reports screen, the system provides:

* Available report categories
* Time range selectors
* Aggregated metrics across:
  * Students
  * Employers
  * Internships
  * Applications
  * Completions
  * Certifications
* Report generation status (ready / processing)

All data is read-only and aggregated.

---

## 4. Screen Structure & Sections

The screen is structured for **exploration and export**, typically including:

1. **Report Categories**
   * Participation reports
   * Performance and KPI reports
   * Placement and completion reports
   * Certification reports

2. **Filters & Parameters**
   * Date ranges
   * Role or organization filters
   * Internship domain or status

3. **Report Preview**
   * Charts or tabular summaries
   * Key indicators and totals

4. **Export & Sharing Controls**
   * Download report
   * Generate shareable output (if supported)

No raw record editing is available.

---

## 5. User Actions

The admin can:

* Select a report type
* Apply filters and parameters
* View report previews
* Generate full reports
* Download or export reports

The admin **cannot** alter underlying data from this screen.

---

## 6. System Responses (Conceptual)

### On Report Selection
* System prepares relevant aggregated data
* Preview is generated

### On Filter Change
* Report preview updates
* Totals and indicators are recalculated

### On Export Request
* Report generation is initiated
* Admin is notified when export is ready

---

## 7. Success & Failure Flows

### Normal Flow
* Admin views and exports reports successfully
* Data reflects latest available state

### Large Report Flow
* Report enters processing state
* Admin receives completion notification

### Failure Cases
* Report generation failure → retry allowed
* Partial data unavailable → clear warning shown

Failures do not affect system data integrity.

---

## 8. State Transitions

This screen does **not** trigger lifecycle state transitions.

It only reads and aggregates existing system states.

---

## 9. Exit Conditions

The admin exits this screen when:

* Returning to Admin Dashboard
* Navigating to another admin function
* Logging out

---

