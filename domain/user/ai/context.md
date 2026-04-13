# User Domain Context

## Overview
The User domain serves as the central authentication and profile management system. Users can have different roles (student, lecturer, admin, etc.) with role-specific data stored in separate models (Student, Lecturer, Admin) that share the same `_id` as the User document.

## Core Entities

### User
Central user entity with authentication and basic profile information.

**Key Fields:**
- `_id`: Unique MongoDB ObjectId
- `first_name`, `middle_name`, `last_name`: Personal name components
- `title`: Professional title (mr, mrs, dr, prof, etc.)
- `email`: Unique email for authentication
- `phone`: Contact number
- `avatar`: URL to profile picture
- `role`: User role (admin, dean, hod, lecturer, student, applicant, vc)
- `department`: Reference to Department model
- `staffId`: Staff identification (for staff roles)
- `matricNo`: Student matriculation number (for students)
- `extra_roles`: Additional permissions (customer_service, moderator, support_agent)
- `chat_availability`: Boolean for chat availability
- `bio`: User biography/description
- `is_deleted`: Soft delete flag
- `last_seen`: Last activity timestamp

**Security-Focused Fields (select: false by default):**
- `password`: Hashed password
- `lastPasswordChange`: Last password change date
- `passwordExpiryDays`: Password expiration period (default 90 days)
- `passwordHistory`: History of previous passwords
- `recentDevices`: Tracked login devices
- `created_by`: User who created this record
- `created_by_source`: Creation source (user, system, cron, migration, webhook)

### Related Domain Models
These models share the same `_id` as the User and contain role-specific data:

**Student Model:**
- Linked by `_id`
- Contains: `matricNumber`, `level`, `programmeId`, `session`

**Lecturer Model:**
- Linked by `_id`
- Contains: `staffId`, `departmentId`

**Admin Model:**
- Linked by `_id`
- Contains: `admin_id`

## Relationships

1. **User → Department**: Many-to-one (optional)
2. **User → Student/Lecturer/Admin**: One-to-one (based on role)
3. **User → User (created_by)**: Self-reference for audit tracking

## Business Rules

### System User Protection
- System user is identified by a reserved ObjectId (`SYSTEM_USER_ID`)
- System user CANNOT be modified, updated, or deleted
- System user CANNOT be impersonated or created via API

### Profile Update Rules

**Common Fields (all roles):**
- `first_name`, `middle_name`, `last_name`, `bio`, `chat_availability`, `phone`

**Role-Specific Fields:**

| Role | Allowed Fields |
|------|---------------|
| student | matricNo, level, session |
| lecturer | staffId, department |
| hod | staffId, department |
| dean | staffId, faculty |
| admin | staffId, department, extra_roles |
| applicant | matricNo, level, session |
| vc | staffId |

**Restricted Fields:**
- Cannot update: `_id`, `password`, `passwordHistory`, `role`, `created_at`, `created_by`, etc.
- Title changes for students require admin approval
- Department/faculty changes may require admin approval
- Avatar changes require admin approval (in some implementations)

### Validation Rules

**Name Fields:**
- Minimum 2 characters, maximum 50
- Only letters, spaces, hyphens, apostrophes

**Bio:**
- Maximum 500 characters

**Matric/Staff IDs:**
- Pattern: `^[A-Z0-9\/\-]+$`

**Level:**
- Values: 100, 200, 300, 400, 500, 600, Masters, PhD

**Session:**
- Format: YYYY/YYYY (e.g., 2023/2024)

**Extra Roles:**
- Values: customer_service, moderator, support_agent

### Soft Deletion
- Users are soft-deleted by setting `is_deleted = true`
- Deleted users are excluded from queries by default
- Can be included by setting `includeDeleted` option
- Tracks `deleted_at` and `deleted_by`

### Password Management
- Passwords are hashed before storage
- Password history tracked for security
- Password expiry based on `passwordExpiryDays` (default 90 days)
- Last password change timestamp maintained

## Permissions

- **Users**: Can view/edit their own profile
- **Admins**: Can view/edit any user, delete users
- **Role-based**: Certain fields only accessible based on user role

## Common Operations

1. **Get Profile**: Returns user data + role-specific details (department, staffId, matricNo, faculty, session)
2. **Update Profile**: Validates fields against role permissions, checks uniqueness constraints
3. **Avatar Upload**: Validates image type, uploads to FileService, updates user.avatar
4. **List Users**: Supports filtering by role, department, search by name/email/staffId/matricNo
5. **Delete User**: Soft delete with audit trail