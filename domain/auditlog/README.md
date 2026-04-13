# Audit Log Domain

A comprehensive, security-first audit logging system for Node.js applications. This domain provides automatic logging of all HTTP requests, database operations, and authentication events with intelligent intent detection, rate limiting, and suspicious activity monitoring.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Core Components](#core-components)
- [API Endpoints](#api-endpoints)
- [Middleware Usage](#middleware-usage)
- [Database Hooks](#database-hooks)
- [Security Features](#security-features)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Data Model](#data-model)

## Overview

The Audit Log domain is a sophisticated logging system that automatically captures and records all system activities with security-first principles. It detects suspicious behavior, prevents mixed read/write operations, implements rate limiting, and provides comprehensive audit trails for compliance and security monitoring.

## Features

### 🔐 Security First
- **Intent Detection** - Automatically detects whether a request is a READ or WRITE operation
- **Mixed Intent Prevention** - Blocks requests mixing read parameters (filters, fields) with write operations
- **Rate Limiting** - Separate rate limits for READ and WRITE operations
- **Suspicious Activity Detection** - Automatically flags suspicious patterns
- **Violation Tracking** - Monitors and logs security violations

### 📊 Comprehensive Logging
- **HTTP Request Logging** - Automatically logs all HTTP requests with full context
- **Database Operation Logging** - Tracks all CRUD operations at the model level
- **Authentication Events** - Specialized logging for login, logout, and registration
- **Bulk Operations** - Support for logging batch operations
- **Cascade Operations** - Track related operations across entities

### 🔍 Advanced Capabilities
- **Entity History** - Complete audit trail for any entity
- **Search & Filtering** - Powerful search across logs with multiple filters
- **Export Functionality** - Export logs to CSV or JSON
- **Statistics & Analytics** - Dashboard-ready statistics
- **Auto-tagging** - Automatic categorization of log entries

## Architecture

The audit system uses a multi-layered architecture with **AsyncLocalStorage** for request context propagation:

```
┌─────────────────────────────────────────────────────────┐
│                    HTTP Request                         │
└────────────────────┬────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│              auditMiddleware (Security)                 │
│  • Intent Detection                                     │
│  • Rate Limiting                                        │
│  • Mixed Intent Prevention                              │
│  • AsyncLocalStorage Setup                              │
└────────────────────┬────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│           Application Logic / Database                   │
│  • Business Operations                                  │
│  • Database Hooks (dbAuditMiddleware)                   │
└────────────────────┬────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│              AuditLogService.logOperation()              │
│  • Enriches with user/context data                      │
│  • Sanitizes sensitive fields                           │
│  • Computes changes                                     │
│  • Detects severity                                     │
└─────────────────────────────────────────────────────────┘
```

## Installation

1. **Add the audit domain to your project:**
   ```
   auditlog/
   ├── auditlog.controller.js
   ├── auditlog.middleware.js
   ├── auditlog.model.js
   ├── auditlog.routes.js
   ├── auditlog.service.js
   ├── auditlog.util.js
   └── index.js
   ```

2. **Configure the audit middleware in your main app:**
   ```javascript
   import auditMiddleware, { authAuditMiddleware, dbAuditMiddleware } from './domains/auditlog/index.js';
   
   // Apply audit middleware to all routes
   app.use(auditMiddleware({
     enabled: true,
     skipPaths: ['/health', '/favicon.ico'],
     sensitiveFields: ['password', 'token', 'creditCard']
   }));
   
   // Apply auth audit middleware for authentication routes
   app.use('/auth', authAuditMiddleware);
   ```

3. **Apply database audit hooks to your models:**
   ```javascript
   import { dbAuditMiddleware } from '../auditlog/index.js';
   
   const userSchema = new mongoose.Schema({ ... });
   export default dbAuditMiddleware(userSchema, { 
     modelName: 'User',
     sensitiveFields: ['password', 'resetToken']
   });
   ```

## Core Components

### 1. **auditMiddleware** - Main HTTP Request Interceptor
Automatically logs all HTTP requests with intelligent intent detection and security enforcement.

### 2. **dbAuditMiddleware** - Database Operation Hooks
Automatically logs all Mongoose operations (save, update, delete) with before/after state.

### 3. **AuditLogService** - Core Logging Service
Provides methods for logging operations, searching logs, and generating statistics.

### 4. **AuditLog Model** - Data Storage Schema
Mongoose schema with built-in severity detection and auto-tagging.

### 5. **AuditUtil** - Helper Utilities
Utility functions for diffing objects, sanitizing data, and extracting entity information.


## **Understanding `req.auditContext` Implementation Pattern**

Based on the code, here's how the `req.auditContext` pattern works:

### **Core Concept**
`req.auditContext` is a custom property attached to the Express request object (`req`) to pass audit log data through middleware layers to a centralized audit logging service.

### **Implementation Pattern**

#### **1. Setting the Audit Context**
In controller methods, you **set** `req.auditContext` before returning a response:

```javascript
req.auditContext = {
  action: "ACTION_NAME",          // What happened (e.g., "CREATE_LECTURER")
  resource: "ResourceType",       // What resource (e.g., "Lecturer")
  severity: "LEVEL",              // "LOW"|"MEDIUM"|"HIGH"|"CRITICAL"
  entityId: "entity-id",          // ID of affected entity (if applicable)
  status: "STATUS",               // "SUCCESS"|"FAILURE"|"ERROR"
  reason: "Human readable reason",// Why this happened
  metadata: {                     // Additional context
    userId: "user-id",
    // ... other relevant data
  }
};
```

#### **2. The Middleware Chain**
The flow typically looks like:
```
Request → Auth Middleware → Controller → Audit Middleware → Response
                    ↑                          ↑
               Sets user info          Reads req.auditContext
```

#### **3. Expected Middleware Structure**
Somewhere in your codebase, there should be an **audit middleware** that:

```javascript
// Example audit middleware (likely in middleware chain)
const auditMiddleware = async (req, res, next) => {
  // ... other middleware logic
  
  // Hook into response finish to log audit data
  res.on('finish', async () => {
    if (req.auditContext) {
      try {
        await AuditLogService.createLog(req.auditContext);
      } catch (error) {
        console.error('Failed to create audit log:', error);
      }
    }
  });
  
  next();
};
```

### **Key Properties in `req.auditContext`**

| Property | Purpose | Example |
|----------|---------|---------|
| `action` | The action performed | `"CREATE_LECTURER"`, `"UPDATE_LECTURER"` |
| `resource` | Type of resource affected | `"Lecturer"`, `"User"`, `"Department"` |
| `severity` | Impact level | `"LOW"`, `"MEDIUM"`, `"HIGH"`, `"CRITICAL"` |
| `entityId` | ID of affected entity | `"507f1f77bcf86cd799439011"` |
| `status` | Outcome of operation | `"SUCCESS"`, `"FAILURE"`, `"ERROR"` |
| `reason` | Human-readable explanation | `"Lecturer created successfully"` |
| `metadata` | Additional structured data | User info, timestamps, changes, etc. |

### **Common Patterns Found in the Code**

#### **Success Case:**
```javascript
req.auditContext = {
  action: "CREATE_LECTURER",
  resource: "Lecturer",
  severity: "MEDIUM",
  entityId: lecturer._id,
  status: "SUCCESS",
  reason: `Lecturer ${name} created successfully`,
  metadata: {
    lecturerId: lecturer._id,
    lecturerName: name,
    performedBy: req.user.role,
    performedByUserId: req.user._id
  }
};
```

#### **Failure Case (Validation/Business Rules):**
```javascript
req.auditContext = {
  action: "CREATE_LECTURER",
  resource: "Lecturer",
  severity: "MEDIUM",
  status: "FAILURE",
  reason: "Lecturer with this staff ID already exists",
  metadata: {
    duplicateStaffId: staffId,
    attemptedBy: req.user.role,
    attemptedUserId: req.user._id
  }
};
```

#### **Error Case (Server/System Issues):**
```javascript
req.auditContext = {
  action: "CREATE_LECTURER",
  resource: "Lecturer",
  severity: "CRITICAL",
  status: "ERROR",
  reason: "Internal server error during lecturer creation",
  metadata: {
    attemptedBy: req.user?.role,
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  }
};
```

### **Critical Implementation Notes**

1. **Timing is Crucial**: Set `req.auditContext` **before** sending the response with `buildResponse()`

2. **Always Include User Context**: The audit middleware likely needs to know who performed the action:
   ```javascript
   metadata: {
     performedBy: req.user.role,      // User's role
     performedByUserId: req.user._id, // User's ID
     // ... other user context
   }
   ```

3. **Error Handling in Audit**: The audit logging itself should not break the main flow. If audit fails, the main operation should still complete.

4. **Conditional Auditing**: Some operations (like READ/search) might not need auditing:
   ```javascript
   if (req._intent !== "READ") {
     req.auditContext = { ... };
   }
   ```

### **How to Use This Pattern**

When you need to add audit logging to a new endpoint:

1. **Identify the action type** (CREATE, UPDATE, DELETE, ASSIGN, etc.)
2. **Determine what to log** (before/after states, user info, changes)
3. **Set `req.auditContext`** in all code paths (success, failure, error)
4. **Include relevant metadata** for troubleshooting
5. **Test that the audit trail** appears in your logs

### **Prompt Template for Future Use**

When you need help with `req.auditContext` in another chat, use prompts like:

> "I need to add audit logging to [endpoint name]. The endpoint [brief description]. What should the `req.auditContext` look like for success/failure cases?"

> "I'm getting this error in audit logging: [error]. How should I structure the `req.auditContext` metadata?"

> "For [specific operation] on [resource], what severity level and status should I use in `req.auditContext`?"

> "How do I track before/after changes in `req.auditContext` for update operations?"

This pattern ensures all security-sensitive operations are properly logged for compliance, debugging, and monitoring purposes.


## API Endpoints

All endpoints require admin authentication unless specified.

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/audit/logs` | Admin | Get audit logs with filtering |
| GET | `/audit/statistics` | Admin | Get audit statistics dashboard |
| GET | `/audit/entity/:entity/:entityId` | Admin | Get history for specific entity |
| GET | `/audit/user/:userId/activity` | Admin | Get activity for specific user |
| GET | `/audit/my-activity` | Authenticated | Get current user's activity |
| GET | `/audit/export` | Admin | Export audit logs (CSV/JSON) |
| GET | `/audit/suspicious` | Admin | Get suspicious activities |
| PATCH | `/audit/:logId/review` | Admin | Mark suspicious log as reviewed |

### Query Parameters (GET /audit/logs)

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50) |
| `sortBy` | string | Field to sort by (default: timestamp) |
| `sortOrder` | string | asc or desc (default: desc) |
| `userId` | string | Filter by user ID |
| `role` | string | Filter by user role |
| `entity` | string | Filter by entity type |
| `action` | string | Filter by action |
| `severity` | string | Filter by severity (INFO, LOW, MEDIUM, HIGH, CRITICAL) |
| `status` | string | Filter by status (SUCCESS, FAILURE, etc.) |
| `startDate` | date | Start date for filtering |
| `endDate` | date | End date for filtering |
| `search` | string | Search across username, email, entity name, reason |

## Middleware Usage

### Basic HTTP Audit Middleware

```javascript
import auditMiddleware from './domains/auditlog/index.js';

app.use(auditMiddleware({
  enabled: true,
  skipMethods: ['OPTIONS', 'HEAD'], // Skip logging for these methods
  skipPaths: ['/health', '/metrics'], // Skip logging for these paths
  logRequestBody: false, // Don't log request bodies (sensitive)
  logQueryParams: true, // Log query parameters
  sensitiveFields: ['password', 'token', 'creditCard'] // Fields to redact
}));
```

### Authentication Audit Middleware

```javascript
import { authAuditMiddleware } from './domains/auditlog/index.js';

// Apply to authentication routes only
app.use('/auth/login', authAuditMiddleware);
app.use('/auth/register', authAuditMiddleware);
app.use('/auth/logout', authAuditMiddleware);
```

### Database Audit Hooks

```javascript
import { dbAuditMiddleware } from './domains/auditlog/index.js';

// Apply to any Mongoose schema
const courseSchema = new mongoose.Schema({ ... });

export default dbAuditMiddleware(courseSchema, {
  modelName: 'Course',
  sensitiveFields: ['examKey', 'answerKey']
});
```

## Database Hooks

The database audit middleware automatically logs:

| Operation | Hook | Logged Action |
|-----------|------|---------------|
| Document save (new) | `post('save')` | CREATE |
| Document save (update) | `post('save')` | UPDATE |
| Document remove | `post('remove')` | DELETE |
| findOneAndUpdate | `post('findOneAndUpdate')` | UPDATE |
| findOneAndDelete | `post('findOneAndDelete')` | DELETE |

### Security Validation in Database Hooks

The middleware detects and logs **intent violations** - write operations attempted during READ-only contexts:

```javascript
// This would be flagged as suspicious
// GET /api/students?filters=... with POST body containing write parameters
```

## Security Features

### 1. Intent Detection

The system automatically detects the intent of each request:

- **READ Intent**: GET requests or POST requests with only read parameters (filters, fields, page, limit)
- **WRITE Intent**: POST/PUT/PATCH/DELETE requests with data modifications
- **BLOCKED Intent**: Requests mixing read parameters with write operations

### 2. Rate Limiting

Separate rate limits for different operations:

| Operation | Max Requests | Window | Action |
|-----------|--------------|--------|--------|
| READ | 100 | 10 minutes | Soft block at 80, hard block at 500 |
| WRITE | Configurable | Configurable | Per violation tracking |

### 3. Suspicious Activity Detection

Automatically flags:

- Multiple failed login attempts
- Grade changes outside normal hours (8 AM - 6 PM)
- Bulk deletions (>10 items)
- Unauthorized access attempts
- Mixed intent violations
- Rate limit violations

### 4. Data Sanitization

Automatically redacts sensitive fields:
- passwords
- tokens
- secrets
- credit card numbers
- SSNs

## Configuration

### Audit Middleware Options

```javascript
{
  enabled: true,                    // Enable/disable audit logging
  skipMethods: ['GET', 'OPTIONS'],  // Methods to skip (default: GET, OPTIONS, HEAD)
  skipPaths: [],                     // Paths to skip (e.g., ['/health'])
  logRequestBody: false,             // Log request bodies (default: false)
  logQueryParams: false,             // Log query parameters (default: false)
  sensitiveFields: []                // Additional fields to redact
}
```

### Rate Limit Configuration

```javascript
const RATE_LIMITS = {
  READ: {
    maxRequests: 100,                // Max read requests per window
    windowMs: 10 * 60 * 1000,       // Time window (10 minutes)
    softBlockThreshold: 80,          // Warning threshold
    hardBlockThreshold: 500          // Hard block threshold
  },
  VIOLATION: {
    maxRequests: 5,                  // Max violations before block
    windowMs: 10 * 60 * 1000        // Time window (10 minutes)
  }
};
```

## Usage Examples

### 1. Manual Logging

```javascript
import { AuditLogService } from './auditlog/index.js';

// Log a custom operation
await AuditLogService.logOperation({
  userId: '507f1f77bcf86cd799439011',
  action: 'GRADE_UPDATE',
  entity: 'Grade',
  entityId: '507f1f77bcf86cd799439012',
  changes: {
    before: { grade: 'F' },
    after: { grade: 'A' }
  },
  context: {
    endpoint: '/api/grades/507f1f77bcf86cd799439012',
    method: 'PUT',
    ipAddress: '192.168.1.1'
  },
  reason: 'Grade updated by instructor',
  severity: 'MEDIUM',
  tags: ['academic', 'grade-change']
});
```

### 2. Bulk Operation Logging

```javascript
await AuditLogService.logBulkOperation({
  userId: req.user._id,
  action: 'GRADE_UPLOAD',
  entity: 'Grade',
  items: gradeUpdates, // Array of updated items
  context: { endpoint: req.originalUrl },
  reason: 'Bulk grade upload for semester',
  metadata: { academicYear: '2024', semester: 'Spring' }
});
```

### 3. Cascade Operation Logging

```javascript
await AuditLogService.logCascadeOperation({
  userId: req.user._id,
  action: 'DELETE',
  mainEntity: 'Department',
  mainEntityId: departmentId,
  relatedOperations: [
    { entity: 'Course', entityId: courseId1, action: 'DELETE' },
    { entity: 'Course', entityId: courseId2, action: 'DELETE' }
  ],
  reason: 'Department deletion cascade',
  metadata: { departmentName: 'Computer Science' }
});
```

### 4. Searching Audit Logs

```javascript
const results = await AuditLogService.searchLogs({
  entity: 'Grade',
  action: 'GRADE_UPDATE',
  severity: 'MEDIUM',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  search: 'final exam',
  page: 1,
  limit: 20
});
```

### 5. Getting Entity History

```javascript
const history = await AuditLogService.getEntityAuditHistory(
  'Student',
  '507f1f77bcf86cd799439011',
  50
);
```

## Data Model

### AuditLog Schema

```javascript
{
  timestamp: Date,                    // When the event occurred
  actor: {
    userId: ObjectId,                // Reference to User model
    username: String,                // Username at time of action
    email: String,                   // Email at time of action
    role: String,                    // User role at time of action
    department: ObjectId,            // Department reference
    matricNo: String,                // Student matric number
    staffId: String,                 // Staff ID
    ipAddress: String                // IP address
  },
  action: String,                    // CREATE, UPDATE, DELETE, LOGIN, etc.
  entity: String,                    // Model name (User, Course, Grade)
  entityId: ObjectId,                // ID of affected entity
  entityName: String,                // Human-readable name
  changes: {
    before: Mixed,                   // State before change
    after: Mixed,                    // State after change
    changedFields: [String],         // Fields that changed
    delta: Mixed                     // Detailed changes
  },
  context: {
    endpoint: String,                // API endpoint
    method: String,                  // HTTP method
    requestId: String,               // Unique request ID
    userAgent: String,               // Browser/device info
    queryParams: Mixed,              // Query parameters
    requestBody: Mixed,              // Request body (sanitized)
    responseTime: Number,            // Response time in ms
    statusCode: Number,              // HTTP status code
    errorMessage: String             // Error message if any
  },
  status: String,                    // SUCCESS, FAILURE, UNAUTHORIZED, etc.
  metadata: Mixed,                   // Additional context
  severity: String,                  // INFO, LOW, MEDIUM, HIGH, CRITICAL
  isSuspicious: Boolean,             // Flag for suspicious activity
  requiresReview: Boolean,           // Flag for manual review needed
  tags: [String],                    // Auto-generated tags
  relatedEntities: [{                // Related entities for cascade ops
    entity: String,
    entityId: ObjectId
  }]
}
```

### Severity Levels

| Level | Description | Examples |
|-------|-------------|----------|
| INFO | Routine operations | READ operations, successful logins |
| LOW | Low-risk operations | CREATE/UPDATE of non-sensitive entities |
| MEDIUM | Medium-risk operations | UPDATE of sensitive entities, bulk operations |
| HIGH | High-risk operations | DELETE operations, unauthorized access |
| CRITICAL | Critical security events | Role changes, grade tampering, mixed intent |

### Auto-generated Tags

The system automatically adds tags based on:
- **Entity type** (user, course, grade)
- **Action category** (authentication, financial, academic, data-modification)
- **Status** (security, error)
- **Operation type** (bulk_operation, cascade, business)

## Best Practices

### 1. Always Use AsyncLocalStorage Context
The middleware automatically sets up AsyncLocalStorage context. Ensure your code runs within this context for proper correlation.

### 2. Never Throw from Audit Logging
Audit logging failures should never break your application. The service always returns `null` on errors.

### 3. Sanitize Sensitive Data
Always mark sensitive fields in your schemas to ensure they're redacted.

### 4. Set Appropriate Severity
Let the system auto-determine severity, or override when needed for specific business operations.

### 5. Use Batch Logging for Bulk Operations
Use `logBulkOperation` instead of logging each item individually.

### 6. Enable Redis for Production
Redis provides better rate limiting and violation tracking across multiple server instances.

## Performance Considerations

- **Indexes**: All critical fields are indexed for fast queries
- **Lean Queries**: Use `.lean()` for read operations to improve performance
- **TTL Index**: Automatic cleanup of old logs (configure as needed)
- **Batch Processing**: Consider archiving old logs to maintain query performance

## Dependencies

- **mongoose** - MongoDB ODM
- **express** - Web framework
- **node:async_hooks** - AsyncLocalStorage for context propagation
- **redis** (optional) - Distributed rate limiting and violation tracking

## Security Notes

- All passwords and tokens are automatically redacted
- IP addresses are logged for audit trails
- Request bodies are not logged by default (enable with caution)
- Mixed read/write requests are automatically blocked
- Rate limiting prevents DoS attacks through excessive queries
- Suspicious activity alerts can be integrated with monitoring systems