import express from "express";
import {
  createDepartment,
  getDepartmentsByFaculty,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  assignHOD, getAllDepartment, getDepartmentStats, removeHOD
} from "./department.controller.js";

import authenticate from "../../middlewares/authenticate.js";

const router = express.Router();

/**
 * 🧩 Admin or Faculty Officer creates a department under a faculty
 */
router.post(
  "/",
  authenticate(["admin", "dean", "hod", 'vc']),
  createDepartment
);

// Get all departments in a faculty
router.get(
  "/",
  authenticate(["admin", "dean", "hod", 'vc']),
  getAllDepartment
);

router.get(
  "/stats",
  authenticate(["admin", "dean"]),
  getDepartmentStats
);

/**
 * 🔍 Get a single department by ID
 */
router.get("/:departmentId", authenticate(["admin", "dean"]), getDepartmentById);

/**
 * ✏️ Update a department (Admin only)
 */
router.patch(
  "/:departmentId",
  authenticate("admin"),
  updateDepartment
);

/**
 * 🗑️ Delete a department (soft delete preferred — Admin only)
 */
router.delete(
  "/:departmentId",
  authenticate("admin"),
  deleteDepartment 
);

/**
 * 👩‍🏫 Assign HOD to department
 */ 
router.patch(
  "/:departmentId/assign-hod",
  authenticate(["admin", "dean"]),
  assignHOD
);

/**
 * 🧾 Remove HOD from department
 */
router.patch(
  "/:departmentId/remove-hod",
  authenticate(["admin", "dean"]),
  removeHOD
);
export default router;
