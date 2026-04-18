import mongoose from "mongoose";
import courseRegistrationModel from "./courseRegistration.model.js";
import CourseRegistration from "./courseRegistration.model.js";

import { normalizeCourse } from "./course.normallizer.js";
import AppError from "#shared/errors/AppError.js";
import departmentService from "#domain/department/department.service.js";
import SemesterService from "#domain/semester/semester.service.js";
import studentService from "#domain/user/student/student.service.js";
import courseModel from "./course.model.js";
import CarryoverCourse from "#domain/user/student/carryover/carryover.model.js";
import studentModel from "#domain/user/student/student.model.js";
import AuditLogService from "#domain/auditlog/auditlog.service.js";
import Result from "#domain/result/result.model.js";
import courseService from "./course.service.js";

class RegistrationService {

  /**
   * Get registrations for MANY students (used in batch computation)
   * Returns map: { studentId: [courses...] }
   */
  async getRegistrationsByStudents(studentIds, semesterId) {
    const registrations = await courseRegistrationModel.find({
      student: { $in: studentIds.map(id => new mongoose.Types.ObjectId(id)) },
      semester: { $in: semesterId },
    })
      .populate({
        path: "courses",
        select: "courseCode title unit level semester type borrowedId",
        populate: {
          path: "borrowedId",
          select: "courseCode title unit level semester type",
        }
      })
      .lean();

    const map = {};

    for (const reg of registrations) {
      const sid = reg.student.toString();

      if (!map[sid]) map[sid] = [];

      for (const regCourse of reg.courses || []) {
        const course = normalizeCourse(regCourse);
        map[sid].push({
          courseId: course._id,
          courseCode: course.courseCode,
          title: course.title,
          unit: course.unit,
          level: course.level,
          semester: course.semester,
          type: course.type,
          registrationId: reg._id,
          exceededMaxUnits: reg.exceededMaxUnits || false,
          belowMinUnits: reg.belowMinUnits || false,

        });
      }
    }

    return map;
  }

  /**
   * Get registrations for ONE student
   * Returns array of enriched course objects
   */
  async getRegistrationsByStudent(studentId, semesterId) {
    if(!semesterId){
      semesterId = await SemesterService.getActiveAcademicSemester(semesterId)
    }
    const registrations = await courseRegistrationModel.find({
      student: studentId,
      semester: semesterId,
    })
      .populate({
      path: "courses",
      select: "courseCode title unit level semester type department borrowedId",
      populate: [
        {
        path: "department",
        select: "name",
        },
        {
        path: "borrowedId",
        select: "courseCode title unit level semester type",
        },
      ],
      })
      .sort({ createdAt: -1 })
      .lean();

    const courses = [];
    for (const reg of registrations) {
      for (const regCourse of reg.courses || []) {
        const course = normalizeCourse(regCourse);
        courses.push({
          courseId: course._id,
          courseCode: course.courseCode,
          title: course.title,
          unit: course.unit,
          level: course.level,
          semester: course.semester,
          type: course.type,
          registrationId: reg._id,
          department: course.department ? course.department.name : "N/A",
        });
      }
    }

    return courses;
  }

  /**
   * Register courses for student
   */
  // async registerCourses(studentId, courseIds, userRole, notes = null, department = null) {
  // async registerCourses(userFromMiddleware, reqBody, reqUser) {
  //   const { courses: courseIds, notes, department } = reqBody;
  //   let studentId = reqBody.studentId;

  //   // 1️⃣ Resolve student
  //   if (!userFromMiddleware || !userFromMiddleware._id) {
  //     throw new AppError("Invalid user context");
  //   }

  //   if (["admin", "hod"].includes(userFromMiddleware.role)) {
  //     if (!studentId) throw new AppError("studentId required");
  //     if (!reqBody.notes) throw new AppError("A note is required to register for a student")
  //   } else if (userFromMiddleware.role === "student") {
  //     studentId = userFromMiddleware._id;
  //   } else {
  //     throw new AppError("Unauthorized role", 403);
  //   }

  //   const student = await studentService.getStudentById(studentId);
  //   if (!student) throw new AppError("Student not found");

  //   const level = student.level;
  //   const studentDepartment = student.departmentId;

