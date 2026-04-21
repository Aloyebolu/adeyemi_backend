// import connectDB from "./config/db.js";
// await connectDB();


import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";
import path from "path";
import versionRoute from './version.js'

// Import audit logging middleware
import { auditMiddleware, authAuditMiddleware } from "./domain/auditlog/index.js";

// Your existing routes
import routes from "./routes/index.js";
import { createServer } from "http";
import authenticate, { attachRequestIntent, attachUser, blockWritesForReadOnly, resolveArchiveMode } from "./middlewares/authenticate.js";
import errorHandler from "./middlewares/errorHandler.js";
import { initializeRankingDomain } from "./domain/ranking/index.js";
import { setIO, setupFeedbackSocketServer } from "./domain/feedback/feedback.socket.js";
import { register, httpRequestDuration } from "./metrics.js";
import { detect_honeytoken } from "./domain/auth/services/token/HoneyToken.js";
import { setupSocketServer } from "./domain/chat/chat.socket.js";
import {  enforceRequestIntent } from "./domain/auditlog/auditlog.middleware.js";
// import { setupSocketServer } from "./domain/chat/chat.socket.js";

export const allowedOrigins = [
  "https://adeyemi-frontend-cslixwj57-breakthrough-s-projects.vercel.app",
  "https://adeyemi-frontend.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://192.168.172.186:3000",
  'http://10.89.207.186:3000'
];

// Create express app
const app = express();
app.set("trust proxy", 1);

// ============================================
// 1. CORS Configuration
// ============================================
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

// metrics

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;

    const route = req.route?.path || req.baseUrl || "unknown";

    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);
  });

  next();
});

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use('/api', versionRoute);

const server = createServer(app);

// // Setup Socket.io
// setupSocketServer(server);


// Firstly detect for honey tokens

// ============================================
// 2. Basic Middleware
// ============================================

// app.use(cors({ origin: allowedOrigins }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(fileUpload());

app.use(detect_honeytoken);
// ============================================
// 3. REQUEST ID MIDDLEWARE (Essential for audit logs)
// ============================================
app.use((req, res, next) => {
  // Generate unique request ID
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Set request ID in response headers for debugging
  res.setHeader("X-Request-ID", req.requestId);

  // Also set server timing headers
  req._startTime = Date.now();

  next();
});


// ============================================
// 4. HEALTH CHECK ENDPOINT (Excluded from audit)
// ============================================
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    requestId: req.requestId
  });
});
app.use(attachUser); // attaches req.user, 
app.use(attachRequestIntent)//attaches req._intent
app.use(enforceRequestIntent) 
app.use(blockWritesForReadOnly);
app.use(resolveArchiveMode); // to handle archive mode if needed


// ============================================
// 7. GENERAL AUDIT MIDDLEWARE
// (Captures all HTTP requests after auth)
// ============================================
app.use(auditMiddleware({
  enabled: process.env.NODE_ENV !== "test", // Disable in test environment
  skipMethods: ["GET", "OPTIONS", "HEAD"], // Skip read-only methods
  skipPaths: [
    "/health",
    "/favicon.ico",
    "/public/",
    "/static/",
    "/uploads/",
    "/afued/result/portal/audit" // Don't audit audit endpoints
  ],
  logRequestBody: false, // Set to true for debugging (beware of sensitive data)
  logQueryParams: false,
  sensitiveFields: [
    "password",
    "token",
    "secret",
    "refreshToken",
    "creditCard",
    "ssn",
    "pin"
  ]
}));

// const feedbackIO = setupFeedbackSocketServer(server);
// setIO(feedbackIO);


// ============================================
// 8. MAIN ROUTES
// ============================================
app.use("/afued/result/portal", routes);

// Initialize ranking domain after the main routes
// await initializeRankingDomain(app, {
//   enableScheduler: true
// });


// Error handler
app.use(errorHandler)

// ============================================
// 9. ERROR HANDLING MIDDLEWARE (with audit logging)
// ============================================
app.use((error, req, res, next) => {
  console.error("Global error handler:", error);

  // Log error to audit system
  if (req.user) {
    // We'll handle this in the audit middleware itself
    // The error will be captured by the response status code
  }

  // Send error response
  const statusCode = error.status || 500;
  const message = error.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    message,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === "development" && { stack: error.stack })
  });
});



// ============================================
// 10. 404 HANDLER (with audit logging)
// ============================================Endpoint not found
app.use((req, res) => {
  // This will be captured by the audit middleware (404 status code)
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
    requestId: req.requestId,
    path: req.originalUrl,
    method: req.method
  });


});



export default app;