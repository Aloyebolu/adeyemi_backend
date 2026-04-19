import mongoose from "mongoose";
import Course from "./course.model.js";
import CourseAssignment from "./courseAssignment.model.js";
import CourseRegistration from "./courseRegistration.model.js";
import Department from "#domain/organization/department/department.model.js";
import User from "#domain/user/user.model.js";
import lecturerModel from "#domain/user/lecturer/lecturer.model.js";
import studentModel from "#domain/user/student/student.model.js";
import CarryoverCourse from "#domain/user/student/carryover/carryover.model.js";
import departmentService from "#domain/organization/department/department.service.js";
import courseAssignmentModel from "./courseAssignment.model.js";
import fetchDataHelper from "#utils/fetchDataHelper.js";
import { dataMaps } from "#config/dataMap.js";
import courseModel from "./course.model.js";
import AppError from "#shared/errors/AppError.js";
import studentService from "#domain/user/student/student.service.js";
import SemesterService from "#domain/semester/semester.service.js";
import { normalizeCourse } from "./course.normallizer.js";

class CourseService {
  /**
   * Validate course data
   */
  validateCourseData(courseData, isBorrowed = false) {
    const { courseCode, title, unit, level, semester, department } = courseData;

    if (!isBorrowed) {
      if (!courseCode || !title || !unit || !level || !semester || !department) {
        throw new AppError("Missing Required Fields");
      }

      // Validate unit is positive number
      if (unit <= 0) {
        // throw new AppError("Course unit must be greater than 0");
      }
    }

    return true;
  }

  /**
   * Check for duplicate course code
   */
  async checkDuplicateCourse(courseCode, excludeId = null) {
    const query = { courseCode };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await Course.findOne(query);
    if (existing) {
      throw new AppError("Course with this code already exists");
    }
  }

  /**
   * Create new course
   */
  async createCourse(courseData, createdBy = null) {
    const {
      courseCode,
      title,
      unit,
      level,
      semester,
      type,
      department,
      faculty,
      description,
      borrowedId,
      scope
    } = courseData;

    const isBorrowed = !!borrowedId;

    // Validate course data
    this.validateCourseData(courseData, isBorrowed);

    // For borrowed courses, validate original exists
    if (isBorrowed) {
      const original = await Course.findById(borrowedId);
      if (!original) {
        throw new AppError("Original course not found");
      }
      // 🔴 Prevent duplicate borrowed course
      const existingBorrowed = await Course.findOne({
        borrowedId,
        department,
      });

      if (existingBorrowed) {
        throw new AppError("This course has already been borrowed for this department");
      }
    } else {
      // For original courses, check duplicate
      await this.checkDuplicateCourse(courseCode);
    }


    // Create course
    const course = await Course.create({
      courseCode,
      title,
      unit,
      level,
      semester,
      type: type || "core",
      department,
      faculty,
      scope: scope || 'department',
      description,
      borrowedId: borrowedId || null,
      createdBy,
    });

    return course;
  }

  /**
   * Get course by ID with populated data
   */
  async getCourseById(courseId) {
    const course = await Course.findById(courseId)
      .populate("department", "name")
      .populate("borrowedId", "courseCode title unit level semester department");

    if (!course) {
      throw new AppError("Course not found");
    }

    return course;
  }

