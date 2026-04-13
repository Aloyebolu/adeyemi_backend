import express from "express";
import {
  createProgramme,
  getAllProgrammes,
  getProgrammeById,
  getProgrammesByDepartment,
  updateProgramme,
  deleteProgramme,
  toggleProgrammeStatus,
  getProgrammeStats,
  getProgrammesByDegreeType
} from "./programme.controller.js";

import authenticate from "../../middlewares/authenticate.js";

const router = express.Router();

/**
 * 🎓 Create a new programme
 * Access: Admin, Dean (within their faculty), HOD (within their department)
 */
router.post(
  "/",
  authenticate(["admin", "dean", "hod"]),
  createProgramme
);

/**
 * 📋 Get all programmes with filters
 * Access: Admin, Dean, HOD
 */
router.get(
  "/",
  authenticate(["admin", "dean", "hod"]),
  getAllProgrammes
);

/**
 * 📊 Get programme statistics
 * Access: Admin, Dean
 */
router.get(
  "/stats",
  authenticate(["admin", "dean"]),
  getProgrammeStats
);

/**
 * 🔍 Get programme by ID
 * Access: Admin, Dean (within faculty), HOD (within department)
 */
router.get(
  "/:programmeId",
  authenticate(["admin", "dean", "hod"]),
  getProgrammeById
);

/**
 * 📝 Update programme
 * Access: Admin, Dean (within faculty), HOD (within department)
 */
router.patch(
  "/:programmeId",
  authenticate(["admin", "dean", "hod"]),
  updateProgramme
);

/**
 * 🗑️ Delete programme (soft delete)
 * Access: Admin, Dean (within faculty), HOD (within department)
 */
router.delete(
  "/:programmeId",
  authenticate(["admin", "dean", "hod"]),
  deleteProgramme
);

/**
 * 🎚️ Toggle programme active status
 * Access: Admin, Dean (within faculty), HOD (within department)
 */
router.patch(
  "/:programmeId/toggle-status",
  authenticate(["admin", "dean", "hod"]),
  toggleProgrammeStatus
);

/**
 * 🏢 Get programmes by department
 * Access: Admin, Dean (within faculty), HOD (within department)
 */
router.get(
  "/department/:departmentId",
  authenticate(["admin", "dean", "hod"]),
  getProgrammesByDepartment
);

/**
 * 🎓 Get programmes by degree type
 * Access: Admin, Dean, HOD
 */
router.get(
  "/degree-type/:degreeType",
  authenticate(["admin", "dean", "hod"]),
  getProgrammesByDegreeType
);

export default router;