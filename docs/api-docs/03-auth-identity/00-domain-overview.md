## Versioning Policy

This document defines **how API changes are introduced, communicated, and maintained** in the Virtual Internship Platform.

Versioning exists to protect:

* Frontend stability
* Backend evolution
* Third-party integrations
* Business continuity

Breaking changes without versioning are forbidden.

---

## API Version Structure

All APIs are versioned in the URL:

```
/api/v1
```

Version numbers represent **behavioral contracts**, not just payload shape.

---

## What Constitutes a Breaking Change

The following are considered **breaking changes**:

* Removing an endpoint
* Changing endpoint behavior
* Removing or renaming response fields
* Changing field meanings
* Changing validation or business rules
* Changing error codes or semantics

Any of the above requires a **new API version**.

---

## Non-Breaking Changes

The following are allowed within the same version:

* Adding new endpoints
* Adding new optional fields
* Adding new filters or sort options
* Improving internal performance
* Fixing bugs that violate existing documentation

Non-breaking changes must not alter existing behavior.

---

## Version Lifecycle

Each API version follows this lifecycle:

1. **Active** – fully supported
2. **Deprecated** – still functional, no new features
3. **Retired** – no longer available

Deprecation must be communicated clearly and early.

---

## Deprecation Policy

* Minimum deprecation window: **90 days**
* Deprecation must be documented
* Deprecation warnings may be returned in response headers
* No silent retirement

---

## Backward Compatibility Rules

* New versions must not affect old versions
* Clients choose when to upgrade
* No shared mutable logic across versions

---

## Experimental Features

If experimental APIs are needed:

* They must be explicitly labeled
* They must not be relied on by core workflows
* They may change without guarantee

Experimental APIs must never affect certification, KPIs, or core workflows.

---

## Versioned Documentation

Each API version must have:

* Its own documentation set
* Its own changelog
* Clear migration notes

---

## Emergency Changes

In rare cases (security, legal):

* Emergency patches may be applied
* Behavior must still match documentation
* Changes must be documented retroactively

Emergency does not excuse silence.

---

## Relationship to Canon

This document enforces:

* Canon 10 (Auditability)
* Canon 12 (Documentation is law)
* Global Rule 10 (Version boundaries)

