import mongoose from "mongoose";
import { mapResults } from "../course/course.dto.js";
import { normalizeCourse } from "../course/course.normallizer.js";
import courseRegistrationModel from "../course/courseRegistration.model.js";
import AppError from "../errors/AppError.js";
import SemesterService from "../semester/semester.service.js";
import StudentService from "../student/student.service.js";
import GPACalculator from "../computation/services/GPACalculator.js";

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
        if ( result.score !== null) {
          const {grade, point} = GPACalculator.calculateGradeAndPoints(result.score)

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
  }
};

export default ResultService;
