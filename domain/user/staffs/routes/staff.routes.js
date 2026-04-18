import { Router } from "express";
import * as StaffController from "../controllers/staff.controller.js";
import authenticate from "#middlewares/authenticate.js";

const router = Router();

// ============================================
// SEARCH & STATISTICS (Most Specific First)
// ============================================

// Search staff
router.get(
  "/search",
  authenticate(["admin", "super_admin", "registrar", "staff"]),
  StaffController.searchStaff
);

// Get staff statistics
router.get(
  "/statistics",
  authenticate(["admin", "super_admin", "registrar"]),
  StaffController.getStaffStatistics
);

// Get staff by custom staff ID
router.get(
  "/staff-id/:staffId",
  authenticate(["admin", "super_admin", "registrar", "staff"]),
  StaffController.getStaffByStaffId
);

// ============================================
// BULK OPERATIONS
// ============================================

// Bulk create staff records
router.post(
  "/bulk",
  authenticate(["admin", "super_admin"]),
  StaffController.bulkCreateStaff
);

// ============================================
// STAFF CRUD (Dynamic ID routes - MUST BE LAST)
// ============================================

// Get all staff OR Create new staff (POST handles both query and creation)
router.post(
  "/",
  authenticate(["admin", "super_admin", "registrar", "staff"]),
  StaffController.createStaff
);

// Get all staff (simple GET)
router.get(
  "/",
  authenticate(["admin", "super_admin", "registrar", "staff"]),
  StaffController.getAllStaff
);

// Get staff by ID
router.get(
  "/:id",
  authenticate(["admin", "super_admin", "registrar", "staff"]),
  StaffController.getStaffById
);

// Update staff
router.put(
  "/:id",
  authenticate(["admin", "super_admin"]),
  StaffController.updateStaff
);

// Deactivate staff
router.delete(
  "/:id",
  authenticate(["admin", "super_admin"]),
  StaffController.deactivateStaff
);

// Activate staff
router.patch(
  "/:id/activate",
  authenticate(["admin", "super_admin"]),
  StaffController.activateStaff
);

export default router;