  //   // 2️⃣ Semester resolution
  //   const currentSemester = await SemesterService.getActiveAcademicSemester();
  //   if (!currentSemester) throw new AppError("No active semester");

  //   const { _id: semesterId, session: academicSession } = currentSemester;

  //   const deptId =
  //     userFromMiddleware.role === "admin"
  //       ? department
  //       : userFromMiddleware.role === "hod"
  //         ? (await departmentService.getDepartmentByHod(userFromMiddleware._id))._id
  //         : studentDepartment;

  //   const departmentSemester = await SemesterService.getDepartmentSemester(deptId);
  //   const settings = departmentSemester?.levelSettings?.find(
  //     l => String(l.level) === String(level)
  //   );

  //   if (!settings) throw new AppError(`No semester settings for level ${level}`);

  //   const { minUnits, maxUnits, minCourses, maxCourses } = settings;

  //   // 3️⃣ Prevent duplicate registration
  //   const existingReg = await CourseRegistration.findOne({
  //     student: studentId,
  //     semester: semesterId,
  //     session: academicSession,
  //   });
  //   // if (existingReg) throw new AppError("Already registered this semester");

  //   const has_duplicates = new Set(courseIds).size !== courseIds.length;

  //   if (has_duplicates) {
  //     throw new AppError("Duplicate course IDs detected");
  //   }
  //   // 4️⃣ Fetch selected courses (single query)
  //   const selectedCourses = await courseModel.find({ _id: { $in: courseIds } }).populate("borrowedId");

  //   if (selectedCourses.length !== courseIds.length) {
  //     throw new AppError("Some courses not found");
  //   }

  //   // Ensure department match
  //   for (const c of selectedCourses) {
  //     if (String(c.department) !== String(studentDepartment)) {
  //       throw new AppError(`Course ${c.courseCode} not in student's department`);
  //     }
  //   }

  //   // 5️⃣ Resolve borrowed courses efficiently
  //   const resolvedCourses = selectedCourses.map(c =>
  //     c.borrowedId
  //       ? { ...c.borrowedId.toObject(), _id: c._id, borrowedFrom: c.borrowedId._id }
  //       : c.toObject()
  //   );

  //   let finalCourseIds = [...courseIds.map(id => id.toString())];

  //   // 6️⃣ Carryover handling (REALISTIC RULE)
  //   const carryovers = await CarryoverCourse.find({
  //     student: studentId,
  //     cleared: false,
  //   }).populate("course");

  //   for (const carry of carryovers) {
  //     const carryId = carry.course._id.toString();

  //     if (!finalCourseIds.includes(carryId)) {
  //       finalCourseIds.unshift(carryId); // add carryovers first
  //       resolvedCourses.unshift(carry.course.toObject());
  //     }
  //   }

  //   // 7️⃣ Validate unit load AFTER merging carryovers
  //   const totalUnits = resolvedCourses.reduce((s, c) => s + (c.unit || 0), 0);

  //   if (totalUnits > maxUnits) {
  //     throw new AppError(
  //       `Carryovers + selected courses exceed max units (${maxUnits}). Reduce courses.`
  //     );
  //   }

  //   if (totalUnits < minUnits) {
  //     throw new AppError(`Total units must be at least ${minUnits}`);
  //   }

  //   // 8️⃣ Validate course count
  //   if (finalCourseIds.length < minCourses || finalCourseIds.length > maxCourses) {
  //     throw new AppError(`Course count must be between ${minCourses} and ${maxCourses}`);
  //   }

  //   // 9️⃣ Batch prerequisite check
  //   const prereqIds = resolvedCourses.flatMap(c => c.prerequisites || []);

  //   if (prereqIds.length) {
  //     const passed = await CourseRegistration.find({
  //       student: studentId,
  //       status: "Approved",
  //       courses: { $in: prereqIds },
  //     }).distinct("courses");

  //     for (const course of resolvedCourses) {
  //       if (!course.prerequisites?.length) continue;

  //       const unmet = course.prerequisites.filter(
  //         p => !passed.includes(p.toString())
  //       );

  //       if (unmet.length) {
  //         throw new AppError(`Prerequisites not met for ${course.title}`);
  //       }
  //     }
  //   }

