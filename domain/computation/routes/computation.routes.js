import express from "express";
import {
  computeAllResults,
  getComputationStatus,
  cancelComputation,
  retryFailedDepartments,
  getDepartmentCarryoverStats,
  getStudentCarryovers,
  getComputationHistory,
  calculateSemesterGPA,
  downloadMasterSheet,
  previewMasterSheet,
  getAvailableLevels,
  clearMasterSheetCache,
  // calculateStudentCGPA,
  // calculateStudentCGPAr
} from "../workers/computation.controller.js";
import fs from "fs";
import path from "path";
import authenticate from "../../../middlewares/authenticate.js";

import ComputationSummary from "../models/computation.model.js";
import MasterSheetHtmlRenderer from "../services/master-sheet/MasterSheetHtmlRenderer.js";
import DepartmentSemester from "../../semester/semester.model.js";
import departmentModel from "../../department/department.model.js";
import departmentService from "../../department/department.service.js";
import htmlToDocx from "html-to-docx";
import MasterSheetWordSimpleRenderer from "../services/master-sheet/MasterSheetWordRenderer.js";
import MasterComputation from "../models/masterComputation.model.js";
import pdf from "html-pdf-node";
import AppError from "../../errors/AppError.js";
import studentSemesterResultModel from "../../student/student.semseterResult.model.js";
import CarryoverCourse from "../../carryover/carryover.model.js";
import { normalizeCourse, normalizeCourses } from "../../course/course.normallizer.js";

const router = express.Router();


// Computation management endpoints
router.post("/compute-all", authenticate("admin"), computeAllResults);
router.get("/status/:masterComputationId", getComputationStatus);
router.post("/cancel/:masterComputationId", cancelComputation);
router.post("/retry/:masterComputationId", retryFailedDepartments);
router.get("/history", getComputationHistory);

// GPA / CGPA endpoints
router.get(
  "/gpa/student/:studentId/semester/:semesterId",
  calculateSemesterGPA
);
// router.get("/cgpa/student/:studentId", calculateStudentCGPA);

// Carryover management endpoints
router.get(
  "/carryovers/department/:departmentId/semester/:semesterId",
  getDepartmentCarryoverStats
);
router.get("/carryovers/student/:studentId", getStudentCarryovers);
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
 * @route   GET /api/computation/summary/:summaryId/levels
 * @desc    Get available levels for a summary
 * @access  Private (Staff, HOD, Admin)
 */
router.get(
  "/summary/:summaryId/levels",
  authenticate(["admin", "hod"]),
  getAvailableLevels
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
router.get('/', authenticate(["hod", "admin"]), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      purpose,
      semesterId,
      departmentId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const department = await departmentService.getDepartmentByHod(req.user._id)
    const query = {};

    if (status) query.status = status;
    if (purpose) query.purpose = purpose;
    if (semesterId) query.semester = semesterId;
    if (departmentId) { query.department = departmentId } else if (department) { query.department = department._id };

    if (search) {
      query.$or = [
        { 'department.name': { $regex: search, $options: 'i' } },
        { 'semester.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Fetch computations with pagination
    const computations = await ComputationSummary.find(query)
      .select("department semester computedBy programme status purpose   totalStudents studentsProcessed createdAt completedAt")
      .populate('department', 'name code')
      .populate('programme', 'name programmeType')
      .populate('semester', 'name session')
      .populate('computedBy', 'name email')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const total = await ComputationSummary.countDocuments(query);

    // Get filter options
    const departments = await departmentModel.find()
      .select('name code')
      .sort('name')
      .lean();

    // NOTED
    const semesters = await DepartmentSemester.find()
      .select('name academicYear')
      .sort('-academicYear name')
      .lean();

    res.json({
      success: true,
      data: {
        computations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        filters: {
          departments,
          semesters,
          statuses: ['completed', 'processing', 'failed', 'pending'],
          purposes: ['final', 'preview']
        }
      }
    });

  } catch (error) {
    throw error
  }
});






export default router;
