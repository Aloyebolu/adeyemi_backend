## Glossary

This glossary defines **standard terminology** used across the Virtual Internship Platform and its API documentation.

All developers, designers, and stakeholders must use these terms **consistently** to avoid ambiguity.

If a term is not defined here, it must be explicitly introduced in the relevant domain documentation.

---

## Core Entities

### Student

A registered user who participates in preparation activities, applies for internships, executes internship tasks, and receives certification.

---

### Employer

An organization or representative that creates internships, reviews applications, supervises interns, and provides evaluations.

---

### Admin

A privileged system role responsible for platform oversight, conflict resolution, overrides, certification, and audits.

---

### Partner

An external organization (e.g. NGO, government body, institution) with limited access to reports, verification, or certification-related data.

---

### Internship

A structured, time-bound and task-bound professional engagement hosted on the platform, governed by defined KPIs and completion rules.

---

### Application

A student’s formal request to participate in a specific internship, subject to eligibility checks and employer review.

---

### Offer

A formal internship invitation issued by an employer to a student, defining internship terms and start conditions.

---

### Preparation

Mandatory pre-internship activities designed to assess and improve student readiness, including resume and interview drills.

---

### Resume Drill

A structured activity where students refine their resumes with guided feedback and tracked progress.

---

### Interview Drill

A structured interview simulation where students receive feedback and AI-assisted improvement suggestions.

---

## System Concepts

### State

The current lifecycle position of an entity (e.g. ACTIVE, COMPLETED). States determine which actions are allowed.

---

### KPI (Key Performance Indicator)

A measurable metric used to evaluate internship performance, attendance, task completion, and skill application.

---

### Clock-In

A daily attendance action performed by a student during an active internship, contributing to KPI scoring.

---

### Certification

An official record issued by the platform confirming successful internship completion based on defined criteria.

---

### Immutable Record

A data record that cannot be edited once finalized. Corrections require administrative action and new records.

---

### Override

An administrative action that bypasses or alters normal workflow rules, always logged for audit purposes.

---

### AI Recommendation

A system-generated ranking or suggestion based on profile data, preparation performance, and historical outcomes. Advisory in nature.

---

## API Concepts

### Domain

A logical grouping of API endpoints that serve a specific area of the system (e.g. preparation, internships, certification).

---

### Canon

A set of non-negotiable rules and decisions that govern system behavior across all domains.

---

### Standard Response Envelope

A consistent JSON response structure used by all API endpoints.

---

### Soft Delete

A deletion strategy where data is marked inactive but not permanently removed.

---

## Usage Rules

* Terms must be used exactly as defined
* Synonyms should be avoided
* New terms must be documented before use