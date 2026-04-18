# Script Execution Domain Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation & Setup](#installation--setup)
4. [API Reference](#api-reference)
5. [Creating Scripts](#creating-scripts)
6. [Security](#security)
7. [Audit Logging](#audit-logging)
8. [Examples](#examples)
9. [Troubleshooting](#troubleshooting)

## Overview

The Script Execution Domain provides a secure, controlled environment for running predefined database maintenance scripts in the university result management system. It allows administrators to execute approved operations without direct database access.

### Key Features
- 🔒 **Secure Execution**: Only pre-approved scripts can run
- 👑 **Admin-Only Access**: Protected by authentication middleware
- 📝 **Automatic Audit Logging**: All executions are logged
- 📦 **Modular Script Design**: Easy to add new scripts
- 🛡️ **No Dynamic Code**: Prevents arbitrary code execution

## Architecture

### Folder Structure
```
scripts/
├── index.js                 # Main entry point
├── scripts.constants.js     # Constants and enums
├── scripts.controller.js    # Request handlers
├── scripts.routes.js        # Route definitions
├── scripts.service.js       # Business logic
├── scripts.validation.js    # Input validation
└── tasks/                   # Script implementations
    ├── index.js             # Script registry
    ├── recompute-results.js
    ├── fix-missing-fields.js
    ├── rebuild-master-sheets.js
    └── migrate-data.js
```

### Component Interaction
```
Frontend → Routes → Controller → Service → Script Registry → Task Script
                ↓                                  ↓
           Validation                          Execution
                ↓                                  ↓
           Auth Check                         Database
                ↓                                  ↓
         Audit Logging ←────────────────────── Result
```

## Installation & Setup

### 1. Install Dependencies
```bash
npm install express express-validator mongoose
```

### 2. Import and Mount Routes

In your main `app.js` or `server.js`:

```javascript
import express from 'express';
import createScriptsRouter from './scripts/index.js';
import { authenticate } from './middleware/auth.middleware.js';
import { auditMiddleware } from './middleware/audit.middleware.js';

// Import your models
import User from './user/user.model.js';
import Result from './result/result.model.js';
import Course from './course/course.model.js';
// ... other models

const app = express();

// Middleware
app.use(express.json());
app.use(auditMiddleware);

// Models collection
const models = {
  User,
  Result,
  Course,
  // ... other models
};

// Mount scripts router
app.use('/admin/scripts', createScriptsRouter(models));

// Error handling
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    success: false,
    message: err.message
  });
});
```

### 3. Environment Variables
```env
NODE_ENV=production
JWT_SECRET=your_jwt_secret
MONGODB_URI=your_mongodb_uri
```

## API Reference

### List Available Scripts

Returns all registered scripts with their descriptions.

**Endpoint:** `GET /admin/scripts`

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "recompute-results",
      "description": "Recalculate student results for a given semester and course"
    },
    {
      "name": "fix-missing-fields", 
      "description": "Add missing fields to existing documents"
    },
    {
      "name": "rebuild-master-sheets",
      "description": "Rebuild master result sheets for all departments"
    },
    {
      "name": "migrate-data",
      "description": "Migrate data between collections or update schema"
    }
  ]
}
```

### Execute a Script

Runs a specific script with provided parameters.

**Endpoint:** `POST /admin/scripts/run`

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "script": "recompute-results",
  "params": {
    "semester": "2024-Spring",
    "courseId": "CS101"
  }
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Script executed successfully",
  "result": {
    "summary": {
      "totalProcessed": 150,
      "updated": 150,
      "errors": 0
    },
    "details": {
      "updated": [
        {
          "id": "60d21b4667d0d8992e610c85",
          "student": "60d21b4667d0d8992e610c86",
          "totalMarks": 85,
          "grade": "A"
        }
      ],
      "errors": []
    }
  }
}
```

**Error Responses:**

```json
// 400 Bad Request - Invalid script name
{
  "success": false,
  "message": "Script name is required"
}

// 400 Bad Request - Script not found
{
  "success": false,
  "message": "Script not found"
}

// 400 Bad Request - Invalid parameters
{
  "success": false,
  "message": "Invalid script parameters"
}

// 401 Unauthorized - Missing/invalid token
{
  "success": false,
  "message": "Authentication required"
}

// 403 Forbidden - Not admin
{
  "success": false,
  "message": "Admin access required"
}

// 500 Internal Server Error
{
  "success": false,
  "message": "Script execution failed: <error details>"
}
```

## Creating Scripts

### Script Template

Create a new script in `scripts/tasks/your-script-name.js`:

```javascript
/**
 * @typedef {Object} ScriptParams
 * @property {string} param1 - Description of parameter
 * @property {number} param2 - Description of parameter
 */

export default {
  name: "your-script-name",
  description: "Clear description of what this script does",
  
  /**
   * Execute the script
   * @param {Object} deps - Dependencies
   * @param {Object} deps.models - Database models
   * @param {ScriptParams} params - Script parameters
   * @returns {Promise<Object>} Execution result
   */
  run: async (deps, params) => {
    const { models } = deps;
    const { param1, param2 } = params;
    
    // Validate required parameters
    if (!param1) {
      throw new Error("param1 is required");
    }
    
    try {
      // Your script logic here
      const results = await models.SomeModel.find({});
      
      // Process and return results
      return {
        processed: results.length,
        details: results.map(r => ({
          id: r._id,
          status: "updated"
        }))
      };
    } catch (error) {
      throw new Error(`Script failed: ${error.message}`);
    }
  }
};
```

### Registering the Script

Add your script to `scripts/tasks/index.js`:

```javascript
import yourScriptName from './your-script-name.js';

const scriptRegistry = {
  // ... existing scripts
  [yourScriptName.name]: yourScriptName
};
```

### Script Best Practices

1. **Always validate required parameters**
2. **Use try-catch blocks for error handling**
3. **Return structured, meaningful results**
4. **Keep scripts idempotent when possible**
5. **Add detailed comments for complex logic**
6. **Test scripts in development first**

## Security

### Authentication & Authorization

All routes are protected by the `authenticate("admin")` middleware:

```javascript
router.use(authenticate('admin'));
```

This ensures:
- Valid JWT token is required
- User must have admin role
- Token is verified and not expired

### Script Safety

1. **No Dynamic Code**: Scripts must be pre-registered
2. **Parameter Validation**: All inputs are validated
3. **Execution Wrapping**: Try-catch blocks prevent crashes
4. **Audit Trail**: All actions are logged

### Input Validation Rules

```javascript
// From scripts.validation.js
body('script')
  .notEmpty()
  .isString()
  .matches(/^[a-zA-Z0-9-]+$/) // Only alphanumeric and hyphens

body('params')
  .optional()
  .isObject()
```

## Audit Logging

### Automatic Audit Context

The controller automatically attaches audit context:

```javascript
req.auditContext = {
  userId: req.user._id,
  action: "RUN_SCRIPT",
  entity: "SystemScript", 
  entityId: scriptName,
  newData: { params },
  context: {
    ipAddress: req.ip,
    endpoint: req.originalUrl,
    method: req.method,
    requestId: req.requestId
  },
  reason: "Admin executed system script",
  metadata: {
    script: scriptName,
    success: result.success
  }
};
```

### Sample Audit Log Entry

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "userId": "60d21b4667d0d8992e610c85",
  "action": "RUN_SCRIPT",
  "entity": "SystemScript",
  "entityId": "recompute-results",
  "newData": {
    "params": {
      "semester": "2024-Spring"
    }
  },
  "context": {
    "ipAddress": "192.168.1.100",
    "endpoint": "/admin/scripts/run",
    "method": "POST",
    "requestId": "req_123456"
  },
  "reason": "Admin executed system script",
  "metadata": {
    "script": "recompute-results",
    "success": true
  }
}
```

## Examples

### Example 1: Recompute Results for All Courses

```bash
curl -X POST http://localhost:3000/admin/scripts/run \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "script": "recompute-results",
    "params": {
      "semester": "2024-Spring"
    }
  }'
```

### Example 2: Fix Missing Fields

```bash
curl -X POST http://localhost:3000/admin/scripts/run \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "script": "fix-missing-fields",
    "params": {
      "collection": "Result",
      "fields": ["totalMarks", "grade"],
      "defaultValue": 0
    }
  }'
