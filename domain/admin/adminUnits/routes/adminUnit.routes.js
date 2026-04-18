import { Router } from "express";
import * as AdminUnitController from "../controllers/adminUnit.controller.js";
import authenticate from "#middlewares/authenticate.js";

const router = Router();

// ============================================
// NOTE: Route Order Matters!
// More specific routes must come BEFORE dynamic parameter routes
// ============================================

// ============================================
// USER-SPECIFIC ROUTES (Most Specific First)
// ============================================

// Get current user's units
router.get(
  "/my/units",
  authenticate(["admin", "super_admin", "registrar", "staff", "lecturer", "student"]),
  AdminUnitController.getMyUnits
);

// Get units for a specific user
router.get(
  "/user/:userId/units",
  authenticate(["admin", "super_admin"]),
  AdminUnitController.getUserUnits
);

// ============================================
// TREE & HIERARCHY ROUTES
// ============================================

// Get the full tree structure (optional root ID)
router.get(
  "/tree/:id",
  authenticate(["admin", "super_admin", "registrar", "staff"]),
  AdminUnitController.getUnitTree
);

// ============================================
// MEMBER MANAGEMENT (Member ID routes)
// ============================================

// Update a member's details
router.put(
  "/members/:memberId",
  authenticate(["admin", "super_admin", "head"]),
  AdminUnitController.updateUnitMember
);

// Remove a member from a unit
router.delete(
  "/members/:memberId",
  authenticate(["admin", "super_admin", "head"]),
  AdminUnitController.removeUnitMember
);

// ============================================
// UNIT-SPECIFIC MEMBER ROUTES
// ============================================

// Add a member to a unit
router.post(
  "/:unitId/members",
  authenticate(["admin", "super_admin", "head"]),
  AdminUnitController.addUnitMember
);

// Get all members of a unit
router.get(
  "/:unitId/members",
  authenticate(["admin", "super_admin", "registrar", "staff", "head"]),
  AdminUnitController.getUnitMembers
);

// ============================================
// UNIT HIERARCHY ROUTE
// ============================================

// Get the hierarchy of a specific unit
router.get(
  "/:id/hierarchy",
  authenticate(["admin", "super_admin", "registrar", "staff", "head"]),
  AdminUnitController.getUnitHierarchy
);

// ============================================
// UNIT CRUD (Dynamic ID routes - MUST BE LAST)
// ============================================

// Get all units (with filters/search via POST body) OR Create a new unit
// Note: This route handles both GET-like queries (via POST with fields/search_term)
//       and actual creation (via POST with unit data)
router.post(
  "/",
  authenticate(["admin", "super_admin", "registrar", "staff", "head"]),
  AdminUnitController.createAdminUnit
);

// Get all units (simple GET with query params)
router.get(
  "/",
  authenticate(["admin", "super_admin", "registrar", "staff", "head"]),
  AdminUnitController.getAllAdminUnits
);

// Get a specific unit by ID
router.get(
  "/:id",
  authenticate(["admin", "super_admin", "registrar", "staff", "head"]),
  AdminUnitController.getAdminUnitById
);

// Update a unit
router.put(
  "/:id",
  authenticate(["admin", "super_admin", "head"]),
  AdminUnitController.updateAdminUnit
);

// Deactivate a unit
router.delete(
  "/:id",
  authenticate(["admin", "super_admin"]),
  AdminUnitController.deactivateAdminUnit
);

export default router;