import mongoose from "mongoose";
import { mapResults } from "../course/course.dto.js";
import { normalizeCourse } from "../course/course.normallizer.js";
import courseRegistrationModel from "../course/courseRegistration.model.js";
import AppError from "../errors/AppError.js";
import SemesterService from "../semester/semester.service.js";
import StudentService from "../student/student.service.js";
import GPACalculator from "../computation/services/GPACalculator.js";
import studentSemesterResultModel from "../student/student.semseterResult.model.js";
import studentModel from "../student/student.model.js";
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import StudentResultHtmlRenderer from "./services/StudentResultHtmlRenderer.js";
import ResultTranscriptHtmlRenderer from "./services/ResultTranscriptHtmlRenderer.js";
import { getProgrammeById } from "../programme/programme.controller.js";
import { getDepartmentById } from "../department/department.controller.js";
import { getDepartmentLeadershipDetails } from "../computation/services/helpers.js";
import departmentService from "../department/department.service.js";
import programmeService from "../programme/programme.service.js";
import { resolveUserName } from "../../utils/resolveUserName.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ResultService.js
const ResultService = {
  async getStudentForResultUpload(studentId, actualMatricNumber) {
    // Validate that we have at least one identifier
    if (!studentId && !actualMatricNumber) {
      return null;
    }

    // Resolve student
    let student = null;

    if (studentId) {
      student = await StudentService.getStudentById(studentId);
    } else {
      // First try exact match
      student = await StudentService.findStudent({
        matricNumber: actualMatricNumber
      });

      // If not found, try with added 'u' suffix (lowercase)
      if (!student) {
        student = await StudentService.findStudent({
          matricNumber: actualMatricNumber + 'u'
        });
      }
    }

    // If student found, return it
    if (student) {
      return student;
    }

    // BYPASS
    // If still not found, try matric number mapping
    if (actualMatricNumber) {
      const matricNumberMapping = {
        'csc/2024/0085u': 'ccs/2024/0017u',
        'csc/2024/0113u': 'ccs/2024/0013u',
        'csc/2024/0114u': 'ccs/2024/0020u',
        'csc/2024/0170u': 'ccs/2024/0018u',
        'csc/2024/0012u': 'ccs/2024/0023u',//
        'csc/2024/0018u': 'ccs/2024/0016u', //
        'csc/2024/0022u': 'ccs/2024/0010u', //
        'csc/2024/0083u': 'ccs/2024/0012u',//
        'csc/2024/0031u': 'ccs/2024/0202u', //
        'csc/2024/0034u': 'ccs/2024/0009u', //
        'csc/2024/0137u': 'ccs/2024/0015u', //
        'csc/2024/0158u': 'ccs/2024/0011u',//
        'csc/2024/0163u': 'ccs/2024/0008u', //
        'csc/2024/0164u': 'ccs/2024/0019u', //
        'csc/2024/0186u': 'ccs/2024/0014u', //
        'ccs/2024/0001u': 'ccs/2024/0021u',
        'csc/2024/0120u': 'ccs/2024/0024u'
        // 'csc/2024/0129'
        // csc/2024/0120u missing also doesnt map to any new matric number

      };

      // Normalize for lookup
      const normalizeMatric = (matric) => {
        let normalized = matric.toLowerCase();
        if (!normalized.endsWith('u')) {
          normalized += 'u';
        }
        return normalized;
      };

      const normalizedMatric = normalizeMatric(actualMatricNumber);
      const mappedMatricNumber = matricNumberMapping[normalizedMatric];

      if (mappedMatricNumber) {
        // Try lowercase version first
        student = await StudentService.findStudent({
          matricNumber: mappedMatricNumber
        });

        // If not found, try uppercase
        if (!student) {
          student = await StudentService.findStudent({
            matricNumber: mappedMatricNumber.toUpperCase()
          });
        }

        // If found via mapping, log it and return
        if (student) {
          // console.log(`Matric mapped: ${normalizedMatric} -> ${mappedMatricNumber}`);
          return student;
        }
      }
    }

    // If nothing works, return null
    return null;
  },

  /**
   * Get results for a student by student ID
   * @param {string} studentId - The student ID
   * @param {string} semesterId - Optional semester ID, if not provided uses active semester
   * @returns {Promise<Array>} - Array of student results
   */
  async getResultsForStudent(studentId, semesterId = null) {
    try {
      if (!studentId) {
        throw new AppError("Student id required", 404);
      }

      // Get semester if not provided
      let targetSemesterId = semesterId;
      if (!targetSemesterId) {
        const semester = await SemesterService.getActiveAcademicSemester();
        if (!semester) {
          throw new AppError("No active semester found", 404);
        }
        targetSemesterId = semester._id;
      }

      const data = await courseRegistrationModel.aggregate([
        {
          $match: {
            student: new mongoose.Types.ObjectId(studentId),
            semester: new mongoose.Types.ObjectId(targetSemesterId),
          },
        },
        { $unwind: "$courses" },
        {
          $lookup: {
            from: "courses",
            localField: "courses",
            foreignField: "_id",
            as: "course",
          },
        },
        { $unwind: "$course" },
        {
          $lookup: {
            from: "courses",
            localField: "course.borrowedId",
            foreignField: "_id",
            as: "borrowedId",
          },
        },
        {
          $addFields: {
            "course.borrowedId": { $arrayElemAt: ["$borrowedId", 0] },
          },
        },
        {
          $lookup: {
            from: "students",
            localField: "student",
            foreignField: "_id",
            as: "student",
          },
        },
        { $unwind: "$student" },
        {
          $lookup: {
            from: "users",
            localField: "student._id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $lookup: {
            from: "departments",
            localField: "student.departmentId",
            foreignField: "_id",
            as: "department",
          },
        },
        { $unwind: "$department" },
        {
          $lookup: {
            from: "results",
            let: { studentId: "$student._id", courseId: "$course._id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$studentId", "$$studentId"] },
                      { $eq: ["$courseId", "$$courseId"] },
                    ],
                  },
                },
              },
            ],
            as: "result",
          },
        },
        {
          $unwind: {
            path: "$result",
            preserveNullAndEmptyArrays: true,
          },
        },
        { $sort: { "course.courseCode": 1 } },
      ]);

      // Normalize courses
      let result = [];
      data.map((d) => {
        result.push({ ...d, course: normalizeCourse(d.course) });
      });
      // console.log(result)
      return mapResults(result);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get student results', 500, error);
    }
  },

  /**
   * Get student grades formatted for GPA calculation
   * @param {string} studentId - The student ID
   * @param {string} semester - Optional semester identifier
   * @returns {Promise<Object>} - Formatted grades with GPA calculations
   */
  async getStudentGrades(studentId, semester = null) {
    try {
      if (!studentId) {
        throw new AppError("Student id required", 404);
      }

      // Get results from the service
      const results = await this.getResultsForStudent(studentId);

      if (!results || results.length === 0) {
        return {
          semester: semester || "Current Semester",
          semesterGPA: 0,
          cumulativeGPA: 0,
          semesterGrades: []
        };
      }

      // Calculate semester GPA
      let totalPoints = 0;
      let totalCredits = 0;
      const semesterGrades = [];

      for (const result of results) {
        if (result.score !== null) {
          const { grade, point } = GPACalculator.calculateGradeAndPoints(result.score)

          const gradePoint = point
          const credits = 3; // You may want to fetch actual credits from course
          totalPoints += gradePoint * credits;
          totalCredits += credits;

          semesterGrades.push({
            code: result.code,
            name: result.title,
            grade: grade,
            credits: credits,
            gpa: gradePoint,
            score: result.score,
            remark: result.remark
          });
        }
      }

      const semesterGPA = totalCredits > 0 ? totalPoints / totalCredits : 0;
      const cumulativeGPA = semesterGPA; // Simplified - you may want to fetch all semesters

      console.log(semesterGrades)
      return {
        semester: semester || "Current Semester",
        semesterGPA: parseFloat(semesterGPA.toFixed(2)),
        cumulativeGPA: parseFloat(cumulativeGPA.toFixed(2)),
        semesterGrades: semesterGrades,
        studentName: results[0]?.name || null,
        matricNo: results[0]?.matric_no || null,
        department: results[0]?.department || null,
        level: results[0]?.level || null
      };

    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get student grades', 500, error);
    }
  },

  /**
   * Helper function to convert letter grade to grade point
   */
  _convertGradeToPoint(grade) {
    const gradeMap = {
      'A': 4.0,
      'A-': 3.7,
      'B+': 3.3,
      'B': 3.0,
      'B-': 2.7,
      'C+': 2.3,
      'C': 2.0,
      'C-': 1.7,
      'D+': 1.3,
      'D': 1.0,
      'D-': 0.7,
      'F': 0.0
    };
    return gradeMap[grade] || 0.0;
  },










  /**
   * Get student semester result with populated data
   */
  async getStudentSemesterResult(studentId, semesterId, level) {
    const query = { studentId, semesterId };

    const result = await studentSemesterResultModel.findOne(query)
      .populate({
        path: "studentId",
        select: "firstName lastName middleName matricNumber email departmentId programmeId"
      })
      .populate({
        path: "departmentId",
        select: "name code faculty hod"
      })
      .populate({
        path: "semesterId",
        select: "semester session startDate endDate"
      })
      .populate({
        path: "courses.courseId",
        populate: {
          path: "borrowedId",
        },
      })
      .lean();

    if (!result) {
      throw new AppError("Student semester result not found", 404);
    }

    // Format student name
    const student = result.studentId;
    const name = `${student.lastName} ${student.firstName} ${student.middleName || ""}`.trim();

    const departmentDetails =await getDepartmentLeadershipDetails(student.departmentId, semesterId, student.programmeId)

    // Format semester info
    const semesterInfo = {
      semester: result.semesterId?.semester || result.semester,
      session: result.session || result.semesterId?.session
    };

    return {
      ...result,
      name,
      departmentDetails,
      semester: semesterInfo.semester,
      session: semesterInfo.session
    };
  },

  /**
   * Get all semester results for a student (for transcript)
   */
  async getStudentAcademicHistory(studentId) {
    const results = await studentSemesterResultModel.find({
      studentId,
      status: { $in: ["processed", "approved", "published"] }
    })
      .populate({
        path: "semesterId",
        select: "session name"
      })
      .sort({ session: 1, level: 1 })
      .lean();

    if (!results || results.length === 0) {
      throw new AppError("No academic history found for this student", 404);
    }

    // Get student details
    const student = await studentModel.findById(studentId)
      .populate({
        path: "departmentId",
        select: "name code faculty hod dean"
      })
      .populate({
        path: "_id"
      })
      .populate({
        path: "programmeId",
        select: "name code programmeType"
      })
      .lean();

    if (!student) {
      throw new AppError("Student not found", 404);
    }

    // Format student name
    const name = resolveUserName(student._id)

    // Build academic history array
    const academicHistory = results.map(result => ({
      session: result.session,
      semester: result.semesterId?.name || result.semester,
      level: result.level,
      tcp: result.currentTCP || result.totalPoints || 0,
      tnu: result.currentTNU || result.totalUnits || 0,
      gpa: result.gpa || 0,
      cgpa: result.cgpa || 0,
      remark: result.academicStatus || result.remark || "good"
    }));

    // Calculate final statistics
    const latestResult = results[results.length - 1];
    const totalCredits = results.reduce((sum, r) => sum + (r.currentTNU || r.totalUnits || 0), 0);

    // Check graduation eligibility (example logic)
    const eligibleForGraduation = latestResult.cgpa >= 1.0 && totalCredits >= 120;

    const graduationInfo = {
      eligibleForGraduation,
      finalCGPA: latestResult.cgpa,
      totalCredits,
      degreeAwarded: student.programmeId?.name || "Bachelor of Science",
      convocationYear: eligibleForGraduation ? new Date().getFullYear() : null,
      graduationDate: eligibleForGraduation ? new Date() : null
    };

    const departmentDetails =await getDepartmentLeadershipDetails(student.departmentId, null, student.programmeId)


    return {
      studentInfo: {
        ...student,
        name,
        admissionYear: student.admissionYear || student.createdAt?.getFullYear(),
        graduationYear: eligibleForGraduation ? new Date().getFullYear() : null,
        modeOfEntry: student.modeOfEntry || "UTME",
        academicStatus: latestResult.academicStatus || "good"
      },
      academicHistory,
      departmentDetails,
      graduationInfo
    };
  },

  /**
   * Generate PDF from HTML
   */
  async generatePDF(html, options = {}) {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: options.marginTop || "10mm",
          bottom: options.marginBottom || "10mm",
          left: options.marginLeft || "10mm",
          right: options.marginRight || "10mm"
        },
        displayHeaderFooter: options.displayHeaderFooter || false,
        ...options
      });

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  },

  /**
   * Save PDF to temporary file and return path
   */
  async saveTempPDF(pdfBuffer, filename) {
    const tempDir = path.join(__dirname, "../../temp/pdfs");

    // Ensure directory exists
    await fs.mkdir(tempDir, { recursive: true });

    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, pdfBuffer);

    // Schedule file deletion after 1 hour
    setTimeout(async () => {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error(`Failed to delete temp file: ${filePath}`, error);
      }
    }, 3600000); // 1 hour

    return filePath;
  },

  /**
   * Generate and save student semester result PDF
   */
  async generateStudentResultPDF(studentId, semesterId, level, isPreview = false) {
    if (!semesterId) { const semester = await (SemesterService.getActiveAcademicSemester()); semesterId = semester._id }
    try {
      // Get result data
      const resultData = await this.getStudentSemesterResult(studentId, semesterId, level);

      // Generate HTML
      const html = StudentResultHtmlRenderer.render({
        studentResult: resultData,
        departmentDetails: resultData.departmentDetails,
        isPreview
      });

      // Generate PDF
      const pdfBuffer = await this.generatePDF(html, {
        marginTop: "15mm",
        marginBottom: "15mm"
      });

      // Save to temp file
      const filename = `student_result_${resultData.matricNumber.replaceAll('/', '-')}_${level}_${Date.now()}.pdf`;
      const filePath = await this.saveTempPDF(pdfBuffer, filename);

      return {
        filePath,
        filename,
        matricNumber: resultData.matricNumber,
        level: resultData.level
      };
    } catch (error) {
      throw new AppError(`Failed to generate student result PDF: ${error.message}`, 500, error);
    }
  },

  /**
   * Generate and save academic transcript PDF
   */
  async generateTranscriptPDF(studentId, isPreview = false) {
    try {
      // Get academic history
      const transcriptData = await this.getStudentAcademicHistory(studentId);

      // Generate HTML
      const html = ResultTranscriptHtmlRenderer.render({
        studentInfo: transcriptData.studentInfo,
        academicHistory: transcriptData.academicHistory,
        departmentDetails: transcriptData.departmentDetails,
        graduationInfo: transcriptData.graduationInfo,
        isPreview
      });

      // Generate PDF
      const pdfBuffer = await this.generatePDF(html, {
        marginTop: "12mm",
        marginBottom: "12mm"
      });

      // Save to temp file
      // Consider changing from _id to matric number but make
      const filename = `transcript_${transcriptData.studentInfo.matricNumber.replaceAll('/', '-')}_${Date.now()}.pdf`;
      const filePath = await this.saveTempPDF(pdfBuffer, filename);

      return {
        filePath,
        filename,
        matricNumber: transcriptData.studentInfo.matricNumber,
        studentName: transcriptData.studentInfo.name
      };
    } catch (error) {
      throw new AppError(`Failed to generate transcript PDF: ${error.message}`, 500, error);
    }
  },

  /**
   * Get student result as HTML (for preview)
   */
  async getStudentResultHTML(studentId, semesterId, level, isPreview = true) {
    if (!semesterId) { const semester = await (SemesterService.getActiveAcademicSemester()); semesterId = semester._id }

    const resultData = await this.getStudentSemesterResult(studentId, semesterId, level);

    console.log(resultData.departmentDetails)
    return StudentResultHtmlRenderer.render({
      studentResult: resultData,
      departmentDetails: resultData.departmentDetails,
      isPreview
    });
  },

  /**
   * Get transcript as HTML (for preview)
   */
  async getTranscriptHTML(studentId, isPreview = true) {
    const transcriptData = await this.getStudentAcademicHistory(studentId);

    return ResultTranscriptHtmlRenderer.render({
      studentInfo: transcriptData.studentInfo,
      academicHistory: transcriptData.academicHistory,
      departmentDetails: transcriptData.departmentDetails,
      graduationInfo: transcriptData.graduationInfo,
      isPreview
    });
  }

};

export default ResultService;