  //   // 🔟 Core course validation (correct source)
  //   const coreAssignments = await this.getRegisterableCourses(student._id);

  //   // Filter core courses from the registerable courses
  //   const coreCourses = coreAssignments.filter(course => course.type === 'core');

  //   // Check which core courses are missing from registration
  //   const missingCore = coreCourses.filter(
  //     course => !finalCourseIds.includes(course._id.toString())
  //   );

  //   if (missingCore.length > 0) {
  //     const missingCodes = missingCore.map(c => c.courseCode).join(', ');
  //     throw new AppError(`All core courses must be registered, missing: ${missingCodes}`, 400);
  //   }

  //   // 1️⃣1️⃣ Attempt number (simple working version)
  //   const previousRegs = await CourseRegistration.countDocuments({
  //     student: studentId,
  //   });

  //   const attemptNumber = previousRegs + 1;

  //   // 1️⃣2️⃣ Save registration
  //   const newReg = new CourseRegistration({
  //     student: studentId,
  //     courses: finalCourseIds,
  //     semester: semesterId,
  //     session: academicSession,
  //     level,
  //     totalUnits,
  //     attemptNumber,
  //     registeredBy: userFromMiddleware._id,
  //     notes: userFromMiddleware.role === "student" ? null : notes,
  //     department: deptId,
  //   });

