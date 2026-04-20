import mongoose from "mongoose";
import Course from "./course.model.js";
import buildResponse from "#utils/responseBuilder.js";
import { dataMaps } from "#config/dataMap.js";
import organizationUnitsModel from "#domain/organization/models/organizationalUnit.model.js";
import fetchDataHelper, { applyTransformations } from "#utils/fetchDataHelper.js";
import CourseService from "./course.service.js";
import courseRegistrationModel from "./courseRegistration.model.js";
import departmentService from "#domain/organization/department/department.service.js";
import { resolveUserName } from "#utils/resolveUserName.js";
import studentModel from "#domain/user/student/student.model.js";
import AppError from "#shared/errors/AppError.js";
import { delay } from "#utils/helpers.js";
import SemesterService from "#domain/semester/semester.service.js";
import courseRegistrationService from "./courseRegistration.service.js";

// Common configuration for fetchDataHelper
const COURSE_FETCH_CONFIG = {
  // forceFind: true,
  configMap: dataMaps.Course,
  autoPopulate: true,
  models: {  organizationUnitsModel },
};

/**
 * Handle HOD authorization
 */
const handleHodAuthorization = async (req) => {
  if (req.user?.role !== "hod") return null;

  try {
    const department = await departmentService.getDepartmentByHod(req.user._id);
    return department;
  } catch (error) {
    return null;
  }
};

/* ===== Create Course ===== */
export const createCourse = async (req, res, next) => {
  try {
    const { courseCode, title, unit, level, semester, type, department, faculty, description, borrowedId } = req.body;
    const userFromMiddleware = req.user;

    // Handle GET-like operations (filtering)
    if (req._intent == "READ") {
      return getAllCourses(req, res, next);
    }

    // HOD restriction
    let resolvedDepartment = department;
    const hodDepartment = await handleHodAuthorization(req);
    if (hodDepartment) {
      resolvedDepartment = hodDepartment._id;
    }
    if (req.user.role == "hod" && !hodDepartment) {
      throw AppError("Hod department not found", 404)
    }
    // Create course
    const course = await CourseService.createCourse(
      {
        courseCode,
        title,
        unit,
        level,
        semester,
        type,
        department: resolvedDepartment,
        faculty,
        description,
        borrowedId,
      },
      userFromMiddleware._id
    );

    // Set audit context for success
    req.auditContext = CourseService.createAuditContext(
      "CREATE_COURSE",
      "SUCCESS",
      `Course ${course.courseCode} created successfully`,
      {
        courseId: course._id,
        courseCode: course.courseCode,
        courseTitle: course.title,
        department: resolvedDepartment,
        borrowedId: borrowedId || null,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
      }
    );

    // Return created course
    return await getCourseById({ params: { courseId: course._id } }, res);
  } catch (error) {

    // Set audit context based on error type
    const status = error.message.includes("required") ||
      error.message.includes("already exists") ||
      error.message.includes("not found") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("required") ? 400 :
      error.message.includes("already exists") ? 409 :
        error.message.includes("not found") ? 404 : 500;

    req.auditContext = CourseService.createAuditContext(
      "CREATE_COURSE",
      status,
      error.message,
      {
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        attemptedData: req.body,
        error: error.message,
      }
    );

    next(error)
  }
};
`
pass list
cso
probation
withdrawal
termination
leave_of_absence
`
/* ===== Get All Courses ===== */
export const getAllCourses = async (req, res, next) => {
  try {
    const { extras } = req.body || {};
    const hodDepartment = await handleHodAuthorization(req);

    if (req.user.role == 'hod') {
      if (!hodDepartment || !hodDepartment._id) {
        throw new AppError("Hod not found for this department", 404)
      }
    }

    // Build filters
    const additionalFilters = {};

    if (extras?.onlyOriginalCourses) {
      additionalFilters.borrowedId = null;
    }

    if (hodDepartment && !req.params.courseId) {
      if (extras?.outsideHodDepartment) {
        additionalFilters["department._id"] = { "$ne": mongoose.Types.ObjectId(hodDepartment._id) }
      } else {

        additionalFilters["department._id"] = new mongoose.Types.ObjectId(String(hodDepartment._id));
      }
    }

    if (req.params.courseId) {
      additionalFilters._id = req.params.courseId;
    }

    const fetchConfig = {
      ...COURSE_FETCH_CONFIG,
      populate: ["department", "borrowedId"],
      ...(Object.keys(additionalFilters).length && { additionalFilters }),
      custom_fields: {
        courseCode: {
          path: "borrowedId.courseCode",
          find: "borrowedId.courseCode",
          fallback: "courseCode",
        },
        courseTitle: {
          path: "borrowedId.title",
          find: "borrowedId.title",
          fallback: "title",
        },
        semester: {
          path: "borrowedId.semester",
          find: "borrowedId.semester",
          fallback: "semester",
        },
        level: {
          path: "borrowedId.level",
          find: "borrowedId.level",
          fallback: "level",
        },
        departmentName: {
          path: "department.name",
          find: "department.name",
        },
      },
    };

    return await fetchDataHelper(req, res, Course, fetchConfig);
  } catch (error) {
    next(error)
  }
};

