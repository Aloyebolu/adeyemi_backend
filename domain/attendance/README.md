## Database Models

### AttendanceSession
Represents a single attendance session for a course.

**Fields:**
- `assignment`: Reference to CourseAssignment
- `course`: Reference to Course
- `lecturer`: Reference to Lecturer (primary lecturer)
- `co_lecturers`: Array of co-lecturers
- `semester`: Reference to AcademicSemester
- `session_date`: Date of the session
- `start_time`, `end_time`: Session timing
- `topic`: Session topic (optional)
- `attendance_method`: ["manual", "qr_code", "biometric"]
- `qr_code_token`: Unique token for QR-based attendance
- `is_active`: Session status
- `total_students`, `present_count`: Attendance counts
- `created_by`, `created_by_role`: Creator information

### AttendanceRecord
Individual attendance records for each student.

**Fields:**
- `session`: Reference to AttendanceSession
- `student`: Reference to Student
- `status`: ["present", "absent", "late"]
- `check_in_time`: Timestamp of attendance
- `check_in_method`: ["manual", "qr_code", "biometric"]
- `marked_by`, `marked_by_role`: Who marked the attendance
- `remarks`: Additional notes

## API Endpoints

### Authentication
All endpoints require JWT authentication. Include token in Authorization header:
```
Authorization: Bearer <your-token>
```

### Attendance Session Management

#### Create Attendance Session
**POST** `/api/attendance/sessions`

**Permissions:** Lecturer, Course Rep

**Request Body:**
```json
{
  "assignment_id": "course_assignment_id",
  "date": "2024-01-15",
  "start_time": "09:00",
  "end_time": "11:00",
  "topic": "Introduction to Algorithms",
  "method": "qr_code"
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "_id": "session_id",
    "qr_code_token": "generated_token",
    "session_date": "2024-01-15T00:00:00.000Z",
    "is_active": true,
    "attendance_method": "qr_code"
  }
}
```

#### Toggle Session Status
**PUT** `/api/attendance/sessions/:id/status`

**Permissions:** Lecturer

**Request Body:**
```json
{
  "is_active": false
}
```

### Attendance Marking

#### Mark Individual Attendance
**POST** `/api/attendance/mark`

**Permissions:** Lecturer, Course Rep

**Request Body:**
```json
{
  "session_id": "session_id",
  "student_id": "student_id",
  "method": "manual"
}
```

#### Bulk Mark Attendance
**POST** `/api/attendance/mark/bulk`

**Permissions:** Lecturer only

**Request Body:**
```json
{
  "session_id": "session_id",
  "attendance_list": [
    {
      "student_id": "student_1",
      "status": "present",
      "method": "manual"
    },
    {
      "student_id": "student_2",
      "status": "late",
      "method": "qr_code"
    }
  ]
}
```

### Reports & Analytics

#### Get Attendance Report
**GET** `/api/attendance/report/assignment/:assignment_id`

**Query Parameters:**
- `start_date`: Start date for filtering (YYYY-MM-DD)
- `end_date`: End date for filtering (YYYY-MM-DD)
- `group_by`: ["date", "week"] for grouping results

#### Get Student Attendance Analytics
**GET** `/api/attendance/analytics/student`

**Query Parameters:**
- `student_id`: Student ID (required)
- `course_id`: Course ID (optional)
- `semester_id`: Semester ID (optional)

**Response:**
```json
{
  "success": true,
  "analytics": [
    {
      "course_id": "course_id",
      "course_name": "Introduction to Programming",
      "semester_id": "semester_id",
      "total_sessions": 12,
      "present_count": 10,
      "late_count": 1,
      "absent_count": 1,
      "attendance_rate": 91.67,
      "trend": "GOOD"
    }
  ],
  "overall": {
    "total_sessions": 12,
    "total_present": 10,
    "total_late": 1,
    "total_absent": 1,
    "overall_rate": 91.67
  }
}
```

#### Get Course Attendance Analytics
**GET** `/api/attendance/analytics/course`

**Query Parameters:**
- `course_id`: Course ID (required)
- `semester_id`: Semester ID (optional)

## Role Permissions

| Action | Lecturer | Co-Lecturer | Course Rep | Admin |
|--------|----------|-------------|------------|-------|
| Create Session | ✅ | ❌ | ✅ (Own course only) | ❌ |
| Toggle Session Status | ✅ | ✅ | ❌ | ❌ |
| Mark Individual | ✅ | ✅ | ✅ (Own course only) | ✅ |
| Bulk Mark | ✅ | ✅ | ❌ | ✅ |
| View All Reports | ✅ | ✅ | ❌ | ✅ |
| View Analytics | ✅ | ✅ | ✅ (Own data only) | ✅ |

## Audit Logging

All attendance operations automatically generate audit logs with the following structure:

```javascript
req.auditContext = {
  action: "ACTION_TYPE",           // e.g., "CREATE_ATTENDANCE_SESSION"
  resource: "ResourceType",        // e.g., "AttendanceSession"
  severity: "SEVERITY_LEVEL",      // "LOW", "MEDIUM", "HIGH"
  entityId: "entity_id",           // ID of the affected entity
  status: "SUCCESS/FAILURE",
  reason: "Description of action",
  changes: {                        // For update operations
    before: { /* previous state */ },
    after: { /* new state */ },
    changedFields: ["field1", "field2"]
  },
  metadata: {                       // Additional context
    userId: "user_id",
    userRole: "user_role",
    timestamp: "2024-01-15T10:30:00Z"
  }
};
```

## Analytics Features

### Student-Level Analytics
- Overall attendance rate per course/semester
- Trend analysis (Improving/Declining/Stable/At Risk)
- Consecutive attendance/absence tracking
- Late arrival patterns

### Course-Level Analytics
- Daily/weekly attendance trends
- Session-by-session breakdown
- Student participation heatmaps
- Comparative analysis across sections

### Institutional Analytics
- Department-wise attendance statistics
- Lecturer performance metrics
- Time-of-day analysis for optimal scheduling
- Predictive analytics for at-risk students

## Integration with Student Model

The system automatically updates student attendance statistics:

```javascript
// In student model
attendance_stats: {
  overall_attendance_rate: 85.5,
  course_attendance_rate: 90.2,      // Current course rate
  trend: "IMPROVING",                // ["IMPROVING", "DECLINING", "STABLE", "AT_RISK"]
  last_updated: "2024-01-15T10:30:00Z",
  sessions_attended: 45,
  sessions_missed: 5,
  consecutive_present: 8,
  consecutive_absent: 0
}
```

## Error Handling

All endpoints use consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",        // Optional error code
  "details": { }               // Additional error details
}
```

**Common Error Codes:**
- `AUTH_REQUIRED`: Authentication required
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `SESSION_NOT_FOUND`: Attendance session not found
- `DUPLICATE_ATTENDANCE`: Attendance already marked
- `SESSION_CLOSED`: Session is no longer active

