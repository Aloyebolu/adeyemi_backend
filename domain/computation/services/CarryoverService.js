// computation/services/CarryoverService.js
import mongoose from "mongoose";
import CarryoverCourse from "../../carryover/carryover.model.js";
import studentModel from "../../student/student.model.js";
import ResultService from "./ResultService.js";
import { resolveUserName } from "../../../utils/resolveUserName.js";
import AppError from "../../errors/AppError.js";
import studentService from "../../student/student.service.js";
import courseService from "../../course/course.service.js";
import { SYSTEM_USER_ID } from "../../../config/system.js";
import { normalizeCourse } from "../../course/course.normallizer.js";

class CarryoverService {

  /**
   * Get previous carryovers for a batch of students
   * @param {Array} studentIds - Array of student IDs
   * @returns {Promise<Object>} Carryovers grouped by student ID
   */
  async getCarryoversByStudents(studentIds, semesterId) {
    const carryovers = await CarryoverCourse.find({
      student: { $in: studentIds },
      semester: { $in: semesterId },
      cleared: false
    })
      .populate("student", "name matricNumber")
      .populate({
        path: "courses.course",
        model: "Course",
        select: "courseCode title credits type level",
        populate: {
          path: "borrowedId",
          select: "courseCode title credits type level"
        }
      })
      .lean();

    const result = {};

    for (const carryover of carryovers) {
      carryover.courses = carryover.courses || [];
      const studentId = carryover.student._id.toString();
      if (!result[studentId]) result[studentId] = [];

      for (const courseItem of carryover.courses) {
        result[studentId].push({
          _id: carryover._id,
          student: carryover.student,
          course: courseItem.course,
          semester: carryover.semester,
          department: carryover.department,
          result: courseItem.result,
          grade: courseItem.grade,
          score: courseItem.score,
          reason: carryover.reason,
          isCoreCourse: courseItem.isCoreCourse,
          cleared: carryover.cleared,
          clearedAt: carryover.clearedAt,
          clearedBy: carryover.clearedBy,
          attempts: courseItem.attempts,
          remark: courseItem.remark,
          createdBy: carryover.createdBy,
          computationBatch: carryover.computationBatch,
          createdAt: carryover.createdAt,
          updatedAt: carryover.updatedAt
        });
      }
    }
    console.log("Fetched carryovers for students:", Object.keys(result).length);

    return result;
  }