/* ===== Get Borrowed Courses from My Department ===== */
export const getBorrowedCoursesFromMyDept = async (req, res, next) => {
  try {
    // Ensure user is HOD
    if (req.user?.role !== "hod") {
      req.auditContext = CourseService.createAuditContext(
        "ACCESS_BORROWED_COURSES",
        "FAILURE",
        "Only HOD can access this endpoint",
        {
          attemptedBy: req.user?.role,
          attemptedByUserId: req.user?._id,
        }
      );
      return buildResponse(res, 403, "Only HOD can access this endpoint", null, true);
    }

    // Get HOD's department
    const hodDept = await departmentService.getDepartmentByHod(req.user._id);
    if (!hodDept) {
      req.auditContext = CourseService.createAuditContext(
        "ACCESS_BORROWED_COURSES",
        "FAILURE",
        "Department not found for HOD",
        {
          attemptedBy: req.user.role,
          attemptedByUserId: req.user._id,
        }
      );
      return buildResponse(res, 404, "Department not found for HOD", null, true);
    }

    const fetchConfig = {
      ...COURSE_FETCH_CONFIG,
      populate: ["department", "borrowedId"],
      additionalFilters: {
        borrowedId: { $exists: true },
        "borrowedId.department": hodDept._id,
      },
      custom_fields: {
        courseCode: {
          path: "borrowedId.courseCode",
          find: "borrowedId.courseCode",
          fallback: "courseCode",
        },
        courseTitle: {
          path: "borrowedId.title",
          find: "borrowedId.title",
          fallback: "title",
        },
        borrowingDepartment: {
          path: "department.name",
          find: "department.name",
        },
      },
    };

    const result = await fetchDataHelper(req, res, Course, fetchConfig);
    return;
  } catch (error) {

    req.auditContext = CourseService.createAuditContext(
      "ACCESS_BORROWED_COURSES",
      "ERROR",
      "Failed to fetch borrowed courses",
      {
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        error: error.message,
      }
    );

    next(error)
  }
};

/* ===== Get Course by ID ===== */
export const getCourseById = async (req, res, next) => {
  try {
    const fetchConfig = {
      ...COURSE_FETCH_CONFIG,
      populate: ["department", "borrowedId"],
      additionalFilters: {
        _id: mongoose.Types.ObjectId(req.params.courseId),
      },
    };

    return await fetchDataHelper(req, res, Course, fetchConfig);
  } catch (error) {
    next(error)
  };
}

