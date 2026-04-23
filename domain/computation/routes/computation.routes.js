import express from "express";
import {
  computeAllResults,
  getComputationStatus,
  cancelComputation,
  retryFailedDepartments,
  getComputationHistory,
  calculateSemesterGPA,
  downloadMasterSheet,
  previewMasterSheet,
  clearMasterSheetCache,
  getAllComputations
} from "#domain/computation/controllers/computation.controller.js";
import authenticate from "#middlewares/authenticate.js";
import validationService from "../services/validation.service.js";
import buildResponse from "#utils/responseBuilder.js";
import validationRoutes from "./validation.route.js"
import { PERMISSIONS } from "#config/permissions.js";

const router = express.Router();

// Validation routes(Admin only)
router.use('/validate', authenticate('admin'), validationRoutes)

// Computation management endpoints
router.post("/compute-all", authenticate(PERMISSIONS.COMPUTE_ALL_RESULTS), computeAllResults);
router.get("/status/:masterComputationId", getComputationStatus);
router.post("/cancel/:masterComputationId", cancelComputation);
router.post("/retry/:masterComputationId", retryFailedDepartments);
router.get("/history", getComputationHistory);

router.get("/validate/:programmeId", async(req, res)=>{

  const resp = await validationService.validateAllProgrammes()
  console.log(resp.length)
  buildResponse.success(res, 'SUccess', resp)
});
// GPA / CGPA endpoints
router.get(
  "/gpa/student/:studentId/semester/:semesterId",
  calculateSemesterGPA
);

// Master sheet rendering endpoint
/**
 * @route   GET /api/computation/summary/:summaryId/:level/:type
 * @desc    Download master sheet in specified format
 * @access  Private (Staff, HOD, Admin)
 */
router.get(
  "/summary/:summaryId/:level/:type",
  authenticate(["admin", "hod"]),
  downloadMasterSheet
);

/**
 * @route   GET /api/computation/summary/:summaryId/:level/preview
 * @desc    Preview master sheet as HTML
 * @access  Private (Staff, HOD, Admin)
 */
router.get(
  "/summary/:summaryId/:level/preview",
  authenticate(["admin", "hod"]),
  previewMasterSheet
);


/**
 * @route   DELETE /api/computation/summary/:summaryId/cache
 * @desc    Clear cache for a summary (Admin/HOD only)
 * @access  Private (Admin, HOD)
 */
router.delete(
  "/summary/:summaryId/cache",
  authenticate(["admin", "hod"]),
  clearMasterSheetCache
);



// GET all computations with filtering and pagination
// GET all computations with filtering and pagination
router.post(
  '/',
  authenticate(["hod", "admin"]),
  getAllComputations
);





export default router;