  //   await newReg.save();
  //   return newReg;
  // }
  /**
   * Centralized course validation function
   * Validates everything and returns the validated data or throws errors
   */
async validateAndPrepareRegistration(userFromMiddleware, reqBody) {
    const { courses: courseIds, notes, department } = reqBody;
    let studentId = reqBody.studentId;

    console.log(courseIds)
    // 1️⃣ Resolve student
    if (!userFromMiddleware || !userFromMiddleware._id) {
        throw new AppError("Invalid user context");
    }

    if (["admin", "hod"].includes(userFromMiddleware.role)) {
        if (!studentId) throw new AppError("studentId required");
        if (!reqBody.notes) throw new AppError("A note is required to register for a student");
    } else if (userFromMiddleware.role === "student") {
        studentId = userFromMiddleware._id;
    } else {
        throw new AppError("Unauthorized role", 403);
    }

    const student = await studentService.getStudentById(studentId);
    if (!student) throw new AppError("Student not found");

    const level = student.level;
    const studentDepartment = student.departmentId;

    // 2️⃣ Semester resolution
    const currentSemester = await SemesterService.getActiveAcademicSemester();
    if (!currentSemester) throw new AppError("No active semester");

    const { _id: semesterId, session: academicSession } = currentSemester;

    const deptId = userFromMiddleware.role === "admin"
        ? department
        : userFromMiddleware.role === "hod"
            ? (await departmentService.getDepartmentByHod(userFromMiddleware._id))._id
            : studentDepartment;

    const departmentSemester = await SemesterService.getDepartmentSemester(deptId);
    const settings = departmentSemester?.levelSettings?.find(
        l => String(l.level) === String(level)
    );

    if (!settings) throw new AppError(`No semester settings for level ${level}`);

    const { minUnits, maxUnits, minCourses, maxCourses } = settings;

    // 3️⃣ Check for duplicate registration
    const existingReg = await CourseRegistration.findOne({
        student: studentId,
        semester: semesterId,
        session: academicSession,
    });
    if (existingReg) throw new AppError("You have already registered for courses this semester \n\n If you need to update your course registration kindly contact you HOD", 400, null, {quitChatBotSession: true});

    // 4️⃣ Check for duplicate course IDs
    if (new Set(courseIds).size !== courseIds.length) {
        throw new AppError("Duplicate course IDs detected");
    }

    // 5️⃣ Fetch and validate courses
    const selectedCourses = await courseModel.find({ _id: { $in: courseIds } }).populate("borrowedId");

    if (selectedCourses.length !== courseIds.length) {
        throw new AppError("Some courses not found");
    }

    // 6️⃣ Validate department match
    for (const c of selectedCourses) {
        if (String(c.department) !== String(studentDepartment)) {
            throw new AppError(`Course ${c.courseCode} not in student's department`);
        }
    }

    // 7️⃣ Resolve borrowed courses
    const resolvedCourses = selectedCourses.map(c =>
        c.borrowedId
            ? { ...c.borrowedId.toObject(), _id: c._id, borrowedFrom: c.borrowedId._id }
            : c.toObject()
    );

    let finalCourseIds = [...courseIds.map(id => id.toString())];

    // 8️⃣ Handle carryovers
    const carryovers = await CarryoverCourse.find({
        student: studentId,
        cleared: false,
    }).populate("course");

    for (const carry of carryovers) {
        const carryId = carry.course._id.toString();
        if (!finalCourseIds.includes(carryId)) {
            finalCourseIds.unshift(carryId);
            resolvedCourses.unshift(carry.course.toObject());
        }
    }

    // 9️⃣ Validate total units with carryovers
    const totalUnits = resolvedCourses.reduce((s, c) => s + (c.unit || 0), 0);

    if (totalUnits > maxUnits) {
        const excess = totalUnits - maxUnits;
        const sortedCourses = [...resolvedCourses].sort((a, b) => b.unit - a.unit);
        
        let accumulated = totalUnits;
        const suggestedToRemove = [];
        for (const course of sortedCourses) {
            if (accumulated <= maxUnits) break;
            accumulated -= course.unit;
            suggestedToRemove.push(`${course.courseCode} (${course.unit} units)`);
        }
        
        let suggestionText = "";
        if (suggestedToRemove.length > 0) {
            suggestionText = "\n\nSuggestions: Consider removing these courses:\n" + suggestedToRemove.join("\n");
            suggestionText += `\n\nThis would bring your total to approximately ${accumulated} units.`;
        }
        
        throw new AppError(`Total units (${totalUnits}) exceeds maximum allowed (${maxUnits}). You need to reduce by ${excess} units.${suggestionText}`);
    }

    if (totalUnits < minUnits) {
        const deficit = minUnits - totalUnits;
        
        const availableCourses = await courseService.getRegisterableCourses(student._id);
        const selectedCourseIds = new Set(resolvedCourses.map(c => c._id.toString()));
        
        const eligibleCourses = availableCourses
            .filter(c => !selectedCourseIds.has(c._id.toString()))
            .sort((a, b) => a.unit - b.unit);
        
        let tempUnits = totalUnits;
        const suggestedCourses = [];
        
        for (const course of eligibleCourses) {
            if (tempUnits + course.unit <= maxUnits) {
                tempUnits += course.unit;
                suggestedCourses.push(`${course.courseCode} (${course.unit} units)`);
                if (tempUnits >= minUnits) break;
            }
        }
        
        let suggestionText = "";
        if (suggestedCourses.length > 0 && tempUnits >= minUnits) {
            suggestionText = "\n\nSuggestions: Add these courses to reach the minimum:\n" + suggestedCourses.join("\n");
            suggestionText += `\n\nYour total would become ${tempUnits} units.`;
        } else if (eligibleCourses.length > 0) {
            const smallestCourses = eligibleCourses.slice(0, 3);
            suggestionText = "\n\nSuggestions: Consider adding smaller unit courses like:\n" + smallestCourses.map(c => `${c.courseCode} (${c.unit} units)`).join("\n");
        }
        
        throw new AppError(`Total units (${totalUnits}) is below the minimum required (${minUnits}). You need ${deficit} more units.${suggestionText}`);
    }

    // 🔟 Validate course count
    if (finalCourseIds.length < minCourses) {
        const deficit = minCourses - finalCourseIds.length;
        const availableCourses = await courseService.getRegisterableCourses(student._id);
        const selectedCourseIds = new Set(resolvedCourses.map(c => c._id.toString()));
        const availableToAdd = availableCourses
            .filter(c => !selectedCourseIds.has(c._id.toString()))
            .slice(0, 5);
        
        let suggestionText = "";
        if (availableToAdd.length > 0) {
            suggestionText = "\n\nSuggestions: You can add these courses:\n" + availableToAdd.map(c => `${c.courseCode} - ${c.title} (${c.unit} units)`).join("\n");
        }
        
        throw new AppError(`You have selected ${finalCourseIds.length} courses but the minimum is ${minCourses}. You need ${deficit} more course(s).${suggestionText}`);
    }
    
    if (finalCourseIds.length > maxCourses) {
        const excess = finalCourseIds.length - maxCourses;
        throw new AppError(`You have selected ${finalCourseIds.length} courses but the maximum is ${maxCourses}. Please remove ${excess} course(s).`);
    }

    // 1️⃣1️⃣ Validate prerequisites
    const prereqIds = resolvedCourses.flatMap(c => c.prerequisites || []);
    if (prereqIds.length) {
        const passed = await CourseRegistration.find({
            student: studentId,
            status: "Approved",
            courses: { $in: prereqIds },
        }).distinct("courses");

        for (const course of resolvedCourses) {
            if (!course.prerequisites?.length) continue;
            const unmet = course.prerequisites.filter(p => !passed.includes(p.toString()));
            if (unmet.length) {
                throw new AppError(`Prerequisites not met for ${course.title}. Please complete the prerequisite courses first or remove this course from your selection.`);
            }
        }
    }

    // 1️⃣2️⃣ Validate core courses
    const coreAssignments = await courseService.getRegisterableCourses(student._id);
    const coreCourses = coreAssignments.filter(course => course.type === 'core');
    const missingCore = coreCourses.filter(course => !finalCourseIds.includes(course._id.toString()));

    if (missingCore.length > 0) {
        const missingCodes = missingCore.map(c => c.courseCode).join(', ');
        throw new AppError(`All core courses must be registered. You are missing these core courses: ${missingCodes}. Please add them to your registration.`, 400);
    }

    // 1️⃣3️⃣ Calculate attempt number
    const previousRegs = await CourseRegistration.countDocuments({ student: studentId });
    const attemptNumber = previousRegs + 1;

    // Return all validated data for insertion
    return {
        studentId,
        finalCourseIds,
        semesterId,
        academicSession,
        level,
        totalUnits,
        attemptNumber,
        registeredBy: userFromMiddleware._id,
        notes: userFromMiddleware.role === "student" ? null : notes,
        department: deptId,
        userFromMiddleware,
        resolvedCourses
    };
}
  /**
   * Simple register function - just validates and inserts
   */
  async registerCourses(userFromMiddleware, reqBody, reqUser) {
    // All validation happens here
    const validatedData = await this.validateAndPrepareRegistration(userFromMiddleware, reqBody, reqUser);

    // Just save the registration
    const newReg = new CourseRegistration({
      student: validatedData.studentId,
      courses: validatedData.finalCourseIds,
      semester: validatedData.semesterId,
      session: validatedData.academicSession,
      level: validatedData.level,
      totalUnits: validatedData.totalUnits,
      attemptNumber: validatedData.attemptNumber,
      registeredBy: validatedData.registeredBy,
      notes: validatedData.notes,
      department: validatedData.department,
    });

    await newReg.save();
    return newReg;
  }