  /**
 * Calculate outstanding courses
 * @param {string} studentId - Student ID
 * @param {string} currentSemesterId - Current semester ID
 * @returns {Promise<Array>} Outstanding courses
 */
  async calculateOutstandingCourses(
    studentId,
    currentSemesterId,
    academicStanding = null,
    results = [],
    allCourses = [],
    previousCarryovers = [],
    options = { cumulative: true, registrations: [], computationId: null }
  ) {
    const registrations = options.registrations || [];
    const seenCourses = new Set(); // Track across ALL sections

    try {
      const outstandingCourses = [];

      // -------------------------
      // 1. FAILED COURSES
      // -------------------------
      const failedResults = results.filter(r => r.grade === "F");

      for (const result of failedResults) {
        const course = result.courseId;
        if (!course) continue;

        const courseId = course._id?.toString() || course.toString();

        if (seenCourses.has(courseId)) continue;
        seenCourses.add(courseId);

        if (!result.courseId.courseCode) {
          throw new AppError(`Course code not found ${result.courseId}, ${result}`)
        }

        if (course.type === "elective") continue;

        const base = normalizeCourse(course)

        if (!base.courseCode) {
          throw new AppError(`Course code not found, ${base}`)
        }

        outstandingCourses.push({
          student: studentId,
          course: base._id,
          semester: currentSemesterId,
          department: course.department?._id ?? null,
          result: result._id,
          grade: result.grade,
          score: result.score,
          reason: "failed",
          isCoreCourse: course.type == "core",
          cleared: false,
          clearedAt: null,
          clearedBy: null,
          attempts: 1,
          remark: null,
          createdBy: options.computedBy ?? SYSTEM_USER_ID,
          computationBatch: options.computationId ?? null,
          status: 'new',

          // keep other keys untouched
          courseCode: base.courseCode,
          courseTitle: base.title,
          unitLoad: base.unit ?? 1,
          fromSemester: currentSemesterId,
          isCurrentSemester: true,
          isBorrowed: !!course.borrowedId,
          originalCourseCode: course.borrowedId ? course.courseCode : null
        });
      }

      // -------------------------
      // 2. NOT REGISTERED / CARRYOVER
      // -------------------------
      const registeredIds = new Set(
        registrations
          .map(r => {
            if (!r) {
              throw new AppError(`Invalid registration data for student ${studentId}. Course registration entry is null or undefined.`);
            }
            if (r.courseId?._id) return r.courseId._id.toString();
            if (r.courseId) return r.courseId.toString();
            return null;
          })
          .filter(Boolean)
      );

      const passedIds = new Set(
        results
          .filter(r => r.grade && r.grade !== "F")
          .map(r => r.courseId?._id?.toString() || r.courseId?.toString())
          .filter(Boolean)
      );

      for (const course of allCourses) {
        const id = course._id.toString();
        if (seenCourses.has(id)) continue;

        const isRegistered = registeredIds.has(id);
        const isPassed = passedIds.has(id);

        let reason = null;
        let attempts = 0;
        if (!isRegistered && !isPassed) reason = "not_registered";
        else if (isRegistered && !isPassed) {
          reason = "carryover";
          attempts = 1;
        }
        if (!reason) continue;

        seenCourses.add(id);

        outstandingCourses.push({
          student: studentId,
          course: course._id,
          semester: currentSemesterId,
          department: course.department?._id ?? null,
          result: null,
          grade: null,
          score: null,
          reason,
          isCoreCourse: course.type === "core",
          cleared: false,
          clearedAt: null,
          clearedBy: null,
          attempts,
          remark: null,
          createdBy: options.computedBy ?? SYSTEM_USER_ID,
          computationBatch: options.computationId ?? null,
          status: 'new',

          // keep other keys untouched
          courseCode: course.courseCode,
          courseTitle: course.title,
          unitLoad: course.unit ?? 1,
          fromSemester: currentSemesterId,
          isCurrentSemester: true,
          isBorrowed: false,
          originalCourseCode: null
        });
      }

      // -------------------------
      // 3. MERGE PREVIOUS CARRYOVERS
      // -------------------------
      if (options.cumulative && previousCarryovers.length > 0) {
        for (const carryover of previousCarryovers) {
          const course = carryover.course;
          if (!course) continue;

          const id = course._id.toString();
          if (seenCourses.has(id)) continue;
          seenCourses.add(id);

          const base = course.borrowedId || course;

          outstandingCourses.push({
            student: carryover.student ?? studentId,
            course: base._id,
            semester: carryover.semester ?? null,
            department: carryover.department?._id ?? null,
            result: carryover.result ?? null,
            grade: carryover.grade ?? null,
            score: carryover.score ?? null,
            reason: "carryover",
            isCoreCourse: course.type === "core",
            cleared: carryover.cleared ?? false,
            clearedAt: carryover.clearedAt ?? null,
            clearedBy: carryover.clearedBy ?? null,
            attempts: carryover.attempts ?? 1,
            remark: carryover.remark ?? null,
            createdBy: carryover.createdBy ?? SYSTEM_USER_ID,
            computationBatch: carryover.computationBatch ?? null,
            status: 'old',

            // keep other keys untouched
            courseCode: base.courseCode,
            courseTitle: base.title,
            unitLoad: base.credits ?? base.unit ?? 1,
            fromSemester: carryover.semester ?? null,
            isCurrentSemester: false,
            isBorrowed: !!course.borrowedId,
            originalCourseCode: course.borrowedId ? course.courseCode : null,

            ...carryover
          });
        }
      }

      return outstandingCourses;

    } catch (error) {
      console.error(`Error calculating outstanding courses:`, error);
      return [];
    }
  }

/**
 * Convert old flat carryover objects to new array-based structure and add to bulkWriter
 * @param {Array} carryovers - Array of old format carryover objects
 * @param {Object} bulkWriter - BulkWriter instance
 */
addCarryoversToBulkWriter(carryovers, bulkWriter) {
  // Group carryovers by student + semester combination
  const groupedCarryovers = new Map();

  for (const carryover of carryovers) {
    // Create a unique key for student+semester
    const key = `${carryover.student}_${carryover.semester}`;

    if (!groupedCarryovers.has(key)) {
      groupedCarryovers.set(key, {
        student: carryover.student,
        semester: carryover.semester,
        department: carryover.department,
        reason: carryover.reason,
        cleared: carryover.cleared,
        clearedAt: carryover.clearedAt,
        clearedBy: carryover.clearedBy,
        createdBy: carryover.createdBy,
        computationBatch: carryover.computationBatch,
        courses: []
      });
    }

    // Add course to the courses array
    const group = groupedCarryovers.get(key);
    group.courses.push({
      course: carryover.course,
      result: carryover.result,
      grade: carryover.grade,
      score: carryover.score,
      isCoreCourse: carryover.isCoreCourse,
      attempts: carryover.attempts,
      remark: carryover.remark,
      reason: carryover.reason,
      status: carryover.status,
      ...carryover
    });
  }

  // Add each grouped document to bulkWriter
  for (const [key, carryoverDoc] of groupedCarryovers) {
    bulkWriter.addCarryover(carryoverDoc);
  }
}

// Then in your code, use it like:

}

export default new CarryoverService();
