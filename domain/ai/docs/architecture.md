# AI Module Architecture

## Overview

The AI module is a sophisticated orchestration layer that provides natural language interaction with the university management system. It combines intelligent query generation, data analysis, and safe action execution with a pluggable AI provider architecture.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend Layer                              │
│            (React/Next.js with SSE Streaming)                    │
└─────────────────────────────────────────────────────────────────┘
                              ↕ SSE
┌─────────────────────────────────────────────────────────────────┐
│                      API Layer                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Controllers                                              │  │
│  │  - Chat (Streaming & Non-streaming)                      │  │
│  │  - Conversation Management                               │  │
│  │  - User Preferences                                      │  │
│  │  - Export Management                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                   Orchestration Layer                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AI Orchestrator                                          │  │
│  │  - Intent Classification                                  │  │
│  │  - Request Routing                                        │  │
│  │  - Response Streaming                                     │  │
│  │  - Session Management                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    Intelligence Engines                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │ Query Engine │ │Analysis Engine│ │ Action Engine│          │
│  │ - Generation │ │ - Statistics │ │ - Generation │          │
│  │ - Execution  │ │ - Patterns   │ │ - Validation │          │
│  │ - Caching    │ │ - Insights   │ │ - Confirmation│          │
│  └──────────────┘ └──────────────┘ └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    AI Provider Layer                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AI Provider Interface (Pluggable)                       │  │
│  │  - Mock Provider (Testing)                               │  │
│  │  - OpenAI Provider (Production)                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    Data Layer                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │   MongoDB    │ │ File Storage │ │   Redis      │          │
│  │  (Primary)   │ │  (Exports)   │ │  (Cache)     │          │
│  └──────────────┘ └──────────────┘ └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. AI Orchestrator
**File:** `services/ai.orchestrator.service.js`

The central brain that coordinates all AI operations:
- Routes requests based on intent (READ/WRITE/ANALYSIS/EXPORT)
- Manages streaming sessions
- Formats responses
- Handles errors gracefully

**Key Methods:**
```javascript
processMessage(userId, message, conversationId, sseStream)
handleReadOperation(session, message, intent)
handleWriteOperation(session, message, intent)
handleAnalysisOperation(session, message, intent)
handleExportOperation(session, message, intent)
```

### 2. AI Provider System
**Files:** `providers/`

Pluggable architecture supporting multiple AI providers:

**Base Provider:** `base.provider.js`
- Abstract class defining required methods
- All providers must implement:
  - `generateResponse()` - Simple text response
  - `streamResponse()` - Streaming response
  - `classifyIntent()` - Intent classification
  - `generateQuery()` - MongoDB query generation
  - `analyzeData()` - Data analysis
  - `generateAction()` - Action generation

**Mock Provider:** `mock.provider.js`
- Simulates AI responses for testing
- Configurable delay and error simulation
- Keyword-based intent detection
- Predefined query templates

**OpenAI Provider:** `openai.provider.js` (Future)
- Real OpenAI API integration
- GPT-4 model support
- Tool calling for structured responses

### 3. Query Engine
**File:** `engines/query.engine.js`

Handles all database operations:
- Executes MongoDB queries safely
- Applies permission filters
- Caches frequent queries
- Enforces limits (rows, timeout)
- Provides query explain functionality

**Supported Operations:**
- `find` - Basic queries with projection, sort, limit
- `aggregate` - Complex aggregations with pipelines
- `count` - Document counting
- `distinct` - Unique value extraction

### 4. Analysis Engine
**File:** `engines/analysis.engine.js`

Performs intelligent data analysis:
- Statistical calculations (mean, median, std dev, percentiles)
- Pattern detection
- Outlier identification
- Correlation analysis
- Insight generation
- Recommendations

**Analysis Types:**
- **Descriptive:** What happened?
- **Diagnostic:** Why did it happen?
- **Predictive:** What might happen?
- **Prescriptive:** What should we do?

### 5. Action Engine
**File:** `engines/action.engine.js`

Manages user actions:
- Maps intents to API endpoints
- Builds payloads from entities
- Generates confirmation messages
- Validates required fields
- Creates action previews

**Registered Actions:**
- `terminate_student` - Remove student from system
- `update_student` - Update student information
- `suspend_student` - Temporary suspension
- `promote_lecturer` - Role promotion
- `reset_password` - Password reset email
- `bulk_export` - Large data exports