  /**
   * Standalone validation function that can be called from anywhere
   * Returns boolean or throws error with message
   */
  async validateOnly(userFromMiddleware, reqBody, reqUser) {
    try {
      await this.validateAndPrepareRegistration(userFromMiddleware, reqBody, reqUser);
      return {
        isValid: true,
        message: "Course selection is valid"
      };
    } catch (error) {
      return {
        isValid: false,
        message: error.message
      };
    }
  }
  /**
* Drop a course from a student's registration
* @param {Object} params - The parameters for dropping a course
* @param {string} params.studentId - The ID of the student
* @param {string} params.courseId - The ID of the course to drop
* @param {string} params.semesterId - The ID of the semester
* @param {string} params.session - The session (e.g., "2024/2025")
* @param {Object} params.actor - The user performing the action (req.user)
* @param {string} params.notes - Optional notes/reason for dropping
* @returns {Promise<Object>} - The updated course registration
*/
  async dropCourse(params) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { studentId, courseId, semesterId, actor, notes } = params;

      // Validate required fields
      if (!studentId || !courseId || !semesterId) {
        throw new AppError("Missing either of these required fields: studentId, courseId, semesterId, session", 400);
      }

      // 1️⃣ Find the course registration for the student
      const registration = await CourseRegistration.findOne({
        student: studentId,
        semester: semesterId,
      }).populate("courses").populate("student");

