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
router.get("/summary/:summaryId/:level/:type", async (req, res) => {
  try {

    const { summaryId, level, type } = req.params;

    const {
      departmental_board,
      faculty_board,
      senate_committee,
      senate,
    } = req.query;

    // Get semester results with proper population
    let results = await studentSemesterResultModel
      .find({ computationSummaryId: summaryId })
      .populate({
        path: 'courses.courseId',
        model: 'Course',
        // select: 'courseCode title credits type level borrowedId',
        populate: {
          path: 'borrowedId',
          model: 'Course'
        }
      })
      .lean();

    // Transform each result to flatten the courses array
    results = results.map(result => ({
      ...result,
      courses: result.courses.map(courseItem => {
        const { courseId, ...resultCourseFields } = courseItem;

        // Return merged object: carryover-specific fields + course fields
        return {
          ...resultCourseFields,
          ...courseId,
        };
      })
    }));

    console.log(results.courses)

    let carryovers = await CarryoverCourse
      .find({ computationBatch: summaryId })
      .populate({
        path: 'courses.course',
        model: 'Course',
        populate: {
          path: 'borrowedId',
          model: 'Course'
        }
      })
      .lean();

    // Flatten each course item to merge course fields to top level
    carryovers = carryovers.map(carryover => ({
      ...carryover,
      courses: carryover.courses.map(courseItem => {
        const { course, ...carryoverCourseFields } = courseItem;

        // Return merged object: carryover-specific fields + course fields
        return {
          ...course,
          ...carryoverCourseFields,
        };
      })
    }));
    // Fetch summary
    const summary = await ComputationSummary
      .findById(summaryId)
      .populate("department", "name")
      .populate("semester", "name")
      .lean();

    if (!summary) {
      return res.status(404).send("Master sheet data not found");
    }

    // Fetch computation
    const computation = await MasterComputation
      .findById(summary.masterComputationId)
      .lean();

    if (!computation) {
      return res.status(404).json({ message: "Computation not found" });
    }

    // BYPASS
    summary.purpose = "final"
    // Ensure approval_dates exists
    summary.approval_dates = summary.approval_dates || {};

    // Attach temporary frontend dates if provided
    if (departmental_board)
      summary.approval_dates.departmental_board = new Date(departmental_board);

    if (faculty_board)
      summary.approval_dates.faculty_board = new Date(faculty_board);
    console.log(faculty_board)

    if (senate_committee)
      summary.approval_dates.senate_committee = new Date(senate_committee);

    if (senate)
      summary.approval_dates.senate = new Date(senate);

    // Define approval stages in the same order as frontend
    const APPROVAL_STAGES = [
      { id: 'departmental_board', label: 'Departmental Board', required: true },
      { id: 'faculty_board', label: 'Faculty Board', required: true },
      { id: 'senate_committee', label: 'Senate Committee', required: false },
      { id: 'senate', label: 'Senate', required: true }
    ];


    // Fallback if still missing
    summary.approval_dates.departmental_board =
      summary.approval_dates.departmental_board ||
      computation.academicBoardDate ||
      new Date("2026-03-05");
    summary.approval_dates.faculty_board =
      new Date("2026-03-05");

    summary.currentApprovalStage
    // Ensure approval_dates exists
    summary.approval_dates = summary.approval_dates || {};

    // Attach temporary frontend dates if provided
    ['departmental_board', 'faculty_board', 'senate_committee', 'senate'].forEach(stage => {
      if (req.query[stage]) {
        summary.approval_dates[stage] = new Date(req.query[stage]);
      }
    });

    // Compute currentApprovalStage based on **highest/latest stage with date**
    const getCurrentApprovalStage = () => {
      // BYPASS
      return "faculty_board"
      const stagesWithDates = Object.entries(summary.approval_dates)
        .filter(([_, date]) => date instanceof Date && !isNaN(date.getTime()));

      if (!stagesWithDates.length) return null;

      // Sort by APPROVAL_STAGES hierarchy
      stagesWithDates.sort((a, b) => {
        const aIndex = APPROVAL_STAGES.findIndex(s => s.id === a[0]);
        const bIndex = APPROVAL_STAGES.findIndex(s => s.id === b[0]);
        return bIndex - aIndex; // highest stage comes first
      });

      return stagesWithDates[0][0];
    };

    // Update summary
    summary.currentApprovalStage = getCurrentApprovalStage();

    const studentSummariesByLevel = new Map();

    for (const result of results) {
      const level = parseInt(result.level);

      const outstandingCourses = carryovers.find((i) => { return String(i.student) == String(result.studentId) })
      if (!studentSummariesByLevel.has(level)) {
        studentSummariesByLevel.set(level, []);
      }

      studentSummariesByLevel.get(level).push({
        studentId: result.studentId,
        matricNumber: result.matricNumber,
        name: result.name,

        currentSemester: {
          tcp: result.currentTCP,
          tnu: result.currentTNU,
          gpa: result.gpa
        },
        // Previous performance
        previousPerformance: {
          cumulativeTCP: result.previousCumulativeTCP,
          cumulativeTNU: result.previousCumulativeTNU,
          cumulativeGPA: result.previousCumulativeGPA,
        },
        cumulativePerformance: {
          totalTCP: result.cumulativeTCP,
          totalTNU: result.cumulativeTNU,
          cgpa: result.cgpa
        },

        outstandingCourses: normalizeCourse(outstandingCourses?.courses),
        courseResults: normalizeCourse(result.courses),

        academicStanding: result.academicStanding,
        academicStatus: result.remark
      });
    }
    summary.studentSummariesByLevel = Object.fromEntries(studentSummariesByLevel);
    const outputType = (type || "html").toLowerCase();

    // ------------------- HTML or PDF Preview -------------------
    if (["doc", "docx", "word"].includes(outputType)) {
      try {
        const wordHtml = MasterSheetWordSimpleRenderer.render({
          summary,
          level,
          masterComputationId: summaryId || "n/a"
        });

        // Simpler options without complex XML namespaces
        const docxOptions = {
          table: {
            row: {
              cantSplit: true
            }
          },
          page: {
            margins: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440
            },
            orientation: 'portrait',
            size: 'A4'
          }
        };

        const buffer = await htmlToDocx(wordHtml, null, docxOptions);

        if (!buffer || buffer.length === 0) {
          throw new Error('Generated DOCX buffer is empty');
        }

        const docxBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

        // Save debug copy
        const debugPath = path.join("/home/aloye/Downloads", `MasterSheet_${level}_${Date.now()}.docx`);
        fs.writeFileSync(debugPath, docxBuffer);

        // Set response headers
        const filename = `MasterSheet_${level}_${new Date().toISOString().split('T')[0]}.docx`;
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        res.setHeader("Content-Length", docxBuffer.length);

        return res.send(docxBuffer);

      } catch (error) {
        console.error("❌ Error generating DOCX:", error);
        res.status(500).json({
          error: "Failed to generate DOCX file",
          details: error.message
        });
      }
    }

    // ------------------- JSON -------------------
    if (outputType === "json") {
      return res.json({
        success: true,
        data: {
          summary,
          levelData: summary.masterSheetDataByLevel[level],
          level,
          summaryId
        }
      });
    }

    if (["pdf"].includes(outputType)) {
      // 1️⃣ Get all levels dynamically
      // const levels = Object.keys(summary?.studentSummariesByLevel || {})
      //   .map(Number)
      //   .sort((a, b) => a - b);
      const levels = [level]

      // 2️⃣ Combine HTML for all levels with page breaks
      let combinedHtml = "";
      levels.forEach((level, index) => {
        const levelHtml = MasterSheetHtmlRenderer.render({
          summary,
          level,
          masterComputationId: summaryId || "n/a"
        });

        // Add a forced page break between levels except the first
        combinedHtml += index === 0
          ? levelHtml
          : `<div style="page-break-before: always;"></div>${levelHtml}`;
      });

      // 3️⃣ Wrap in <html><body> if not already
      const fullHtml = `
    <html>
      <head>
        <style>
          /* Optional: adjust table, watermark styles for PDF */
          .watermark { position: absolute; opacity: 0.1; font-size: 100px; transform: rotate(-45deg); top: 50%; left: 50%; }
        </style>
      </head>
      <body>
        ${combinedHtml}
      </body>
    </html>
  `;

      // 4️⃣ Prepare html-pdf-node input
      const file = { content: combinedHtml };
      const options = {
        format: 'A4',
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm'
        },
        printBackground: true
      };
      try {

        // 5️⃣ Generate PDF buffer
        const pdfBuffer = await pdf.generatePdf(file, options);

        // 6️⃣ Optional: save locally for debugging
        const debugPath = path.join("/home/aloye/Downloads", `MasterSheet_AllLevels.pdf`);
        // fs.writeFileSync(debugPath, pdfBuffer);

        // 7️⃣ Send PDF to client
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="MasterSheet_AllLevels.pdf"`
        );
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.send(pdfBuffer);
      }
      catch (err) {
        console.log(combinedHtml)
        throw err
      }
    }

    // ------------------- Default fallback -------------------
    const defaultHtml = MasterSheetHtmlRenderer.render({
      summary,
      level,
      masterComputationId: summaryId || "n/a"
    });
    res.setHeader("Content-Type", "text/html");
    res.send(defaultHtml);

  } catch (err) {
    throw err;
  }
});



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
