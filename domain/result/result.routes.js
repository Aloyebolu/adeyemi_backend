import express from "express";
import {
  uploadResult,
  bulkUploadResults,
  getAllResults,
  getResultById,
  updateResult,
  approveResult,
  lockResult,
  getResultAnalytics,
  deleteResult,
  getResultsForStudent,
  previewStudentResult,
  previewTranscript,
  downloadTranscript,
  downloadStudentResult,
} from "./result.controller.js";

import authenticate from "#middlewares/authenticate.js";
import { fileHandler } from "#middlewares/fileHandler.js";
import { auditLogger } from "#middlewares/auditLogger.js";
import { getCourseResultStats, getLecturerStats, getResultStats } from "./resultStats.controller.js";

const router = express.Router();

/**
 * =====================================
 * 🧑‍🏫 Lecturer / HOD / Admin Routes
 * =====================================
 */

// Upload single result  → POST /results/upload
router.post(
  "/upload/:courseId",
  authenticate(["lecturer", "hod", "admin"]),
  uploadResult
);

router.get(
  "/student/:studentId",
  authenticate(["hod", "admin"]),
  getResultsForStudent
)

router.post(
  "/upload-student/:studentId",
  authenticate(["hod", "admin"]),
  uploadResult
);

// Bulk upload results → POST /results/bulk
router.post(
  "/bulk",
  authenticate(["lecturer", "hod", "admin"]),
  fileHandler("excel"),
  bulkUploadResults
);

// Update existing result → PATCH /results/edit/:id
router.patch(
  "/edit/:id",
  authenticate(["lecturer", "hod"]),
  updateResult
);

/**
 * =====================================
 * 🧠 HOD / Admin Routes
 * =====================================
 */

// Approve a result → PATCH /results/:id/approve
router.patch(
  "/:id/approve",
  authenticate("hod"),
  approveResult
);

// Lock a result → PATCH /results/:id/lock
router.patch(
  "/:id/lock",
  authenticate(["hod", "admin"]),
  lockResult
);

// Paginated all results → GET /results/all
router.get(
  "/all",
  authenticate(["admin", "hod"]),
  getAllResults
);

// Analytics summary → GET /results/analytics
router.get(
  "/analytics",
  authenticate(["admin", "hod"]),
  getResultAnalytics
);

/**
 * =====================================
 * 📊 Shared Routes (All Staff)
 * =====================================
 */


router.get('/stats', authenticate('hod', 'admin'), getResultStats);

// Get single result → GET /results/:id
router.get(
  "/:id",
  authenticate(["admin", "hod", "lecturer"]),
  getResultById
);

// Delete a result (Admin only) → DELETE /results/:id
router.delete(
  "/:id",
  authenticate("admin"),
  deleteResult
);



/**
 * @route   GET /api/student-results/download/:studentId/:semesterId/:level
 * @desc    Download student semester result as PDF
 * @access  Private (Student, Staff, Admin, HOD)
 */
router.get(
  "/download/:studentId/",
  authenticate(),
  downloadStudentResult
);

/**
 * @route   GET /api/student-results/transcript/:studentId
 * @desc    Download academic transcript as PDF
 * @access  Private (Student, Admin, Registrar)
 */
router.get(
  "/transcript/:studentId",
  authenticate(),
  downloadTranscript
);

// ==================== PREVIEW ROUTES (HTML) ====================

/**
 * @route   GET /api/student-results/preview/:studentId/:semesterId/:level
 * @desc    Preview student result as HTML
 * @access  Private (Student, Staff, Admin, HOD)
 */
router.get(
  "/preview/:studentId/",
  authenticate(),
  previewStudentResult
);

/**
 * @route   GET /api/student-results/transcript/preview/:studentId
 * @desc    Preview transcript as HTML
 * @access  Private (Student, Staff, Admin, Registrar)
 */
router.get(
  "/transcript/preview/:studentId",
  authenticate(),
  previewTranscript
);



router.get('/stats/lecturers', authenticate('hod', 'admin'), getLecturerStats);
router.get('/stats/:courseId', authenticate('hod', 'admin'), getCourseResultStats);
export default router;