      if (!registration) {
        throw new AppError("No course registration found for this student in the specified semester", 404);
      }

      // 2️⃣ Check if the course is registered
      const courseExists = registration.courses.some(course =>
        course._id.toString() === courseId
      );

      if (!courseExists) {
        throw new AppError("Course is not registered by this student", 400);
      }

      // 3️⃣ Get the course details for audit
      const course = await courseModel.findById(courseId);
      if (!course) {
        throw new AppError("Course not found", 404);
      }

      // 4️⃣ Get student details for audit
      const student = await studentModel.findById(studentId).populate("departmentId");
      if (!student) {
        throw new AppError("Student not found", 404);
      }






      // 5️⃣ Check authorization (only admin or HOD of student's department)
      const isAdmin = actor.role === "admin";
      let isHODOfDepartment = false;

      if (actor.role === "hod") {
        // Get department managed by this HOD
        const hodDepartment = await departmentService.getDepartmentByHod(actor._id);
        if (hodDepartment && hodDepartment._id.toString() === student.departmentId._id.toString()) {
          isHODOfDepartment = true;
        }
      }

      if (!isAdmin && !isHODOfDepartment) {
        // Set audit context for unauthorized attempt
        const auditContext = {
          action: "DROP_COURSE",
          resource: "CourseRegistration",
          severity: "HIGH",
          status: "FAILURE",
          reason: "Unauthorized attempt to drop course - User lacks required permissions",
          isSuspicious: true,
          requiresReview: true,
          metadata: {
            actorId: actor._id?.toString(),
            actorRole: actor.role,
            actorName: actor.name,
            studentId,
            courseId,
            courseCode: course.courseCode,
            studentDepartment: student.departmentId?.name,
            attemptedBy: actor.role,
            timestamp: new Date().toISOString()
          }
        };

        // Log directly since we're in a service and not returning to controller
        await AuditLogService.logOperation({
          userId: actor._id,
          actor: {
            userId: actor._id,
            username: actor.username,
            email: actor.email,
            role: actor.role,
            ipAddress: actor.ipAddress
          },
          action: auditContext.action,
          entity: auditContext.resource,
          status: auditContext.status,
          reason: auditContext.reason,
          severity: auditContext.severity,
          isSuspicious: auditContext.isSuspicious,
          requiresReview: auditContext.requiresReview,
          metadata: auditContext.metadata,
          context: {
            endpoint: actor.endpoint || "service-call",
            method: "POST",
            userAgent: actor.userAgent,
            timestamp: new Date().toISOString()
          }
        });

        throw new AppError("Only admin or HOD of the student's department can drop courses", 403);
      }

      // 6️⃣ Check if registration is locked or approved (prevent drops if locked)
      if (registration.status === "Approved" && registration.approvedBy) {
        throw new AppError("Cannot drop course - registration has been approved and locked", 400);
      }

      // 7️⃣ Store before state for audit
      const beforeState = {
        courses: registration.courses.map(c => ({
          id: c._id,
          code: c.courseCode,
          title: c.title,
          unit: c.unit
        })),
        totalUnits: registration.totalUnits,
        courseCount: registration.courses.length
      };

      // 8️⃣ Remove the course from the registration
      const updatedCourses = registration.courses.filter(
        course => course._id.toString() !== courseId
      );

      registration.courses = updatedCourses;

      // 9️⃣ Update total units if needed (requires course unit info)
      const courseUnit = course.unit || 0;
      registration.totalUnits = Math.max(0, registration.totalUnits - courseUnit);

      // 🔟 Add notes about the drop
      if (notes) {
        registration.notes = registration.notes
          ? `${registration.notes}\n[${new Date().toISOString()}] Course dropped: ${course.courseCode} - ${notes} by ${actor.name} (${actor.role})`
          : `[${new Date().toISOString()}] Course dropped: ${course.courseCode} - ${notes} by ${actor.name} (${actor.role})`;
      } else {
        registration.notes = registration.notes
          ? `${registration.notes}\n[${new Date().toISOString()}] Course dropped: ${course.courseCode} by ${actor.name} (${actor.role})`
          : `[${new Date().toISOString()}] Course dropped: ${course.courseCode} by ${actor.name} (${actor.role})`;
      }


