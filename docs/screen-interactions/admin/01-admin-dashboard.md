Continuing.
# Admin — Admin Dashboard

## 1. Screen Purpose

The **Admin Dashboard** is the central **oversight and control hub** for platform administrators.

Its purpose is to:

* Provide a real-time operational overview of the platform
* Surface system health, usage, and risk indicators
* Enable access to administrative control areas
* Act as the starting point for all admin workflows

This screen reflects **system-wide authority**, not participation in individual internships.

---

## 2. Actor & Preconditions

### Actor

* **Role:** Admin

### Preconditions

* Admin is authenticated
* Admin account is active and authorized
* Admin has appropriate permission scope

If permissions are limited, visible sections may be restricted.

---

## 3. Required Data to Render

To render the Admin Dashboard, the system provides:

* Platform-wide metrics:

  * Number of students, employers, and internships
  * Active vs completed internships
  * Application and placement counts
* Alerts and flags:

  * Pending approvals
  * Reported issues
  * Policy violations
* Quick-access summaries:

  * Certifications pending issuance
  * Employer profiles awaiting review
* System status indicators (non-technical)

---

## 4. Screen Structure & Sections

The dashboard is designed for **at-a-glance insight**, typically including:

1. **Platform Overview**

   * High-level statistics
   * Trend indicators

2. **Action Required Panel**

   * Items needing admin attention
   * Priority flags

3. **Quick Navigation**

   * User management
   * Certification management
   * Reports and overrides

4. **Announcements / System Notices**

   * Important platform-wide messages

No operational data editing happens directly on this screen.

---

## 5. User Actions

The admin can:

* View system-wide metrics
* Navigate to detailed admin screens
* Acknowledge alerts
* Access reports and management tools

The admin **cannot** directly modify records from this screen.

---

## 6. System Responses (Conceptual)

### On Screen Load

* System aggregates latest platform metrics
* Alerts are prioritized and displayed

### On Alert Interaction

* Alert is marked as viewed
* Admin is redirected to the relevant management screen

---

## 7. Success & Failure Flows

### Normal Flow

* Admin reviews dashboard
* Proceeds to manage specific areas

### Failure Cases

* Metrics unavailable → partial dashboard with warnings
* Temporary system issue → safe fallback with retry

Failures never block access to admin tools.

---

## 8. State Transitions

This screen does **not** directly trigger state transitions.
All transitions occur in downstream admin screens.

---

## 9. Exit Conditions

The admin exits this screen when:

* Navigating to a specific admin function
* Logging out

This screen is always the admin landing page.

---

