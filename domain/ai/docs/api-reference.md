### File 2: `docs/api-reference.md`

```markdown
# AI Module API Reference

## Base URL
`/api/ai`

## Authentication
All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

---

## Chat Endpoints

### POST `/chat/stream`
Stream chat responses via Server-Sent Events (SSE).

**Request Body:**
```json
{
  "message": "Show me all students in Computer Science",
  "conversation_id": "optional-existing-conversation-id"
}
```

**Response (SSE Stream):**
```
data: {"type":"status","text":"🔍 Understanding your request..."}
data: {"type":"status","text":"📌 Intent detected: READ"}
data: {"type":"status","text":"📊 Generating database query..."}
data: {"type":"content","text":"| Name | Matric | Department |\n|------|--------|------------|\n"}
data: {"type":"content","text":"| John Doe | CS2023/001 | Computer Science |\n"}
data: {"type":"status","text":"✅ Response complete"}
event: end
data: [DONE]
```

**Event Types:**
- `status` - Status updates (thinking, querying, analyzing)
- `content` - Actual content chunks (markdown)
- `action` - Action button to render
- `error` - Error messages
- `end` - Stream completion

---

### POST `/chat`
Non-streaming chat endpoint for simple requests.

**Request Body:**
```json
{
  "message": "How many students are in Computer Science?",
  "conversation_id": "optional-conversation-id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Found 342 students in Computer Science department.",
    "conversation_id": "507f1f77bcf86cd799439011"
  }
}
```

---

## Conversation Management

### GET `/conversations`
List user conversations.

**Query Parameters:**
- `limit` (optional) - Number of conversations (default: 20, max: 100)
- `offset` (optional) - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "title": "Student Search",
        "message_count": 5,
        "last_activity": "2024-01-01T00:00:00.000Z",
        "created_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 3,
      "has_more": false
    }
  }
}
```

### GET `/conversations/:id`
Get a specific conversation with all messages.

**Response:**
```json
{
  "success": true,
  "data": {
    "conversation": {
      "_id": "507f1f77bcf86cd799439011",
      "title": "Student Search",
      "messages": [
        {
          "role": "user",
          "content": "Show me students in Computer Science",
          "timestamp": "2024-01-01T00:00:00.000Z"
        },
        {
          "role": "assistant",
          "content": "| Name | Matric |\n|------|--------|\n| John Doe | CS2023/001 |",
          "actions": [...],
          "timestamp": "2024-01-01T00:00:02.000Z"
        }
      ],
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:02.000Z"
    }
  }
}
```

### DELETE `/conversations/:id`
Delete a conversation.

**Response:**
```json
{
  "success": true,
  "message": "Conversation deleted successfully"
}
```

---

## User Preferences

### GET `/preferences`
Get current user preferences.

**Response:**
```json
{
  "success": true,
  "data": {
    "display": {
      "default_format": "auto",
      "table_threshold": 20,
      "summary_threshold": 50,
      "auto_export_threshold": 100,
      "show_previews": true,
      "compact_mode": false
    },
    "export": {
      "default_format": "excel",
      "include_headers": true,
      "date_format": "YYYY-MM-DD"
    },
    "analysis": {
      "auto_analyze": false,
      "max_depth": 2,
      "include_recommendations": true
    },
    "saved_queries": [
      {
        "name": "CS Students",
        "query": { "role": "student", "department": "Computer Science" },
        "last_used": "2024-01-01T00:00:00.000Z",
        "usage_count": 5
      }
    ]
  }
}
```

### PUT `/preferences`
Update user preferences.

**Request Body:**
```json
{
  "display": {
    "default_format": "table",
    "compact_mode": true
  },
  "export": {
    "default_format": "csv"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Preferences updated successfully",
  "data": { ... }
}
```

### PUT `/preferences/display`
Update only display preferences.

**Request Body:**
```json
{
  "default_format": "summary",
  "table_threshold": 30
}
```

### PUT `/preferences/export`
Update only export preferences.

**Request Body:**
```json
{
  "default_format": "excel",
  "include_headers": true
}
```

---

## Saved Queries

### GET `/preferences/queries`
Get all saved queries.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "CS Students",
      "description": "All Computer Science students",
      "query": { "role": "student", "department": "Computer Science" },
      "last_used": "2024-01-01T00:00:00.000Z",
      "usage_count": 5
    }
  ]
}
```

### POST `/preferences/queries`
Save a new query.

**Request Body:**
```json
{
  "name": "CS Students",
  "description": "All Computer Science students",
  "query": {
    "collection": "users",
    "operation": "find",
    "query": { "role": "student", "department": "Computer Science" },
    "limit": 100
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Query saved successfully",
  "data": { ... }
}
```

### DELETE `/preferences/queries/:name`
Delete a saved query.

**Response:**
```json
{
  "success": true,
  "message": "Query deleted successfully"
}
```

### POST `/preferences/format`
Get effective format based on preferences and data size.

**Request Body:**
```json
{
  "dataSize": 150
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "format": "export",
    "dataSize": 150
  }
}
```

---

## Export Endpoints

### GET `/exports/:fileId`
Download an exported file.

**Response:**
- Success: File download with appropriate MIME type
- Failure: 404 Not Found

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "success": false,
  "message": "Error message",
  "statusCode": 400
}
```

**Common Status Codes:**
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

---

## Rate Limits

| User Role | Requests per Minute |
|-----------|---------------------|
| Admin     | 100                 |
| Dean/HOD  | 50                  |
| Lecturer  | 30                  |
| Student   | 10                  |

## WebSocket Support (Future)

When WebSocket support is added:
```
ws://localhost:3000/api/ai/ws?token=xxx
```

**Message Format:**
```json
{
  "type": "message",
  "data": {
    "content": "Show me students",
    "conversation_id": "optional"
  }
}
```

---

## SDK Examples

### JavaScript/React
```javascript
// SSE Streaming
const eventSource = new EventSource('/api/ai/chat/stream', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ message: 'Show me students' })
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'content') {
    appendToChat(data.text);
  }
};

// Non-streaming
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ message: 'How many students?' })
});
```

### cURL Examples
```bash
# Streaming chat
curl -X POST http://localhost:3000/api/ai/chat/stream \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Show me students in Computer Science"}' \
  --no-buffer

# Get conversations
curl -X GET http://localhost:3000/api/ai/conversations \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update preferences
curl -X PUT http://localhost:3000/api/ai/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"display":{"default_format":"table"}}'
```
```

---