/* ===== Update Course ===== */
export const updateCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userFromMiddleware = req.user;

    // Get course before update
    const courseBefore = await CourseService.getCourseById(id).catch(() => null);
    if (!courseBefore) {
      req.auditContext = CourseService.createAuditContext(
        "UPDATE_COURSE",
        "FAILURE",
        "Course not found",
        {
          courseId: id,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 404, "Course not found");
    }

    // Update course
    const updatedCourse = await CourseService.updateCourse(id, req.body);

    // Set audit context for success
    req.auditContext = CourseService.createAuditContext(
      "UPDATE_COURSE",
      "SUCCESS",
      `Course ${updatedCourse.courseCode} updated successfully`,
      {
        courseId: id,
        courseCode: updatedCourse.courseCode,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,

      },
      {
        before: {
          courseCode: courseBefore.courseCode,
          title: courseBefore.title,
          unit: courseBefore.unit,
          level: courseBefore.level,
          semester: courseBefore.semester,
        },
        after: {
          courseCode: updatedCourse.courseCode,
          title: updatedCourse.title,
          unit: updatedCourse.unit,
          level: updatedCourse.level,
          semester: updatedCourse.semester,
        },
      }
    );

    return buildResponse(res, 200, "Course updated successfully", updatedCourse);
  } catch (error) {

    // Set audit context based on error type
    const status = error.message.includes("not found") ||
      error.message.includes("already exists") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 :
      error.message.includes("already exists") ? 409 : 500;

    req.auditContext = CourseService.createAuditContext(
      "UPDATE_COURSE",
      status,
      error.message,
      {
        courseId: req.params.id,
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        updateData: req.body,
        error: error.message,
      }
    );

    next(error)
  }
};

/* ===== Delete Course ===== */
export const deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userFromMiddleware = req.user;

    // throw new AppError("You are not allowed to delete a course as it is dangerous", 403)
    // Get course before deletion
    const courseBefore = await CourseService.getCourseById(id).catch(() => null);
    if (!courseBefore) {
      req.auditContext = CourseService.createAuditContext(
        "DELETE_COURSE",
        "FAILURE",
        "Course not found",
        {
          courseId: id,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 404, "Course not found");
    }

    // Delete course
    const deletedCourse = await CourseService.deleteCourse(id);

    // Set audit context for success
    req.auditContext = CourseService.createAuditContext(
      "DELETE_COURSE",
      "SUCCESS",
      `Course ${deletedCourse.courseCode} deleted successfully`,
      {
        courseId: id,
        courseCode: deletedCourse.courseCode,
        courseTitle: deletedCourse.title,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        deletedAt: new Date().toISOString(),
      }
    );

    return buildResponse(res, 200, "Course deleted successfully");
  } catch (error) {

    // Set audit context based on error type
    const status = error.message.includes("not found") ||
      error.message.includes("Cannot delete") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 :
      error.message.includes("Cannot delete") ? 400 : 500;

    req.auditContext = CourseService.createAuditContext(
      "DELETE_COURSE",
      status,
      error.message,
      {
        courseId: req.params.id,
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        error: error.message,
      }
    );

    next(error)
  }
};

/* ===== Assign Course ===== */
export const assignCourse = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { course: selectedCourseId, staffId: lecturer, assignToAll = true } = req.body;
    const userFromMiddleware = req.user;

    // Assign course
    const result = await CourseService.assignCourse(
      selectedCourseId,
      lecturer,
      userFromMiddleware._id,
      assignToAll,
      session
    );

    await session.commitTransaction();
    session.endSession();

    // Set audit context for success
    req.auditContext = CourseService.createAuditContext(
      "ASSIGN_COURSE",
      "SUCCESS",
      `Course assigned successfully to ${result.totalAssigned} related courses`,
      {
        courseId: selectedCourseId,
        lecturerId: lecturer,
        originalCourseId: result.originalCourse._id,
        originalCourseCode: result.originalCourse.courseCode,
        totalAssigned: result.totalAssigned,
        assignToAll,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
      }
    );

    return buildResponse(
      res,
      201,
      assignToAll
        ? `Course assigned successfully to ${result.totalAssigned} related courses`
        : `Course assigned successfully to ${result.courseData.courseCode}`,
      result.createdAssignments
    );
  } catch (error) {
    // Handle transaction cleanup
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }


    // Set audit context based on error type
    const status = error.message.includes("not found") ||
      error.message.includes("Only the HOD") ||
      error.message.includes("No courses") ||
      error.message.includes("No active semester") ||
      error.code === 11000 ? "FAILURE" : "ERROR";
    const statusCode = error.code === 11000 ? 400 :
      error.message.includes("not found") ? 404 :
        error.message.includes("Only the HOD") ||
          error.message.includes("No courses") ||
          error.message.includes("No active semester") ? 400 : 500;

    req.auditContext = CourseService.createAuditContext(
      "ASSIGN_COURSE",
      status,
      error.message,
      {
        courseId: req.body.course,
        lecturerId: req.body.staffId,
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        assignToAll: req.body.assignToAll,
        error: error.message,
      }
    );

    next(error)
  }
};



