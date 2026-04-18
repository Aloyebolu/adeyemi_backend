// computation/services/ResultService.js
import mongoose from "mongoose";
import Result from "#domain/result/result.model.js";
import courseModel from "#domain/course/course.model.js";
import AppError from "#shared/errors/AppError.js";
import studentSemesterResultModel from "#domain/user/student/student.semseterResult.model.js";

class ResultService {
  /**
   * Fetch results for multiple students in a semester
   * @param {Array} studentIds - Array of student IDs
   * @param {string} semesterId - Semester ID
   * @returns {Promise<Object>} Results grouped by student
   */
  async getResultsByStudents(studentIds, semesterId) {
    try {
      const results = await Result.find({
        studentId: { $in: studentIds },
        semester: { $in: semesterId },
        deletedAt: null,
      })
        .populate({
          path: "courseId",
          select: "type isCoreCourse title courseCode unit level borrowedId department",
          populate: {
            path: "borrowedId",
            select: "type isCoreCourse title courseCode unit level",
          }
        })
        .lean();

      // Process each result to handle borrowed courses
      const processedResults = results.map(result => {
        if (result.courseId) {
          result.courseId = this.processBorrowedCourse(result.courseId);
        }

        return result;
      });

      // Group results by student ID for efficient processing
      const finalResult = processedResults.reduce((acc, raw) => {
        const normalized = {
          ...raw,
          courseId: raw.courseId?._id || raw.courseId,
        };

        const doc = new Result(normalized);
        const error = doc.validateSync();

        if (error) {
          console.warn("Validation failed:", {
            studentId: raw?.studentId,
            errors: Object.values(error.errors).map(e => e.message)
          });
          return acc;
        }

        const studentId = doc.studentId.toString();

        if (!acc[studentId]) acc[studentId] = [];
        acc[studentId].push(raw); // no need toObject again

        return acc;
      }, {});

      return finalResult
    } catch (error) {
      console.error(`Error fetching results for semester ${semesterId}:`, error);
      throw new AppError(`Failed to fetch results: ${error.message}`);
    }
  }

  /**
   * Fetch previous semester results for a batch of students
   * @param {Array<string|ObjectId>} studentIds
   * @param {string|ObjectId} currentSemesterId
   * @returns {Promise<Object>} keyed by studentId
   */
  async getPreviousResultsByStudents(studentIds, currentSemesterId) {
    if (!studentIds || studentIds.length === 0) return {};

    // Fetch all previous results for this batch
    const previousResults = await studentSemesterResultModel
      .find({
        studentId: { $in: studentIds },
        semesterId: { $in: currentSemesterId },
        isPreview: false
      })
      .select("studentId semesterId totalPoints totalUnits currentTCP currentTNU cumulativeTCP cumulativeTNU cgpa")
      .lean();

    // Group by studentId
    const resultsByStudent = previousResults.reduce((acc, r) => {
      const sid = r.studentId.toString();
      if (!acc[sid]) acc[sid] = [];
      acc[sid].push(r);
      return acc;
    }, {});

    return resultsByStudent;
  }
  /**
   * Process borrowed course data - merges borrowed course with original course data
   * @param {Object} course - Course document
   * @returns {Object} Processed course data
   */
  processBorrowedCourse(course) {
    if (!course) return null;

    // If course has borrowedId and borrowedId is populated
    if (course.borrowedId && typeof course.borrowedId === 'object') {
      const originalCourse = course.borrowedId;
      return {
        _id: course._id,
        borrowedId: originalCourse._id,
        department: course.department, // Keep the borrowing department
        type: originalCourse.type,
        isCoreCourse: originalCourse.isCoreCourse,
        title: originalCourse.title,
        courseCode: originalCourse.courseCode,
        unit: originalCourse.unit,
        level: originalCourse.level,
        isBorrowed: true,
        originalCourseCode: originalCourse.courseCode,
        originalTitle: originalCourse.title
      };
    }

    // For non-borrowed courses or if population didn't work
    return {
      ...course,
      isBorrowed: false
    };
  }

  /**
   * Get course details with borrowed course handling
   * @param {string} courseId - Course ID
   * @returns {Promise<Object>} Course information
   */
  async getCourseDetails(courseId) {
    try {
      const course = await courseModel.findById(courseId)
        .select("type isCoreCourse title courseCode unit level borrowedId department")
        .populate({
          path: 'borrowedId',
          select: 'type isCoreCourse title courseCode unit level',
        })
        .lean();

      if (!course) {
        return null;
      }

      return this.processBorrowedCourse(course);

    } catch (error) {
      console.error(`Error fetching course ${courseId}:`, error);
      return null;
    }
  }

  /**
   * Check if a course is a core course (handles borrowed courses)
   * @param {string} courseId - Course ID
   * @returns {Promise<boolean>} True if core course
   */
  async isCoreCourse(courseId) {
    try {
      const course = await this.getCourseDetails(courseId);
      if (!course) return false;

      // Check both isCoreCourse field and type field
      return course.isCoreCourse === true || course.type === "core";
    } catch (error) {
      console.error(`Error checking if course ${courseId} is core:`, error);
      return true; // Default to true to be safe
    }
  }

  /**
   * Get all core courses for a department and level (handles borrowed courses)
   * @param {string} departmentId - Department ID
   * @param {number} level - Academic level
   * @returns {Promise<Array>} List of core courses
   */
  async getCoreCourses(departmentId, level) {
    try {
      // First get courses from the department (including borrowed ones)
      const courses = await courseModel.find({
        department: departmentId,
        level: level
      })
        .select("_id title courseCode unit level borrowedId department type isCoreCourse")
        .populate({
          path: 'borrowedId',
          select: 'type isCoreCourse title courseCode unit level',
        })
        .lean();

      // Process to handle borrowed courses and filter core courses
      const coreCourses = courses
        .map(course => this.processBorrowedCourse(course))
        .filter(course => course.isCoreCourse === true || course.type === "core");

      return coreCourses;

    } catch (error) {
      console.error(`Error fetching core courses for department ${departmentId}, level ${level}:`, error);
      return [];
    }
  }

  /**
   * Check if student has results in semester
   * @param {string} studentId - Student ID
   * @param {string} semesterId - Semester ID
   * @returns {Promise<boolean>} True if student has results
   */
  async hasStudentResults(studentId, semesterId, courseId = null) {
    try {
      const count = await Result.countDocuments({
        studentId,
        semester: semesterId,
        courseId,
        deletedAt: null
      });
      return count > 0;
    } catch (error) {
      console.error(`Error checking results for student ${studentId}:`, error);
      return false;
    }
  }
}

export default new ResultService();