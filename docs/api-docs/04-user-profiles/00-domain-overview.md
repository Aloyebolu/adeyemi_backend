## 1. Domain Purpose

The **User Profiles** domain defines how user identity data is **structured, completed, validated, updated, and consumed** across the platform.

This domain acts as the **single source of truth** for all non-auth user information and is a **hard dependency** for:

* Preparation (Resume & Interview Drills)
* Internship discovery & AI recommendations
* Employer evaluation & shortlisting
* Internship execution & KPI tracking
* Certification issuance
* Admin audits and overrides

If profile data is missing, incomplete, or invalid, **downstream domains must fail safely and explicitly**.

---

## 2. In-Scope Responsibilities

This domain is responsible for:

* Initial profile creation after authentication
* Progressive profile completion (step-based)
* Profile completeness scoring
* Document uploads & verification state
* Skills, interests, and preferences management
* Education and background records
* Profile visibility rules per role
* Admin overrides and corrections (with audit logs)

---

## 3. Out-of-Scope Responsibilities

This domain explicitly **does NOT** handle:

* Authentication, login, tokens, or sessions
  → handled by `03-auth-identity`
* Resume content editing or interview performance
  → handled by `05-preparation`
* AI recommendation logic
  → handled by `06-internship-discovery`
* Employer evaluations or KPIs
  → handled by `08-internship-execution`
* Certificates or final outcomes
  → handled by `10-certification`

This domain provides **data only**, never decisions.

---

## 4. Primary Actors & Roles

### 4.1 Student

* Owns and maintains their personal profile
* Can update editable fields until restricted by system rules
* Must complete mandatory sections before progressing

### 4.2 Employer

* Can **read-only view** approved subsets of student profiles
* Cannot modify student data
* Visibility is scoped to:

  * Applicants
  * Shortlisted candidates
  * Active interns

### 4.3 Admin

* Full read/write access
* Can override, correct, or lock profile fields
* All admin actions require **mandatory audit logging**
* Can mark documents as verified/rejected

---

## 5. Profile Lifecycle States

A student profile progresses through clearly defined states:

| State              | Description                                        |
| ------------------ | -------------------------------------------------- |
| `draft`            | Profile auto-created after signup                  |
| `incomplete`       | Mandatory fields missing                           |
| `complete`         | All required fields filled                         |
| `verified_partial` | Some documents verified                            |
| `verified_full`    | All required documents verified                    |
| `locked`           | Profile locked due to policy, audit, or completion |

State transitions are enforced **only by backend logic**.

---

## 6. Mandatory vs Optional Data

### Mandatory (Hard Gates)

* Legal name
* Date of birth
* Education status
* Primary skills (minimum threshold)
* Resume upload (file only, not content quality)
* Identity document (type varies by region)

### Optional (Enhancers)

* Portfolio links
* Secondary skills
* Career preferences
* Location flexibility
* Availability windows

AI and discovery systems **may use optional data**, but **must not require it**.

---

## 7. Profile Completeness Rules

* Completeness is computed server-side
* Returned as a **percentage + missing sections**
* Frontend may **display** but never calculate completeness
* Some screens require:

  * `>= 80%` completeness
  * Specific sections completed (not percentage-based)

---

## 8. Visibility & Privacy Model

Profile data exposure is **role- and context-based**:

* Students: full self-view
* Employers: scoped view only (no PII leakage)
* Admins: full view with history
* AI systems: data access via service role, **read-only**

Sensitive fields (DOB, ID numbers) are **never returned** to employers.

---

## 9. Dependency Map

This domain is a **blocking dependency** for:

* `05-preparation` → requires profile completeness
* `06-internship-discovery` → consumes skills & preferences
* `07-applications-selection` → employer profile views
* `08-internship-execution` → intern identity snapshot
* `10-certification` → immutable profile snapshot at issuance

---

## 10. Non-Negotiable Constraints

* Profile data used in certificates is **snapshotted and immutable**
* Admin edits after snapshot **do not retroactively change history**
* No silent profile mutations
* All overrides are auditable
* Backend is the final arbiter of validity

---

## 11. Files in This Domain

```
04-user-profiles/
├── 00-domain-overview.md   ✅ (this file)
├── 01-profile-model.md
├── 02-profile-completion-flow.md
├── 03-profile-visibility.md
├── 04-document-management.md
├── 05-admin-overrides.md
├── 06-profile-read-endpoints.md
├── 07-profile-write-endpoints.md
└── 08-error-cases.md
```

---

## 🔒 Domain Lock Statement

All rules defined in this overview are **binding** for subsequent files in this domain.
Any deviation must be explicitly justified and approved at Canon level.