### 6. Formatters
**Files:** `formatters/`

Format data for different output types:

**Markdown Formatter:** `markdown.formatter.js`
- Tables for tabular data
- Key-value for single objects
- Lists for collections
- Analysis results formatting
- Error messages
- Success confirmations

**Export Formatter:** `export.formatter.js`
- Excel (XLSX) with auto-sized columns
- CSV with custom delimiters
- JSON with pretty print
- Temporary file management
- Auto-cleanup after 24 hours

### 7. Session Management
**File:** `services/ai.session.service.js`

Manages active chat sessions:
- Buffers streaming responses
- Flushes to database on completion
- Tracks session status (idle, thinking, querying, analyzing, streaming)
- Auto-cleanup of inactive sessions (30 min timeout)
- Per-conversation state management

### 8. Audit Service
**File:** `services/ai.audit.service.js`

Comprehensive logging:
- Query execution logs
- Action execution logs
- Conversation transcripts
- Error tracking
- User activity tracking
- Performance metrics

## Data Flow

### Read Operation Flow
```
User: "Show me all students in Computer Science"
    ↓
1. Intent Classification
   → Type: READ, Confidence: 0.95
    ↓
2. Query Generation
   → { collection: "users", query: { role: "student", department: "CS" }, limit: 1000 }
    ↓
3. Query Execution
   → MongoDB query with permission filters
    ↓
4. Format Results
   → Markdown table (if ≤20 rows) or summary/export (if larger)
    ↓
5. Stream Response
   → SSE chunks to frontend
```

### Write Operation Flow
```
User: "Terminate student Daniel Damilola"
    ↓
1. Intent Classification
   → Type: WRITE, Action: terminate_student
    ↓
2. Entity Extraction
   → { name: "Daniel Damilola", matric: "BUS2023/023" }
    ↓
3. Action Generation
   → { endpoint: "/api/students/terminate", payload: {...}, confirmation: {...} }
    ↓
4. Send Action Button
   → Frontend renders confirmable button
    ↓
5. User Confirms
   → Frontend calls API endpoint
    ↓
6. Action Executed
   → Database update, audit log
    ↓
7. Result Displayed
   → Success message with next actions
```

## Security Architecture

### Permission Layers
1. **Authentication:** JWT tokens with user roles
2. **Authorization:** Role-based access control (RBAC)
3. **Data Filtering:** Automatic department/faculty restrictions
4. **Field Masking:** Sensitive fields automatically removed
5. **Query Validation:** No dangerous operators allowed

### Safety Features
- **Input Sanitization:** No HTML/script injection
- **Rate Limiting:** Per user and per conversation
- **Query Limits:** Max 10,000 rows, 30 second timeout
- **Export Limits:** Max 50,000 rows per export
- **Audit Trail:** All actions logged

## Performance Considerations

### Caching Strategy
- **Query Cache:** 5 minutes TTL for identical queries
- **Analysis Cache:** 30 minutes TTL for analysis results
- **Session Cache:** In-memory with 30 minute timeout
- **Export Cache:** Temporary files with 24 hour retention

### Optimization Techniques
- Index hints for frequent queries
- Projection to reduce data transfer
- Pagination for large datasets
- Streaming for real-time responses
- Batch writes for audit logs

## Error Handling

### Error Categories
1. **User Errors:** Invalid input, missing required fields
2. **Permission Errors:** Unauthorized access
3. **Database Errors:** Timeout, connection issues
4. **AI Provider Errors:** API failures, rate limits
5. **System Errors:** Memory issues, configuration errors

### Error Response Format
```json
{
  "success": false,
  "error": "User-friendly error message",
  "details": "Technical details (development only)",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Scaling Considerations

### Horizontal Scaling
- Sessions stored in Redis for multi-node deployment
- Database indexes for query performance
- Read replicas for analytical queries
- Queue system for export jobs

### Vertical Scaling
- Connection pooling for database
- Worker threads for CPU-intensive analysis
- Stream compression for large responses

## Future Enhancements

1. **WebSocket Support** - Replace SSE for bidirectional communication
2. **Redis Integration** - Distributed session storage and caching
3. **Vector Database** - Semantic search capabilities
4. **Fine-tuning** - Custom models for university domain
5. **RAG (Retrieval Augmented Generation)** - Document-aware responses
6. **Voice Support** - Speech-to-text and text-to-speech
7. **Multi-language** - Internationalization support
```

---

