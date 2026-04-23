// computationReport.service.js
import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import path from "path";
import ComputationSummary from "#domain/computation/models/computation.model.js";
import MasterComputation from "#domain/computation/models/masterComputation.model.js";
import AppError from "#shared/errors/AppError.js";
import MasterSheetHtmlRenderer from "./MasterSheetHtmlRenderer.js";
import FileService from "#domain/files/files.service.js";
import CarryoverCourse from "#domain/user/student/carryover/carryover.model.js";
import studentSemesterResultModel from "#domain/user/student/student.semseterResult.model.js";
import SemesterService from "#domain/semester/semester.service.js";
import { normalizeCourses } from "#domain/course/course.normallizer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ComputationReportService {

  constructor() {
    this.browser = null; // Reusable browser instance
  }

  /**
   * Get or create Puppeteer browser instance
   */
  async getBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu"
        ]
      });
      console.log("✅ Puppeteer browser launched");
    }
    return this.browser;
  }

  /**
   * Close browser instance (call on app shutdown)
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log("✅ Puppeteer browser closed");
    }
  }

  /**
   * Normalize course data
   */
  normalizeCourse(courses = []) {
    if (!courses || !Array.isArray(courses)) return [];

    return courses.map(course => ({
      courseCode: course.courseCode || course.code,
      courseTitle: course.courseTitle || course.title,
      unit: course.courseUnit || course.unit || course.unitLoad,
      score: course.score,
      grade: course.grade,
      status: course.status,
      reason: course.reason
    }));
  }

  /**
   * Fetch and prepare master sheet data
   */
  async prepareMasterSheetData(summaryId, level, queryParams = {}) {
    const {
      departmental_board,
      faculty_board,
      senate_committee,
      senate,
    } = queryParams;

    // Fetch summary
    const summary = await ComputationSummary
      .findById(summaryId)
      .populate("department", "name")
      .populate("semester", "name")
      .lean();

    if (!summary) {
      throw new AppError("Master sheet data not found", 404);
    }

    const previousSemesters = [summary.semester._id, ...(await SemesterService.getPreviousAcademicSemesters(summary.semester._id))]


    // Get semester results with proper population
    let results = await studentSemesterResultModel
      .find({ computationSummaryId: summaryId })
      .populate({
        path: "courses.courseId",
        model: "Course",
        populate: {
          path: "borrowedId",
        }
      })
      .lean();

    // Transform results to flatten courses
    results = results.map(result => ({
      ...result,
      courses: result.courses.map(courseItem => {
        const { courseId, ...resultCourseFields } = courseItem;
        return {
          ...resultCourseFields,
          ...courseId,
        };
      })
    }));

    // Fetch carryover courses
    console.log({ previousSemesters })
    let carryovers = await CarryoverCourse
      .find({ semester: { $in: previousSemesters } })
      .populate({
        path: "courses.course",
        model: "Course",
        populate: {
          path: "borrowedId",
        }
      })
      .lean();


    // Flatten carryover courses
    carryovers = carryovers.map(carryover => ({
      ...carryover,
      courses: carryover.courses.map(courseItem => {
        const { course, ...carryoverCourseFields } = courseItem;
        const isNew =
          courseItem.fromSemester?.toString() === summary.semester._id?.toString();
        return {
          ...course,
          ...carryoverCourseFields,
          status: isNew ? 'new' : 'old'

        };
      })
    }));



    // Fetch computation
    const computation = await MasterComputation
      .findById(summary.masterComputationId)
      .lean();

    if (!computation) {
      throw new AppError("Computation not found", 404);
    }

    // Set purpose
    summary.purpose = "final";

    // Initialize approval_dates
    summary.approval_dates = summary.approval_dates || {};

    // Attach approval dates from query params
    if (departmental_board)
      summary.approval_dates.departmental_board = new Date(departmental_board);
    if (faculty_board)
      summary.approval_dates.faculty_board = new Date(faculty_board);
    if (senate_committee)
      summary.approval_dates.senate_committee = new Date(senate_committee);
    if (senate)
      summary.approval_dates.senate = new Date(senate);

    // Define approval stages
    const APPROVAL_STAGES = [
      { id: "departmental_board", label: "Departmental Board", required: true },
      { id: "faculty_board", label: "Faculty Board", required: true },
      { id: "senate_committee", label: "Senate Committee", required: false },
      { id: "senate", label: "Senate", required: true }
    ];

    // Fallback dates
    summary.approval_dates.departmental_board =
      summary.approval_dates.departmental_board ||
      computation.academicBoardDate ||
      new Date("2026-04-11");
    summary.approval_dates.faculty_board =
      summary.approval_dates.faculty_board ||
      new Date("2026-04-11");

    // Compute current approval stage
    const getCurrentApprovalStage = () => {
      const stagesWithDates = Object.entries(summary.approval_dates)
        .filter(([_, date]) => date instanceof Date && !isNaN(date.getTime()));

      if (!stagesWithDates.length) return null;

      stagesWithDates.sort((a, b) => {
        const aIndex = APPROVAL_STAGES.findIndex(s => s.id === a[0]);
        const bIndex = APPROVAL_STAGES.findIndex(s => s.id === b[0]);
        return bIndex - aIndex;
      });

      return stagesWithDates[0][0];
    };

    summary.currentApprovalStage = getCurrentApprovalStage() || "faculty_board";

    // Build student summaries by level
    const studentSummariesByLevel = new Map();

    for (const result of results) {
      const resultLevel = parseInt(result.level);
      const studentCarryovers = carryovers.filter(
        (i) => String(i.student) === String(result.studentId)
      );
      const allOutstandingCourses = studentCarryovers
        .flatMap(c => c.courses || []);
      const outstandingCourses = normalizeCourses(allOutstandingCourses);

      if (!studentSummariesByLevel.has(resultLevel)) {
        studentSummariesByLevel.set(resultLevel, []);
      }

      studentSummariesByLevel.get(resultLevel).push({
        studentId: result.studentId,
        _id: result.studentId,
        matricNumber: result.matricNumber,
        name: result.name,
        currentSemester: {
          tcp: result.currentTCP,
          tnu: result.currentTNU,
          gpa: result.gpa
        },
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
        outstandingCourses,
        courseResults: normalizeCourses(result.courses),
        academicStanding: result.academicStanding,
        academicStatus: result.remark,
        remark: result.remark
      });
    }

    summary.studentSummariesByLevel = Object.fromEntries(studentSummariesByLevel);

    return { summary, computation };
  }

  /**
   * Generate PDF using Puppeteer (simulates Chrome print)
   */
  async generatePDF(html, options = {}) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport to A4 size
      await page.setViewport({
        width: 1200,
        height: 1600,
        deviceScaleFactor: 2 // Higher quality
      });

      // Set content and wait for all resources
      await page.setContent(html, {
        waitUntil: ["networkidle0", "load", "domcontentloaded"],
        timeout: 30000
      });

      // Wait for any images/fonts to load
      await page.evaluateHandle("document.fonts.ready");

      // Generate PDF with Chrome's print emulation
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: options.marginTop || "15mm",
          bottom: options.marginBottom || "15mm",
          left: options.marginLeft || "10mm",
          right: options.marginRight || "10mm"
        },
        displayHeaderFooter: false,
        preferCSSPageSize: true,
        scale: options.scale || 1,
        ...options
      });

      return pdfBuffer;
    } finally {
      await page.close();
    }
  }

  /**
   * Generate master sheet PDF with caching (delegated to FileService)
   */
  async generateMasterSheetPDF(summaryId, level, queryParams = {}) {
    try {
      // Generate cache key using FileService
      const cacheKey = FileService.generateCacheKey('masterSheet', {
        summaryId,
        level,
        type: "pdf",
        ...queryParams
      });

      // Check cache using FileService
      if (!queryParams.forceRefresh) {
        const cached = await FileService.getCachedFile(cacheKey);
        if (cached) {
          console.log(`📦 Serving from cache: ${cacheKey}`);
          return {
            buffer: cached.buffer,
            filename: `MasterSheet_Level_${level}_${summaryId.slice(-8)}.pdf`,
            fromCache: true
          };
        }
      }

      console.log(`🔄 Generating new PDF for: ${cacheKey}`);

      // Prepare data
      const { summary } = await this.prepareMasterSheetData(summaryId, level, queryParams);

      // Generate HTML
      const html = MasterSheetHtmlRenderer.render({
        summary,
        level,
        masterComputationId: summaryId
      });

      // Generate PDF buffer
      const pdfBuffer = await this.generatePDF(html);

      // Save to cache using FileService
      await FileService.saveToCache(cacheKey, pdfBuffer);

      return {
        buffer: pdfBuffer,
        filename: `MasterSheet_Level_${level}_${summaryId.slice(-8)}.pdf`,
        fromCache: false
      };
    } catch (error) {
      console.error("PDF generation error details:", error);
      throw new AppError(`Failed to generate PDF: ${error.message}`, 500);
    }
  }

  /**
   * Generate master sheet DOCX
   */
  async generateMasterSheetDOCX(summaryId, level, queryParams = {}) {
    try {
      const cacheKey = FileService.generateCacheKey('masterSheetDocx', {
        summaryId,
        level,
        ...queryParams
      });

      if (!queryParams.forceRefresh) {
        const cached = await FileService.getCachedFile(cacheKey);
        if (cached) {
          return {
            buffer: cached.buffer,
            filename: `MasterSheet_Level_${level}_${summaryId.slice(-8)}.docx`,
            fromCache: true
          };
        }
      }

      const { summary } = await this.prepareMasterSheetData(summaryId, level, queryParams);

      const wordHtml = MasterSheetWordSimpleRenderer.render({
        summary,
        level,
        masterComputationId: summaryId
      });

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
          orientation: "portrait",
          size: "A4"
        }
      };

      const buffer = await htmlToDocx(wordHtml, null, docxOptions);

      if (!buffer || buffer.length === 0) {
        throw new Error("Generated DOCX buffer is empty");
      }

      await FileService.saveToCache(cacheKey, buffer);

      return {
        buffer: Buffer.from(buffer),
        filename: `MasterSheet_Level_${level}_${summaryId.slice(-8)}.docx`,
        fromCache: false
      };
    } catch (error) {
      throw new AppError(`Failed to generate DOCX: ${error.message}`, 500);
    }
  }

  /**
   * Generate master sheet HTML
   */
  async generateMasterSheetHTML(summaryId, level, queryParams = {}) {
    const { summary } = await this.prepareMasterSheetData(summaryId, level, queryParams);

    return MasterSheetHtmlRenderer.render({
      summary,
      level,
      masterComputationId: summaryId
    });
  }

  /**
   * Generate master sheet JSON
   */
  async generateMasterSheetJSON(summaryId, level, queryParams = {}) {
    const { summary } = await this.prepareMasterSheetData(summaryId, level, queryParams);

    return {
      summary,
      levelData: summary.masterSheetDataByLevel?.[level],
      level,
      summaryId
    };
  }

  /**
   * Clear cache for specific summary using FileService
   */
  async clearSummaryCache(summaryId) {
    return await FileService.invalidateCachePattern(summaryId.toString());
  }
}

// Create singleton instance
const service = new ComputationReportService();

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  await service.closeBrowser();
});

process.on("SIGINT", async () => {
  await service.closeBrowser();
});

export default service;