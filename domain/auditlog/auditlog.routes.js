import express from "express";
import authenticate from "#middlewares/authenticate.js";
import {
  getAuditLogs,
  getAuditStatistics,
  getEntityHistory,
  getUserActivity,
  exportAuditLogs,
  getSuspiciousActivities,
  markAsReviewed,
  getMyActivity
} from "./auditlog.controller.js";

const router = express.Router();
// User's own activity (accessible by all authenticated users)
router.get("/my-activity", authenticate(), getMyActivity);

// All audit routes require admin access
router.use(authenticate(["admin"]));

// Get audit logs with filtering
router.get("/logs", getAuditLogs);

// Get statistics
router.get("/statistics", getAuditStatistics);

// Get history for specific entity
router.get("/entity/:entity/:entityId", getEntityHistory);

// Get user activity
router.get("/user/:userId/activity", getUserActivity);

// Export logs
router.get("/export", exportAuditLogs);

// Get suspicious activities
router.get("/suspicious", getSuspiciousActivities);

// Mark log as reviewed
router.patch("/:logId/review", markAsReviewed);

export default router;