```

### Example 3: Rebuild Master Sheets

```bash
curl -X POST http://localhost:3000/admin/scripts/run \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "script": "rebuild-master-sheets",
    "params": {
      "academicYear": 2024,
      "department": "Computer Science"
    }
  }'
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Script Not Found
**Error:** `"Script not found"`
**Solution:** 
- Check script name spelling
- Verify script is registered in `tasks/index.js`
- List available scripts using `GET /admin/scripts`

#### 2. Authentication Failed
**Error:** `"Authentication required"`
**Solution:**
- Ensure valid JWT token is provided
- Check token expiration
- Verify user has admin role

#### 3. Database Connection Error
**Error:** `"Script execution failed: MongoError..."`
**Solution:**
- Check MongoDB connection string
- Verify database is running
- Check network connectivity

#### 4. Parameter Validation Error
**Error:** `"Invalid script parameters"`
**Solution:**
- Check required parameters for the script
- Verify parameter types (strings, numbers, etc.)
- Ensure params object is properly formatted

### Debugging Tips

1. **Enable logging:**
```javascript
// In scripts.service.js
console.log(`Executing script: ${scriptName} with params:`, params);
```

2. **Test scripts individually:**
```javascript
// Test script directly
import script from './scripts/tasks/recompute-results.js';
const result = await script.run({ models }, { semester: "2024-Spring" });
```

3. **Check audit logs:**
```javascript
// Query audit logs for script executions
const executions = await AuditLog.find({
  action: "RUN_SCRIPT",
  "metadata.script": "recompute-results"
}).sort({ timestamp: -1 });
```

## Best Practices Summary

✅ **DO:**
- Always test scripts in development first
- Include comprehensive error handling
- Return structured, meaningful results
- Document script parameters and behavior
- Keep scripts focused on single tasks

❌ **DON'T:**
- Execute dynamic code or eval()
- Bypass the registry system
- Expose sensitive data in results
- Run long-running scripts without progress indicators
- Modify script files in production

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review audit logs for error details
3. Test scripts in isolation
4. Verify database connectivity
5. Check admin user permissions

---

This documentation provides everything needed to understand, use, and extend the Script Execution Domain safely and effectively.