  async getCoursesByIds(courseIds) {
    const courses = await Course.find({
      _id: { $in: courseIds }
    })
      .populate("department", "name")
      .populate("borrowedId", "courseCode title unit level semester department");

    if (!courses || courses.length === 0) {
      throw new AppError("No courses found");
    }

    // Optional: Check if all requested courses were found
    if (courses.length !== courseIds.length) {
      const foundIds = courses.map(c => c._id.toString());
      const missingIds = courseIds.filter(id => !foundIds.includes(id));
      throw new AppError(`Courses not found: ${missingIds.join(', ')}`);
    }

    const normalizedCourse = normalizeCourse(courses)
    return normalizeCourse;
  }
  /**
   * Update course
   */
  async updateCourse(courseId, updateData) {
    const course = await Course.findById(courseId);
    if (!course) {
      throw new AppError("Course not found");
    }

    // Check for duplicate if updating courseCode
    if (updateData.courseCode && updateData.courseCode !== course.courseCode) {
      await this.checkDuplicateCourse(updateData.courseCode, courseId);
    }

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        course[key] = updateData[key];
      }
    });

    await course.save();
    return course;
  }

  /**
   * Delete course
   */
  async deleteCourse(courseId) {
    const course = await Course.findById(courseId);
    if (!course) {
      throw new AppError("Course not found");
    }

    // Check for dependencies (assignments, registrations)
    const [assignments, registrations] = await Promise.all([
      CourseAssignment.countDocuments({ course: courseId }),
      CourseRegistration.countDocuments({ courses: courseId }),
    ]);

    if (assignments > 0 || registrations > 0) {
      throw new AppError(
        `Cannot delete course with ${assignments} assignments and ${registrations} registrations`
      );
    }

    const deleted = await courseModel.findByIdAndUpdate(
      courseId,
      { deletedAt: new Date() },
      { new: true }
    );

    if (!deleted) return buildResponse(res, 404, "Course not found");
    return deleted;
  }

  /**
   * Assign course to lecturer
   */
  async assignCourse(courseId, lecturerId, assignedBy, assignToAll = true, session = null) {
    const options = session ? { session } : {};

    // Fetch the selected course
    const courseData = await Course.findById(courseId).session(session);
    if (!courseData) throw new AppError("Course not found");

    // Determine original course ID
    const originalCourseId = courseData.borrowedId || courseId;

    // Get original course for ownership validation
    const originalCourse = await Course.findById(originalCourseId).session(session);
    if (!originalCourse) throw new AppError("Original course not found");

    // HOD permission check
    const hodDept = await Department.findOne({ hod: assignedBy }).session(session);
    if (hodDept && !originalCourse.department.equals(hodDept._id)) {
      throw new AppError(
        "Only the HOD of the original department can assign lecturers to this course",
        403
      );
    }

    // ✅ Ensure lecturer belongs to the ORIGINAL course department
    const lecturerDepartment = await departmentService.getUserDepartment(lecturerId);

    if (!lecturerDepartment) {
      throw new AppError("Unable to determine lecturer department", 404);
    }

    const lecturerDeptId = lecturerDepartment._id || lecturerDepartment;

    if (!lecturerDeptId.equals(originalCourse.department)) {
      throw new AppError(
        "Lecturer does not belong to the department that owns this course",
        400
      );
    }

    // Determine which courses to assign
    let coursesToAssign = [];
    if (assignToAll) {
      coursesToAssign = await Course.find({
        $or: [{ _id: originalCourseId }, { borrowedId: originalCourseId }],
      }).session(session);
    } else {
      coursesToAssign = [courseData];
    }

    if (coursesToAssign.length === 0) {
      throw new AppError("No courses found to assign");
    }

    const assignmentsToCreate = [];

    for (const courseToAssign of coursesToAssign) {
      const assignmentDeptId = courseToAssign.department;
      if (!assignmentDeptId) {
        throw new AppError(`Department not found for course ${courseToAssign.courseCode}`);
      }

      // Fetch active semester for that department
      const currentSemester = await SemesterService.getActiveAcademicSemester()
      if (!currentSemester) {
        // Currently when one of the courses department have no semester it is going to quit the process making the assignment not completed to all the coursesTossign
        throw new AppError(
          `No active semester for department of ${courseToAssign.courseCode}`
        );
      }

      const { _id: semester, session: academicSession } = currentSemester;

      // Check for existing assignment
      const existingAssignment = await CourseAssignment.findOne({
        course: courseToAssign._id,
        semester,
        session: academicSession,
        department: assignmentDeptId,
      }).session(session);

      if (existingAssignment) {
        existingAssignment.lecturer = lecturerId;
        existingAssignment.assignedBy = assignedBy;
        await existingAssignment.save({ session });
        assignmentsToCreate.push(existingAssignment);
      } else {
        assignmentsToCreate.push({
          course: courseToAssign._id,
          lecturer: lecturerId,
          semester,
          session: academicSession,
          department: assignmentDeptId,
          assignedBy,
        });
      }
    }

    // Create new assignments
    const createdAssignments = [];
    for (const assignmentData of assignmentsToCreate) {
      if (assignmentData._id) {
        createdAssignments.push(assignmentData);
      } else {
        const newAssignment = await CourseAssignment.create([assignmentData], { session });
        createdAssignments.push(newAssignment[0]);
      }
    }

    return {
      createdAssignments,
      totalAssigned: createdAssignments.length,
      originalCourse,
      courseData,
    };
  }


  /**
   * Unassign course from lecturer
   */
  async unassignCourse(courseId, lecturerId, unassignAll = true, session = null, hodId) {
    const options = session ? { session } : {};

    // Fetch the selected course
    const courseData = await Course.findById(courseId).session(session);
    if (!courseData) throw new AppError("Course not found");

    // Determine original course ID
    const originalCourseId = courseData.borrowedId || courseId;

    // Get original course for HOD check
    const originalCourse = await Course.findById(originalCourseId).session(session);
    if (!originalCourse) throw new AppError("Original course not found");

    // HOD permission check
    const hodDept = await departmentService.getDepartmentByHod(hodId);
    if (hodDept && originalCourse.department.toString() !== hodDept._id.toString()) {
      throw new AppError("Only the HOD of the original department can unassign lecturers from this course");
    }

    // Determine which courses to unassign
    let coursesToUnassign = [];
    if (unassignAll) {
      coursesToUnassign = await Course.find({
        $or: [{ _id: originalCourseId }, { borrowedId: originalCourseId }],
      }).session(session);
    } else {
      coursesToUnassign = [courseData];
    }

    if (coursesToUnassign.length === 0) {
      throw new AppError("No courses found to unassign");
    }

    const removedAssignments = [];
    const failedUnassignments = [];

    for (const courseToUnassign of coursesToUnassign) {
      const assignmentDeptId = courseToUnassign.department;
      if (!assignmentDeptId) {
        failedUnassignments.push({
          course: courseToUnassign.courseCode,
          error: "Department not found",
        });
        continue;
      }

      // Fetch active semester
      const currentSemester = await SemesterService.getActiveAcademicSemester()

      if (!currentSemester) {
        failedUnassignments.push({
          course: courseToUnassign.courseCode,
          error: "No active semester for department",
        });
        continue;
      }

      const { _id: semester, session: academicSession } = currentSemester;

      // Build delete query
      const deleteQuery = {
        course: courseToUnassign._id,
        semester,
        session: academicSession,
        department: assignmentDeptId,
      };

      if (lecturerId) {
        deleteQuery.lecturer = lecturerId;
      }

      // Delete assignment
      const deletedAssignment = await CourseAssignment.findOneAndDelete(deleteQuery).session(session);

      if (deletedAssignment) {
        removedAssignments.push(deletedAssignment);
      } else {
        failedUnassignments.push({
          course: courseToUnassign.courseCode,
          error: "No assignment found for this course",
        });
      }
    }

    return {
      removedAssignments,
      failedUnassignments,
      totalRemoved: removedAssignments.length,
      totalFailed: failedUnassignments.length,
    };
  }



  /**
   * Get lecturer courses
   */
  async getLecturerCourses(lecturerId) {
    try {

      // 1️⃣ Ensure lecturer exists
      const lecturer = await lecturerModel.findById(lecturerId).lean();
      if (!lecturer) {
        throw new AppError("Lecturer not found");
      }



      // 3️⃣ Filter only ACTIVE semesters
      const activeSemester = await SemesterService.getActiveAcademicSemester();

      const activeSemesterId = activeSemester._id
      if (!activeSemesterId) {
        throw new AppError("No active semester found");
      }

      // 4️⃣ Let fetchDataHelper do its magic
      const result = await fetchDataHelper({}, {}, courseAssignmentModel, {
        returnType: "object",
        forceFind: true,
        configMap: dataMaps.CourseAssignment,
        autoPopulate: true,
        models: { courseModel, lecturerModel },
        additionalFilters: {
          lecturer: mongoose.Types.ObjectId(lecturerId),
          semester: mongoose.Types.ObjectId(activeSemesterId)
          // BYPASS: SHOULD FILTER BASED ON SEMESTER
          // session: "2024/2025"
          // createdAt: { $gte: new Date(Date.now() - 50 * 60 * 1000) }

        },
        populate: [
          {
            path: "course",
            populate: [
              {
                path: "borrowedId",
                select: "courseCode title unit level semester department",
                populate: {
                  path: "department",
                  select: "name" // nested department inside borrowedId
                }
              },
              {
                path: "department",
                select: "name" // top-level department on course
              }
            ]
          },
          "semester"
        ]

      });

      return result.data

    } catch (err) {
      throw new Error(err);
    }
  };



  /**
   * Get course registration report
   */
  async getCourseRegistrationReport(userId, userRole, filters = {}) {
    const { level, semester, session } = filters;

    let matchFilter = {};
    let carryoverFilter = {};

    // Role-based filtering for HOD
    if (userRole === "hod") {
      const department = await Department.findOne({ hod: userId });
      if (!department) throw new AppError("Department not found for this HOD");

      matchFilter.department = department._id;
      carryoverFilter.department = department._id;
    }

    // Apply filters
    if (level) matchFilter.level = Number(level);
    if (semester) {
      matchFilter.semester = semester;
      carryoverFilter.semester = semester;
    }
    if (session) matchFilter.session = session;

    // Get summary
    const [summary, carryoverSummary, statusChart, levelChart, semesterChart, carryoverReasonChart, carryoverStatusChart] = await Promise.all([
      // Summary
      CourseRegistration.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            total_registrations: { $sum: 1 },
            approved: { $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } },
            total_units: { $sum: "$totalUnits" },
          },
        },
      ]),

      // Carryover summary
      CarryoverCourse.aggregate([
        { $match: carryoverFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            cleared: { $sum: { $cond: [{ $eq: ["$cleared", true] }, 1, 0] } },
            uncleared: { $sum: { $cond: [{ $eq: ["$cleared", false] }, 1, 0] } },
          },
        },
      ]),

      // Status chart
      CourseRegistration.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: "$status",
            value: { $sum: 1 },
          },
        },
        {
          $project: { _id: 0, label: "$_id", value: 1 },
        },
      ]),

      // Level chart
      CourseRegistration.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: "$level",
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: { _id: 0, level: "$_id", total: 1 },
        },
      ]),

      // NOTED: SHOULD USE NEW ACADEMIC SEMESTER MODEL
      // Semester chart
      CourseRegistration.aggregate([
        { $match: matchFilter },
        {
          $lookup: {
            from: "semesters",
            localField: "semester",
            foreignField: "_id",
            as: "semester_info",
          },
        },
        {
          $unwind: {
            path: "$semester_info",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: { $ifNull: ["$semester_info.name", "Unknown"] },
            total: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            semester: "$_id",
            total: 1,
          },
        },
      ]),

      // Carryover reason chart
      CarryoverCourse.aggregate([
        { $match: carryoverFilter },
        {
          $group: {
            _id: "$reason",
            value: { $sum: 1 },
          },
        },
        {
          $project: { _id: 0, label: "$_id", value: 1 },
        },
      ]),

      // Carryover status chart
      CarryoverCourse.aggregate([
        { $match: carryoverFilter },
        {
          $group: {
            _id: "$cleared",
            total: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            label: { $cond: [{ $eq: ["$_id", true] }, "Cleared", "Uncleared"] },
            total: 1,
          },
        },
      ]),
    ]);

    return {
      summary: summary[0] || {},
      carryoverSummary: carryoverSummary[0] || {},
      statusChart,
      levelChart,
      semesterChart,
      carryoverReasonChart,
      carryoverStatusChart,
    };
  }



  async fetchCourses({ departmentId, semesterName, level, programmeId }) {
    const programmeObjectId = new mongoose.Types.ObjectId(programmeId);
    const courses = await Course.aggregate([
      {
        $match: {
          department: new mongoose.Types.ObjectId(departmentId),
          deletedAt: null,
        },
      },
      {
        $lookup: {
          from: "courses",
          localField: "borrowedId",
          foreignField: "_id",
          as: "borrowedId",
        },
      },
      {
        $unwind: {
          path: "$borrowedId",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $match: {
          $and: [
            {
              $or: [
                { semester: semesterName },
                { "borrowedId.semester": semesterName },
              ],
            },
            {
              $or: [
                { level: level },
                { "borrowedId.level": level },
              ],
            },
          ],
        },
      },
      {
        $addFields: {
          allowedProgrammes: {
            $ifNull: [
              "$overrides.allowed_programmes",
              "$borrowedId.overrides.allowed_programmes"
            ]
          }
        }
      },

      // Programme filtering
      // Programme filtering
      {
        $match: {
          $or: [
            { allowedProgrammes: { $eq: null } },
            { allowedProgrammes: { $size: 0 } },
            { allowedProgrammes: { $in: [programmeObjectId] } }
          ]
        }
      },

      // {
      //   $project: {
      //     _id: 1,
      //     courseCode: { $ifNull: ["$courseCode", "$borrowed.courseCode"] },
      //     title: { $ifNull: ["$title", "$borrowed.title"] },
      //     unit: { $ifNull: ["$unit", "$borrowed.unit"] },
      //     level: { $ifNull: ["$level", "$borrowed.level"] },
      //     semester: { $ifNull: ["$semester", "$borrowed.semester"] },
      //     type: 1,
      //   },
      // },

      { $limit: 100 },
    ]);

    const normalized  = normalizeCourse(courses);
    return normalized
    return courses
  }



  async getCurriculumCourses(departmentId, semesterName, level, programmeId) {
    try {
      if (!departmentId || !semesterName || !level) {
        throw new Error("Missing parameters for curriculum lookup");
      }

      return await this.fetchCourses({
        departmentId,
        semesterName,
        level,
        programmeId
      });

    } catch (error) {
      throw new AppError(
        "Error fetching curriculum courses: " + error.message,
        500
      );
    }
  }




  /**
   * Get registerable courses for student
   */
  async getRegisterableCourses(studentId) {
    const student = await studentModel.findById(studentId);
    if (!student) throw new AppError("Student not found");

    const semester = await SemesterService.getActiveAcademicSemester();
    if (!semester) throw new AppError("Active semester not found");

    const level = Number(student.level);

    return await this.fetchCourses({
      departmentId: student.departmentId,
      semesterName: semester.name,
      level: level,
      programmeId: student.programmeId
    });
  }


  /**
   * Create audit context
   */
  createAuditContext(action, status, reason, metadata = {}, changes = {}) {
    let severity = "MEDIUM";
    if (status === "ERROR") severity = "CRITICAL";
    if (status === "FAILURE" && reason.includes("Unauthorized")) severity = "HIGH";
    if (action.includes("DELETE")) severity = "HIGH";

    return {
      action,
      resource: "Course",
      severity,
      entityId: metadata.courseId || null,
      status,
      changes,
      reason,
      metadata: {
        performedBy: metadata.performedBy,
        performedByUserId: metadata.performedByUserId,
        ...metadata,
      },
    };
  }
}

export default new CourseService();