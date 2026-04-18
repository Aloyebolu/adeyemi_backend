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
