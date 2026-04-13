Below is a **clear architectural explanation you can place in `README.md`**.
It explains **how the system is expected to work based on the frontend hook implementation**, so future backend adjustments can align with it.

I’ll write it like internal engineering documentation.

---

# Computation Monitoring System

Architecture and Expected Backend Behaviour

This document explains how the **Realtime Computation Monitoring system** is expected to function based on the current frontend implementation.

The frontend relies on **live logs streamed from the backend** to derive computation progress, metrics, and operational insights.

The backend does **not send a dedicated progress API**. Instead, it sends **structured logs via WebSocket**, which the frontend interprets to compute progress and metrics.

---

# System Architecture

The monitoring system is built around a **log-driven telemetry model**.

```
Computation Engine
       │
       │
     Logger
       │
       │
   LogGateway
       │
       │
 SocketGateway
       │
       │
    Socket.IO
       │
       │
Frontend Monitoring Hook
```

Each component has a defined responsibility.

| Component     | Responsibility                              |
| ------------- | ------------------------------------------- |
| Logger        | Creates structured log entries              |
| LogGateway    | Batches and routes logs                     |
| SocketGateway | Sends logs to subscribed websocket channels |
| Socket.IO     | Streams logs to connected clients           |
| Frontend Hook | Interprets logs to compute metrics          |

---

# Frontend Monitoring Model

The frontend monitoring logic is implemented in:

```
useComputationMonitor.ts
```

This hook subscribes to logs for a **specific computation scope**.

Monitoring is started using:

```
startMonitoring(computationId)
```

This performs two actions:

1. Stores the computation ID locally.
2. Subscribes to websocket logs using the computation scope.

```
subscribe({ scopeId: computationId })
```

This ensures the frontend only receives logs related to that specific computation.

---

# Log Streaming Model

The backend emits logs with the following structure:

```
{
  timestamp: number,
  level: "info" | "warn" | "error" | "debug",
  message: string,
  domain: string,
  scopeId: string,
  data?: object
}
```

Example:

```
{
  "timestamp": 1710203400000,
  "level": "info",
  "message": "Starting department",
  "domain": "computation",
  "scopeId": "comp_93jf83jf",
  "data": {
    "departmentId": "CSC",
    "departmentName": "Computer Science"
  }
}
```

Logs are delivered through the websocket event:

```
log_event
```

---

# Frontend Monitoring Behaviour

The monitoring hook processes incoming logs to derive metrics.

Metrics include:

```
progress
errors
warnings
departmentsProcessed
studentsProcessed
processingSpeed
estimatedTimeRemaining
```

The hook **does not receive these metrics directly** from the backend.

Instead, they are derived from the logs.

---

# Computation Lifecycle (Expected Log Flow)

A computation should produce logs representing its lifecycle.

Typical flow:

```
Starting computation
Starting department
Processing student batch
Batch completed
Department completed
Computation completed
```

Each stage emits logs that allow the frontend to update the monitoring dashboard.

---

# Computation Start

When a computation begins, the backend should emit a log indicating the start of the process.

Example:

```
logger.info("Starting computation", {
  domain: "computation",
  scopeId,
  data: {
    totalDepartments,
    totalStudents,
    totalOperations
  }
})
```

This allows the frontend to determine:

• total work expected
• progress calculation baseline

---

# Department Processing

When department processing begins:

```
logger.info("Starting department", {
  domain: "computation",
  scopeId,
  data: {
    departmentId,
    departmentName
  }
})
```

When department processing completes:

```
logger.info("Department completed", {
  domain: "computation",
  scopeId,
  data: {
    departmentId
  }
})
```

The frontend uses these logs to track:

```
departmentsProcessed
currentDepartment
```

---

# Student Batch Processing

Student processing usually happens in batches.

Batch start example:

```
logger.debug("Processing student batch", {
  domain: "computation",
  scopeId,
  data: {
    count: batchSize
  }
})
```

Batch completion example:

```
logger.info("Batch completed", {
  domain: "computation",
  scopeId,
  data: {
    count: batchSize,
    completed: processedStudents
  }
})
```

These logs allow the frontend to track:

```
studentsProcessed
completedOperations
```

---

# Computation Completion

When the computation finishes:

```
logger.info("Computation completed", {
  domain: "computation",
  scopeId
})
```

The frontend detects completion when logs contain messages such as:

```
completed
finished
done
```

At this point:

```
progress = 100%
endTime = timestamp
```

---

# Derived Metrics

The frontend derives metrics by interpreting logs.

Examples:

### Progress

```
completedOperations / totalOperations
```

or

```
departmentsProcessed / totalDepartments
```

or

```
studentsProcessed / totalStudents
```

depending on available metadata.

---

### Estimated Time Remaining

Calculated using:

```
elapsedTime / progress
```

This estimates the total runtime and remaining duration.

---

### Processing Speed

The frontend measures how many logs arrive per time window to approximate processing speed.

```
items processed per second
```

---

# Error Tracking

Errors are detected from logs with level:

```
error
```

Example:

```
logger.error("Failed to process department", {
  domain: "computation",
  scopeId,
  data: {
    departmentId
  }
})
```

The frontend uses these logs to:

• count errors
• identify failed departments

---

# Monitoring Lifecycle

Monitoring typically follows this sequence.

### 1 Start computation

```
POST /compute
```

Response:

```
{
  computationId: "comp_123"
}
```

---

### 2 Start monitoring

```
startMonitoring(computationId)
```

This subscribes to:

```
scope_<computationId>
```

---

### 3 Logs stream in real time

```
log_event
log_event
log_event
```

---

### 4 Frontend derives metrics

Metrics update automatically as logs arrive.

---

### 5 Computation finishes

A completion log is received.

Monitoring ends automatically.

---

# Important Notes

The monitoring system is **log-driven**.

This means:

• progress is derived from logs
• metrics are derived from logs
• no dedicated progress API exists

For accurate monitoring, backend logs should contain **structured metadata** when possible.

Examples:

```
data.totalStudents
data.totalDepartments
data.completed
data.count
data.departmentId
```

Without this metadata, some monitoring metrics may not update correctly.

---

# Summary

The computation monitoring system works by **streaming logs from the backend and interpreting them on the frontend**.

The frontend hook:

• subscribes to computation-specific logs
• processes incoming log events
• derives operational metrics
• updates the monitoring UI in real time

This design allows computation monitoring without introducing additional APIs or polling mechanisms.

---

If you'd like, I can also help you add a **small backend "Computation Event Standard"** that will make this system **far more stable and predictable**, because right now the frontend is parsing log text like `"starting department"` which is fragile. A tiny event protocol would make the monitoring system extremely robust. 🚀📡📊⚙️🧠✨