// Below still needs to remove buildReponse from catch blocks to avoid sending server erros to the client




/* ===== Unassign Course ===== */
export const unassignCourse = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { course: selectedCourseId, staffId: lecturer, unassignAll = true } = req.body;
    const userFromMiddleware = req.user;

    // Unassign course
    const result = await CourseService.unassignCourse(
      selectedCourseId,
      lecturer,
      unassignAll,
      session,
      userFromMiddleware._id
    );

    await session.commitTransaction();
    session.endSession();

    // Set audit context for success
    req.auditContext = CourseService.createAuditContext(
      "UNASSIGN_COURSE",
      "SUCCESS",
      `Course unassigned from ${result.totalRemoved} courses`,
      {
        courseId: selectedCourseId,
        lecturerId: lecturer,
        totalRemoved: result.totalRemoved,
        totalFailed: result.totalFailed,
        unassignAll,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
      }
    );

    const responseData = {
      removedAssignments: result.removedAssignments,
      failedUnassignments: result.failedUnassignments,
      totalRemoved: result.totalRemoved,
      totalFailed: result.totalFailed,
      lecturerProvided: !!lecturer,
    };

    // Build response message
    let message = "";
    if (result.totalRemoved === 0 && result.totalFailed > 0) {
      message = "Failed to unassign from any courses";
      return buildResponse(res, 404, message, responseData, true);
    } else if (result.totalFailed > 0) {
      message = `Unassigned from ${result.totalRemoved} course(s), but failed for ${result.totalFailed} course(s)`;
      return buildResponse(res, 207, message, responseData);
    } else {
      const lecturerText = lecturer ? `lecturer ${lecturer}` : "the assigned lecturer";
      message = unassignAll
        ? `${lecturerText} unassigned successfully from ${result.totalRemoved} related courses`
        : `${lecturerText} unassigned successfully from course`;
      return buildResponse(res, 200, message, responseData);
    }
  } catch (error) {
    // Handle transaction cleanup
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }


    // Set audit context based on error type
    const status = error.message.includes("not found") ||
      error.message.includes("Only the HOD") ||
      error.message.includes("No courses") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 :
      error.message.includes("Only the HOD") ||
        error.message.includes("No courses") ? 400 : 500;

    req.auditContext = CourseService.createAuditContext(
      "UNASSIGN_COURSE",
      status,
      error.message,
      {
        courseId: req.body.course,
        lecturerId: req.body.staffId,
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        unassignAll: req.body.unassignAll,
        error: error.message,
      }
    );

    // return (res, statusCode, error.message, null, true, error);
    next(error)
  }
};

/* ===== Register Courses ===== */
export const registerCourses = async (req, res, next) => {
  try {
    const { courses: selectedCourseIds, notes } = req.body;
    let studentId = req.body.studentId || req.user._id;

    if(req.user.role == 'hod'){
      studentId = req.body.studentId;
    }else{
      studentId = req.user._id
    }
    // Register courses
    const registration = await CourseService.registerCourses(
      req.user,
      req.body,
    );

    // Set audit context for success
    req.auditContext = CourseService.createAuditContext(
      "REGISTER_COURSES",
      "SUCCESS",
      "Courses registered successfully",
      {
        studentId: studentId,
        registrationId: registration._id,
        totalCourses: selectedCourseIds.length,
        totalUnits: registration.totalUnits,
        semester: registration.semester,
        session: registration.session,
        performedBy: req.user.role,
        performedByUserId: req.user._id,
        notes: notes
      }
    );

    return buildResponse(res, 201, "Courses registered successfully", registration);
  } catch (error) {

    // Set audit context based on error type
    const status = error.message.includes("not found") ||
      error.message.includes("already registered") ||
      error.message.includes("must be between") ||
      error.message.includes("required") ||
      error.message.includes("Prerequisites") ||
      error.message.includes("Carryover") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 :
      error.message.includes("already registered") ||
        error.message.includes("must be between") ||
        error.message.includes("required") ||
        error.message.includes("Prerequisites") ||
        error.message.includes("Carryover") ? 400 : 500;

    req.auditContext = CourseService.createAuditContext(
      "REGISTER_COURSES",
      status,
      error.message,
      {
        studentId: req.user?._id,
        attemptedCourses: req.body.courses,
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        error: error.message,
      }
    );

    next(error)
  }
};

