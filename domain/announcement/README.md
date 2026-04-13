# Announcement Domain

A comprehensive announcement management system built with Node.js, Express, and MongoDB. This domain provides full CRUD operations with role-based access control, filtering, pagination, and validation.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [API Endpoints](#api-endpoints)
- [Data Model](#data-model)
- [Validation Rules](#validation-rules)
- [Authorization](#authorization)
- [Installation](#installation)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)

## Overview

The Announcement domain is designed to manage system-wide announcements with support for:
- Multi-category organization
- Priority levels
- Target audience segmentation
- Automatic expiration
- Soft deletion
- Rich content support

## Features

### Core Functionality
- ✅ **CRUD Operations** - Create, read, update, and delete announcements
- ✅ **Filtering** - Filter by category, search term, and target audience
- ✅ **Pagination** - Built-in pagination for efficient data retrieval
- ✅ **Soft Delete** - Announcements are hidden rather than permanently removed
- ✅ **Auto-expiration** - Announcements automatically expire based on date
- ✅ **Virtual Properties** - `isExpired` virtual for easy expiration checking

### Security
- 🔒 **Role-Based Access** - Different permissions for admin, instructor, and public users
- 🔒 **Input Validation** - Comprehensive Joi validation for all inputs
- 🔒 **Authorization Checks** - Users can only modify their own announcements (admins can modify any)

### Data Organization
- 🏷️ **Categories**: Academic, Financial, Event, Accommodation
- ⚡ **Priority Levels**: Low, Medium, High
- 👥 **Target Audiences**: All, Undergraduate, Postgraduate, International, Domestic
- 🏷️ **Tags**: Custom tags for additional categorization

## API Endpoints

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/announcements` | Public | Get all active announcements with filters |
| GET | `/api/announcements/categories` | Public | Get list of available categories |
| GET | `/api/announcements/:id` | Public | Get a single announcement |
| POST | `/api/announcements` | Admin/Instructor | Create a new announcement |
| PUT | `/api/announcements/:id` | Admin/Instructor | Update an announcement |
| DELETE | `/api/announcements/:id` | Admin Only | Soft delete an announcement |

### Query Parameters (GET /api/announcements)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | string | - | Filter by category (Academic, Financial, Event, Accommodation) |
| `search` | string | - | Search in title, description, and tags |
| `targetAudience` | string | - | Filter by target audience |
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 10 | Items per page |

## Data Model

### Announcement Schema

```javascript
{
  title: String (required, max 200 chars),
  description: String (required, max 1000 chars),
  content: String (required),
  category: String (required) - Academic/Financial/Event/Accommodation,
  priority: String (default: 'medium') - low/medium/high,
  image: String (required) - URL,
  date: Date (default: Date.now),
  expiresAt: Date (required),
  isActive: Boolean (default: true),
  createdBy: ObjectId (ref: 'User'),
  targetAudience: [String] (default: ['all']),
  tags: [String],
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

### Virtual Properties

- **`isExpired`** - Returns `true` if `expiresAt` is in the past

### Methods

- **`isViewable()`** - Returns `true` if announcement is active and not expired
- **`getActiveByCategory(category)`** - Static method to get active announcements by category

### Indexes

- `{ category: 1, isActive: 1, date: -1 }` - Optimized for filtered queries
- `{ expiresAt: 1 }` - TTL index for automatic expiration
- `{ isActive: 1, date: -1 }` - Optimized for active announcements queries

## Validation Rules

### Create Announcement Validation

| Field | Rules |
|-------|-------|
| `title` | Required, max 200 characters |
| `description` | Required, max 1000 characters |
| `content` | Required |
| `category` | Required, must be one of: Academic, Financial, Event, Accommodation |
| `priority` | Optional, default: medium, must be: low, medium, high |
| `image` | Required, must be valid URL |
| `expiresAt` | Required, must be future date |
| `targetAudience` | Optional, default: ['all'], must contain valid audience types |
| `tags` | Optional, array of strings |

### Update Announcement Validation

All fields are optional but at least one field must be provided. Same validation rules apply for each field.

## Authorization

### Role-Based Permissions

| Role | Create | Read | Update | Delete |
|------|--------|------|--------|--------|
| Public | ❌ | ✅ | ❌ | ❌ |
| Instructor | ✅ | ✅ | ✅ (own only) | ❌ |
| Admin | ✅ | ✅ | ✅ (any) | ✅ |

### Middleware

- **`authenticate(['admin', 'instructor'])`** - Protects POST and PUT routes
- **`authenticate(['admin'])`** - Protects DELETE routes
- **`validate(validationSchema)`** - Validates request body and parameters

## Installation

1. **Ensure the domain is properly structured:**
   ```
   announcement/
   ├── announcement.controller.js
   ├── announcement.model.js
   ├── announcement.route.js
   ├── announcement.service.js
   ├── announcement.validation.js
   └── index.js
   ```

2. **Import the routes in your main application:**
   ```javascript
   import announcementRoutes from './domains/announcement/index.js';
   
   // In your Express app
   app.use('/api/announcements', announcementRoutes);
   ```

3. **Ensure required dependencies are installed:**
   ```bash
   npm install mongoose joi express
   ```

## Usage Examples

### Create an Announcement

```javascript
POST /api/announcements
Authorization: Bearer <admin_token>

{
  "title": "Spring Semester Registration",
  "description": "Registration for Spring semester is now open",
  "content": "Detailed information about registration process...",
  "category": "Academic",
  "priority": "high",
  "image": "https://example.com/registration-banner.jpg",
  "expiresAt": "2024-12-31T23:59:59.000Z",
  "targetAudience": ["undergraduate", "postgraduate"],
  "tags": ["registration", "academic", "spring2024"]
}
```

### Get Announcements with Filters

```javascript
GET /api/announcements?category=Academic&search=registration&targetAudience=undergraduate&page=1&limit=20
```

### Update an Announcement

```javascript
PUT /api/announcements/:id
Authorization: Bearer <admin_or_instructor_token>

{
  "priority": "high",
  "title": "Updated: Spring Semester Registration"
}
```

### Delete an Announcement (Soft Delete)

```javascript
DELETE /api/announcements/:id
Authorization: Bearer <admin_token>
```

## Error Handling

The domain uses a custom `AppError` class for consistent error responses:

```javascript
{
  "success": false,
  "message": "Error description",
  "statusCode": 400,
  "error": "Additional error details (development only)"
}
```

### Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Validation error or bad request |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Announcement not found |
| 500 | Server error |

### Validation Error Example

```javascript
{
  "success": false,
  "message": "Validation error: title is required",
  "statusCode": 400
}
```

## Dependencies

- **mongoose** - MongoDB ODM
- **joi** - Schema validation
- **express** - Web framework

## Notes

- All dates should be provided in ISO 8601 format
- The `expiresAt` field uses MongoDB TTL index for automatic document removal
- Soft-deleted announcements are hidden but remain in the database
- Search functionality performs case-insensitive partial matching on title, description, and tags
- The `categories` endpoint returns only categories that have active announcements