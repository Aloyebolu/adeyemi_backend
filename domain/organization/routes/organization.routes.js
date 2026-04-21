// routes/organization.routes.js
import { Router } from "express";
import * as OrganizationController from "../controllers/organization.controller.js";
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
    OrganizationController.getMyUnits
);

// Get units for a specific user
router.get(
    "/user/:userId/units",
    authenticate(["admin", "super_admin"]),
    OrganizationController.getUserUnits
);

// ============================================
// TREE & HIERARCHY ROUTES
// ============================================

// Get the full tree structure (optional root ID)
router.get(
    //   "/tree/:id?",
    "/tree/:id",
    authenticate(["admin", "super_admin", "registrar", "staff"]),
    OrganizationController.getUnitTree
);

// ============================================
// MEMBER MANAGEMENT (Member ID routes)
// ============================================

// Add these routes to organization.routes.js

// ============================================
// MEMBER STATISTICS & BULK OPERATIONS
// ============================================

// Get member statistics for a unit
router.get(
    "/:unitId/members/stats",
    authenticate(["admin", "super_admin", "registrar", "staff", "head"]),
    OrganizationController.getMemberStats
);

// Get user's role in a specific unit
router.get(
    "/:unitId/user/:userId/role",
    authenticate(["admin", "super_admin", "registrar", "staff", "head"]),
    OrganizationController.getUserUnitRole
);

// Bulk add members to a unit
router.post(
    "/:unitId/members/bulk",
    authenticate(["admin", "super_admin", "head"]),
    OrganizationController.bulkAddMembers
);

// ============================================
// EXISTING MEMBER ROUTES (updated)
// ============================================

// Update a member's details
router.put(
    "/members/:memberId",
    authenticate(["admin", "super_admin", "head"]),
    OrganizationController.updateUnitMember
);

// Remove a member from a unit
router.delete(
    "/members/:memberId",
    authenticate(["admin", "super_admin", "head"]),
    OrganizationController.removeUnitMember
);

// Add a member to a unit
router.post(
    "/:unitId/members",
    authenticate(["admin", "super_admin", "head"]),
    OrganizationController.addUnitMember
);

// Get all members of a unit
router.get(
    "/:unitId/members",
    authenticate(["admin", "super_admin", "registrar", "staff", "head"]),
    OrganizationController.getUnitMembers
);

// ============================================
// UNIT-SPECIFIC MEMBER ROUTES
// ============================================

// Add a member to a unit
router.post(
    "/:unitId/members",
    authenticate(["admin", "super_admin", "head"]),
    OrganizationController.addUnitMember
);

// Get all members of a unit
router.get(
    "/:unitId/members",
    authenticate(["admin", "super_admin", "registrar", "staff", "head"]),
    OrganizationController.getUnitMembers
);

// ============================================
// UNIT HIERARCHY ROUTE
// ============================================

// Get the hierarchy of a specific unit
router.get(
    "/:id/hierarchy",
    authenticate(["admin", "super_admin", "registrar", "staff", "head"]),
    OrganizationController.getUnitHierarchy
);

// ============================================
// UNIT CRUD (Dynamic ID routes - MUST BE LAST)
// ============================================

// Get all units (with filters/search via POST body) OR Create a new unit
router.post(
    "/",
    authenticate(["admin", "super_admin", "registrar", "staff", "head"]),
    OrganizationController.createAdminUnit
);

// Get all units (simple GET with query params)
router.get(
    "/",
    authenticate(["admin", "super_admin", "registrar", "staff", "head"]),
    OrganizationController.getAllAdminUnits
);
// Get all units (simple GET with query params)
router.get(
    "/types/:type",
    authenticate(["admin", "super_admin", "registrar", "staff", "head"]),
    OrganizationController.getAllAdminUnits
);

// Get a specific unit by ID
router.get(
    "/:id",
    authenticate(["admin", "super_admin", "registrar", "staff", "head"]),
    OrganizationController.getAdminUnitById
);

// Update a unit
router.put(
    "/:id",
    authenticate(["admin", "super_admin", "head"]),
    OrganizationController.updateAdminUnit
);

// Deactivate a unit
router.delete(
    "/:id",
    authenticate(["admin", "super_admin"]),
    OrganizationController.deactivateAdminUnit
);



export default router;