/* ===== Get Lecturer Courses ===== */
export const getLecturerCourses = async (req, res, next) => {
  try {
    const lecturerId = req.user._id;

    // Get lecturer courses
    const courses = await CourseService.getLecturerCourses(lecturerId);

    // Set audit context for success
    req.auditContext = CourseService.createAuditContext(
      "GET_LECTURER_COURSES",
      "SUCCESS",
      "Lecturer courses fetched successfully",
      {
        lecturerId,
        totalCourses: courses?.length,
        performedBy: req.user.role,
        performedByUserId: req.user._id,
      }
    );

    return buildResponse(res, 200, "Lecturer courses fetched", courses);
  } catch (error) {

    req.auditContext = CourseService.createAuditContext(
      "GET_LECTURER_COURSES",
      "ERROR",
      "Failed to fetch lecturer courses",
      {
        lecturerId: req.user?._id,
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        error: error.message,
      }
    );

    next(error)
  }
};

/* ===== Get Course Registration Report ===== */
export const getCourseRegistrationReport = async (req, res, next) => {
  try {
    const { level, semester, session } = req.query;
    const userFromMiddleware = req.user;

    // Get report
    const report = await CourseService.getCourseRegistrationReport(
      userFromMiddleware._id,
      userFromMiddleware.role,
      { level, semester, session }
    );

    // Set audit context for success
    req.auditContext = CourseService.createAuditContext(
      "GET_COURSE_REPORT",
      "SUCCESS",
      "Course registration report generated successfully",
      {
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        filters: { level, semester, session },
      }
    );

    return res.status(200).json({
      success: true,
      role: userFromMiddleware.role,
      filters_applied: {
        level: level || "all",
        semester: semester || "all",
        session: session || "all",
      },
      summary: {
        ...report.summary,
        carryovers: report.carryoverSummary.total || 0,
      },
      charts: {
        status_chart: report.statusChart,
        level_chart: report.levelChart,
        semester_chart: report.semesterChart,
        carryover_reason_chart: report.carryoverReasonChart,
        carryover_status_chart: report.carryoverStatusChart,
      },
    });
  } catch (error) {

    req.auditContext = CourseService.createAuditContext(
      "GET_COURSE_REPORT",
      "ERROR",
      "Failed to generate course registration report",
      {
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        error: error.message,
      }
    );

    next(error)
  }
};

/* ===== Get Registerable Courses ===== */
export const getRegisterableCourses = async (req, res, next) => {
  try {
    const studentId = req.user._id;

    // Get registerable courses
    const student = await studentModel.findById(studentId);
    if (!student) throw new AppError("Student not found");

    const semester = await SemesterService.getActiveAcademicSemester();

    if (!semester) throw new AppError("Active semester not found");

    // Find courses for student's department, level, and semester
    const level = Number(student.level);
    const courses = await CourseService.getRegisterableCourses(studentId);
    const result = await applyTransformations(courses, dataMaps.Course)

    // Set audit context for success
    // req.auditContext = CourseService.createAuditContext(
    //   "GET_REGISTERABLE_COURSES",
    //   "SUCCESS",
    //   "Registerable courses fetched successfully",
    //   {
    //     studentId,
    //     totalCourses: courses.length,
    //     performedBy: req.user.role,
    //     performedByUserId: req.user._id,
    //   }
    // );

    const fetchConfig = {
      configMap: dataMaps.Course,
      autoPopulate: true,
      models: { organizationUnitsModel },
      populate: ["department", "borrowedId"],
      // data: courses,
      // custom_fields: {
      //   borrowedIdSemester: { path: "borrowedId.semester" },
      //   borrowedIdLevel: { path: "borrowedId.level" },
      // },
      additionalFilters: {
        department: student.departmentId,
        $and: [

          {
            $or: [
              { semester: semester.name },
              { "borrowedId.semester": semester.name },
            ],
          },
          {
            $or: [
              { level },
              { "borrowedId.level": level },
            ],
          },
        ],
      }
    };

    // Use fetchDataHelper for consistent response formatting
    // const result = await fetchDataHelper(req, res, Course, fetchConfig);
    return buildResponse.success(res, "Success", result);
  } catch (error) {

    req.auditContext = CourseService.createAuditContext(
      "GET_REGISTERABLE_COURSES",
      "ERROR",
      "Failed to fetch registerable courses",
      {
        studentId: req.user?._id,
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        error: error.message,
      }
    );

    next(error)
  }
};