      // 1️⃣0️⃣ Check if the user has a result for this course in the current semester (prevent drops if result exists)
      const result = await Result.findOne({
        studentId,
        semester: semesterId,
        courseId,
        courses: { $elemMatch: { courseId: courseId } },
      });
      if (result) {
        if (result.score > 0) {
          let errorMessage;
          if (actor.role === "student") {
            errorMessage = "You can’t drop this course because a result has already been recorded for it this semester. If you believe this is a mistake, please contact your Head of Department or an admin for assistance.";
          } else {
            errorMessage = "This course can’t be dropped because a result has already been recorded for the student this semester. If a correction is necessary, you may update or remove the result first. Please proceed carefully and ensure the reason is properly documented.";
          }
          throw new AppError(errorMessage, 400, "Course drop blocked due to existing result with score > 0", { title: "Course drop blocked", courseId, studentId, semesterId, resultId: result._id, score: result.score });
        } else {
          // If score is 0, we can allow drop but we should delete the result document to maintain data integrity
          await Result.deleteOne({ _id: result._id });
        }

      }
      // 1️⃣1️⃣ Track that this was modified by someone
      registration.registeredBy = actor._id;

      // 1️⃣2️⃣ Save the updated registration
      await registration.save({ session });

      // 1️⃣3️⃣ Commit transaction
      await session.commitTransaction();

      // 1️⃣4️⃣ Prepare audit context for successful drop
      const auditContext = {
        action: "DROP_COURSE",
        resource: "CourseRegistration",
        severity: "MEDIUM",
        entityId: registration._id,
        status: "SUCCESS",
        reason: `Course ${course.courseCode} (${course.title}) dropped from student ${student.name || student.matricNumber}`,
        changes: {
          before: beforeState,
          after: {
            courses: updatedCourses.map(c => ({
              id: c._id,
              code: c.courseCode,
              title: c.title,
              unit: c.unit
            })),
            totalUnits: registration.totalUnits,
            courseCount: updatedCourses.length
          },
          changedFields: ["courses", "totalUnits", "notes", "registeredBy"]
        },
        metadata: {
          droppedBy: {
            id: actor._id?.toString(),
            name: actor.name,
            email: actor.email,
            role: actor.role
          },
          studentId,
          studentName: student.name,
          studentMatric: student.matricNumber,
          studentDepartment: student.departmentId?.name,
          courseId,
          courseCode: course.courseCode,
          courseTitle: course.title,
          courseUnit: course.unit,
          semesterId,
          previousTotalUnits: beforeState.totalUnits,
          newTotalUnits: registration.totalUnits,
          unitsDropped: courseUnit,
          notes,
          registrationStatus: registration.status,
          timestamp: new Date().toISOString()
        }
      };

      // Log the audit event
      await AuditLogService.logOperation({
        userId: actor._id,
        actor: {
          userId: actor._id,
          username: actor.username,
          email: actor.email,
          role: actor.role,
          ipAddress: actor.ipAddress
        },
        action: auditContext.action,
        entity: auditContext.resource,
        entityId: auditContext.entityId,
        status: auditContext.status,
        reason: auditContext.reason,
        severity: auditContext.severity,
        changes: auditContext.changes,
        metadata: auditContext.metadata,
        context: {
          endpoint: actor.endpoint || "service-call",
          method: "POST",
          userAgent: actor.userAgent,
          timestamp: new Date().toISOString()
        },
        tags: ["course_registration", "drop_course", actor.role, "student"]
      });

      // Return the updated registration with populated fields
      const populatedRegistration = await CourseRegistration.findById(registration._id)
        .populate("student", "name matricNumber")
        .populate("courses", "courseCode title unit")
        .populate("semester", "name")
        .lean();

      return {
        success: true,
        message: `Course ${course.courseCode} dropped successfully`,
        data: populatedRegistration,
        auditContext
      };

    } catch (error) {
      throw error;
    } finally {
      session.endSession();
    }
  };

}

export default new RegistrationService();