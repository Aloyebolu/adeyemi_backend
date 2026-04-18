import express from "express";
import authenticate from "#middlewares/authenticate.js";
import { feedbackController } from "./feedback.controller.js";

const router = express.Router();

// ========== PUBLIC ROUTES ==========
// Submit feedback (can be guest or authenticated)

router.use(authenticate())
router.post("/submit", authenticate(), feedbackController.submitFeedback);

// Get feedback by email (for guests to check their feedback)
router.get("/my-feedback", feedbackController.getMyFeedback);

// Get single feedback (with email verification for guests)
router.get("/:id", feedbackController.getFeedback);

// ========== AUTHENTICATED USER ROUTES ==========
// Get user's own feedback
router.get("/user/my-feedback", authenticate(), feedbackController.getMyFeedback);

// ========== STAFF ROUTES (customer_service and admin) ==========
// Get all feedback with filters
router.get(
  "/admin/all", 
  authenticate(['admin', 'customer_service']), 
  feedbackController.getAllFeedback
);

// Add response to feedback
router.post(
  "/:id/responses", 
  authenticate(['admin', 'customer_service']), 
  feedbackController.addResponse
);

// Update feedback status
router.patch(
  "/:id/status", 
  authenticate(['admin', 'customer_service']), 
  feedbackController.updateStatus
);

// Get feedback statistics
router.get(
  "/admin/stats/overview", 
  authenticate(['admin', 'customer_service']), 
  feedbackController.getStats
);

// Get daily analytics
router.get(
  "/admin/analytics/daily", 
  authenticate(['admin']), 
  feedbackController.getDailyAnalytics
);

// Get available staff for assignment
router.get(
  "/admin/staff/available", 
  authenticate(['admin']), 
  feedbackController.getAvailableStaff
);

// ========== ADMIN ONLY ROUTES ==========
// Assign feedback to staff
router.post(
  "/admin/:id/assign", 
  authenticate(['admin']), 
  feedbackController.assignFeedback
);

// Export feedback data
router.get(
  "/admin/export", 
  authenticate(['admin']), 
  feedbackController.exportFeedback
);

// Delete feedback
router.delete(
  "/admin/:id", 
  authenticate(['admin']), 
  feedbackController.deleteFeedback
);

// ========== FILE UPLOAD ==========
// Upload file (can be used with feedback submission or responses)
router.post(
  "/upload", 
  authenticate(), 
  feedbackController.uploadFile
);

export default router;