/* ===== Cleanup Inactive Courses ===== */
export const cleanupInactiveCourses = async (req, res, next) => {
  try {
    const userFromMiddleware = req.user;

    // Only admin can cleanup
    if (userFromMiddleware.role !== "admin") {
      req.auditContext = CourseService.createAuditContext(
        "CLEANUP_COURSES",
        "FAILURE",
        "Only admin can cleanup inactive courses",
        {
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 403, "Only admin can cleanup inactive courses", null, true);
    }

    const result = await Course.deleteMany({ status: "Inactive" });

    // Set audit context for success
    req.auditContext = CourseService.createAuditContext(
      "CLEANUP_COURSES",
      "SUCCESS",
      `${result.deletedCount} inactive courses removed`,
      {
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        deletedCount: result.deletedCount,
      }
    );

    return buildResponse(res, 200, `${result.deletedCount} inactive courses removed`);
  } catch (error) {

    req.auditContext = CourseService.createAuditContext(
      "CLEANUP_COURSES",
      "ERROR",
      "Failed to cleanup inactive courses",
      {
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        error: error.message,
      }
    );
    next(error)
  }
};

// Note: Some functions like getStudentsForCourse and getStudentRegistrations 
// were not fully optimized in this pass due to complexity and time constraints.
// They follow similar patterns and can be refactored using the same approach.

export const getStudentsForCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const user = req.user;

    if (!courseId) {
      return res.status(400).json({ message: "courseId is required" });
    }

    // 1️⃣ Check if the course exists
    const course = await Course.findById(courseId).lean();
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // 2️⃣ Role Based Department Restriction
    let allowedDepartment = null;

    if (user.role === "admin") {
      // Admin can see all
      allowedDepartment = null;
    } else if (user.role === "hod") {
      const dept = await organizationUnitsModel.findOne({ hod: user._id }).lean();
      if (!dept) return res.status(404).json({ message: "HOD department not found" });
      allowedDepartment = dept._id;
    } else {
      // Students can only view their own dept's course (if allowed)
      allowedDepartment = user.departmentId;
    }

    // If course belongs to another department
    if (allowedDepartment && String(course.department) !== String(allowedDepartment)) {
      // return res.status(403).json({ message: "Not allowed to view students for this course" });
    }

    // 3️⃣ Prepare payload for fetchDataHelper
    const payload = {
      ...req.query,
      filter: {
        course: courseId,
        ...req.query.filter,
      },
      // Add department filter if applicable
      ...(allowedDepartment && {
        additionalFilters: {
          // courses
        }
      })
    };

    const options = {
      returnType: "object",
      populate: [
        {
          path: "semester",
          select: "name session",
        },
        {
          path: "student",  // This populates the User document
          select: "matricNumber level gender departmentId",
          // // model: "User",
          populate: [{
            path: "user",  // User._id references the Student document
            select: "first_name last_name middle_name title email",
          }]
        },

      ],

      // Sort configuration
      sort: { createdAt: -1 },

      // Pagination
      enablePagination: false,
      limit: 1000,

      // Return type
      returnType: 'object',
      additionalFilters: {
        courses: courseId
      }
      ,
      // UPDATED ConfigMap for your actual structure
      configMap: {
        // Basic user info from the populated student (which is actually User)
        name: async (doc) => resolveUserName(doc.student?.user, "course.controller"),

        email: async (doc) => doc.student?.user.email || "",

        // Student-specific info comes from student._id (populated Student document)
        gender: async (doc) => doc.student?._id?.gender || "",

        matric_no: async (doc) => doc.student?.matricNumber || "",

        level: async (doc) => doc.student?.level || "",

        semesterName: async (doc) => doc.semester?.name || "",

        session: async (doc) => doc.semester?.session || "",

        registrationLevel: async (doc) => doc.level || "",

        // Department - note the different path
        department: async (doc, model) => {
          // Department is in the Student document, not User
          if (doc.student?._id?.departmentId) {
            const dept = await mongoose.model('Department').findById(doc.student.departmentId).lean();
            return dept?.name || "N/A";
          }
          return "N/A";
        }
      }
    };

    // 5️⃣ Use fetchDataHelper correctly
    const result = await fetchDataHelper(req, res, courseRegistrationModel, options);

    // 6️⃣ Handle response
    if (!result.data || result.data.length === 0) {
      return res.status(200).json({
        message: "No student has registered for this course yet",
        data: [],
        courseInfo: {
          courseId,
          courseName: course.name,
          courseCode: course.code,
        },
      });
    }

    // 7️⃣ Return structured response
    return res.status(200).json({
      message: "Students retrieved successfully",
      count: result.data.length,
      courseInfo: {
        courseId,
        courseName: course.name,
        courseCode: course.code,
        department: course.department,
      },
      data: result.data,
      metadata: {
        timestamp: new Date().toISOString(),
        requestedBy: {
          userId: user._id,
          role: user.role,
        },
        filtersApplied: {
          courseId,
          departmentFilter: allowedDepartment ? "applied" : "none",
        },
      },
    });

  } catch (error) {
    next(error)
  }
};
export const getStudentRegistrations = async (req, res, next) => {
  try {
    let { session } = req.query;   // semester removed from query
    let studentId = req.params.studentId;

    // Student: force their own ID
    if (req.user.role === "student") {
      studentId = req.user._id;
    }

    // HOD validation
    if (req.user.role === "hod") {
      if (!studentId) {
        return buildResponse.error(res, "studentId is required for HOD");
      }

      const hodDept = await organizationUnitsModel.findOne({ hod: req.user._id }).lean();
      if (!hodDept) return buildResponse.error(res, "HOD department not found");

      const targetStudent = await studentModel.findById(studentId).lean();
      if (!targetStudent) return buildResponse.error(res, "Student not found");

      if (String(targetStudent.departmentId) !== String(hodDept._id)) {
        return buildResponse.error(res, "You can only access students in your department");
      }
    }

    // Fetch student
    const student = await studentModel.findById(studentId).lean();
    if (!student) {
      return buildResponse.error(res, "Student not found");
    }

    // 1️⃣ Determine active semester ALWAYS
    const departmentId =
      req.user.role === "hod"
        ? (await organizationUnitsModel.findOne({ hod: req.user._id }).lean())?._id
        : student.departmentId;

    if (!departmentId) {
      return buildResponse.error(res, "Department not found");
    }

    const currentSemester = await SemesterService.getActiveAcademicSemester()
    // const currentSemester = null

    if (!currentSemester) {
      return buildResponse.error(res, "Active semester not found");
    }

    // 2️⃣ Build filter ALWAYS using active semester
    const filter = {
      student: studentId,
      semester: currentSemester._id
    };

    // 3️⃣ Fetch registrations
    // let registrations = await courseRegistrationModel.find(filter)
    //   .populate("student courses semester approvedBy")
    //   .sort({ createdAt: -1 })
    //   .lean();

    // // 4️⃣ Borrowed courses resolution
    // let tty = []
    // for (const reg of registrations) {
    //   reg.courses = await Promise.all(
    //     reg.courses.map(async (course) => {
    //       if (!course.borrowedId) { tty.push({ ...course, borrowedId: null }); return course };

    //       const original = await Course.findById(course.borrowedId).lean();
    //       // return original || course;
    //       tty.push({ ...course, borrowedId: original });

    //       return
    //     })
    //   );
    // }
    // const transformation = await applyTransformations([...tty], dataMaps.Course)
    // registrations = transformation
    const registrations = await courseRegistrationService.getRegistrationsByStudent(studentId, currentSemester._id);
    return buildResponse.success(res, "Registrations fetched", registrations);

  }
  catch (err) {
    next(err)
  }
};
