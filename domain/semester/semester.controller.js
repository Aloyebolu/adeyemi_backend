import DepartmentSemester from "./semester.model.js";
import Settings from "../settings/settings.model.js";
import buildResponse from "../../utils/responseBuilder.js";
import mongoose from "mongoose";
import { AcademicSemester } from "./semester.academicModel.js";
import departmentModel from "../department/department.model.js";
import studentModel from "../student/student.model.js";
import SemesterService from "./semester.service.js";
import departmentService from "../department/department.service.js";
import AuditLogService from "../auditlog/auditlog.service.js";
import { defaultLevelSettings, lateRegistrationDate, registrationDeadline } from "./semester.constants.js";


// Type-safe constants
const VALID_SEMESTERS = ["first", "second", "summer"];
const sessionRegex = /^\d{4}\/\d{4}$/;

// 🔹 Start new semester (admin only) - Enhanced with service
export const startNewSemester = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;

    // Admin only
    if (req.user.role !== "admin") {
      await session.abortTransaction();
      return buildResponse(res, 403, "Only admin can start new semester", null, true);
    }

    // ------------------ FETCH ACTIVE SEMESTER ------------------
    const currentAcademic = await SemesterService.getActiveAcademicSemester(session);

    let nextSemesterName;
    let nextSessionYear;
    const yearNow = new Date().getFullYear();

    if (!currentAcademic) {
      // No history; system is fresh
      nextSemesterName = "first";
      nextSessionYear = `${yearNow}/${yearNow + 1}`;
    } else {
      const currentName = currentAcademic.name;
      const [startY, endY] = currentAcademic.session.split("/").map(Number);

      if (currentName === "first") {
        nextSemesterName = "second";
        nextSessionYear = currentAcademic.session;
      } else {
        nextSemesterName = "first";
        nextSessionYear = `${endY}/${endY + 1}`;
      }
    }

    // ---------------- END OLD ACADEMIC SEMESTERS ----------------
    await AcademicSemester.updateMany(
      { isActive: true },
      { isActive: false, endDate: new Date() },
      { session }
    );

    // ---------------- CREATE NEW ACADEMIC SEMESTER ----------------
    const academicSemester = await AcademicSemester.create(
      [{
        name: nextSemesterName,
        session: nextSessionYear,
        startDate: new Date(),
        isActive: true
      }],
      { session }
    );

    const academicSemesterDoc = academicSemester[0];

    // ---------------- FETCH ALL DEPARTMENTS ----------------
    const departments = await departmentModel.find({}, null, { session });
    if (departments.length === 0) {
      await session.abortTransaction();
      return buildResponse(res, 400, "No departments found", null, true);
    }

    // ---------------- END OLD DEPT SEMESTERS ----------------
    await DepartmentSemester.updateMany(
      { isActive: true },
      { isActive: false, endDate: new Date() },
      { session }
    );

    // ---------------- CREATE NEW DEPT SEMESTERS ----------------
    const departmentSemesters = await Promise.all(
      departments.map((dept) => {


        return SemesterService.createDepartmentSemester({
          academicSemesterId: academicSemesterDoc._id,
          departmentId: dept._id,
          name: nextSemesterName,
          sessionYear: nextSessionYear,
          levelSettings: defaultLevelSettings,
          createdBy: userId,
          registrationDeadline: registrationDeadline(),
          lateRegistrationDate: lateRegistrationDate(),
          session
        });
      })
    );

    // ---------------- UPDATE SETTINGS ----------------
    const settings = await Settings.findOneAndUpdate(
      {},
      {
        currentSession: nextSessionYear,
        currentSemester: nextSemesterName,
        activeAcademicSemesterId: academicSemesterDoc._id,
        registrationOpen: false,
        resultPublicationOpen: false,
        updatedBy: userId
      },
      { new: true, upsert: true, session }
    );

    if (nextSemesterName == 'first') {
      // ---------------- HANDLE STUDENT PROMOTIONS ----------------
      const students = await studentModel.find(
        { isActive: true },
        null,
        { session }
      );

      const bulkOps = [];

      for (const student of students) {
        let level = parseInt(student.level);
        let newLevel = student.terminationStatus !== "none"
          ? student.level
          : level < 500
            ? String(level + 100)
            : student.level;

        let newProbation = student.probationStatus === "probation"
          ? "probation_lifted"
          : student.probationStatus;

        bulkOps.push({
          updateOne: {
            filter: { _id: student._id },
            update: {
              $set: {
                level: newLevel,
                probationStatus: newProbation,
                session: nextSessionYear
              }
            }
          }
        });
      }

      if (bulkOps.length > 0) {
        await studentModel.bulkWrite(bulkOps, { session });
      }
    }

    // Commit all operations
    await session.commitTransaction();
    session.endSession();

    return buildResponse(res, 200, "New semester started successfully", {
      nextSemester: nextSemesterName,
      nextSession: nextSessionYear,
      academicSemester: academicSemesterDoc,
      departmentSemesters: departmentSemesters,
      settings
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error
  }
};

export const rollbackSemester = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;

    // Admin only
    if (req.user.role !== "admin") {
      await session.abortTransaction();
      session.endSession();
      return buildResponse(res, 403, "Only admin can rollback semester", null, true);
    }

    // ------------------ FETCH CURRENT ACTIVE ACADEMIC SEMESTER ------------------
    const currentAcademic = await AcademicSemester.findOne(
      { isActive: true },
      null,
      { session }
    );

    if (!currentAcademic) {
      await session.abortTransaction();
      session.endSession();
      return buildResponse(res, 400, "No active semester found to rollback", null, true);
    }

    // ------------------ FETCH PREVIOUS ACADEMIC SEMESTER ------------------
    const previousAcademic = await AcademicSemester.findOne(
      {
        isActive: false,
        _id: { $ne: currentAcademic._id }
      },
      null,
      { session }
    ).sort({ endDate: -1, createdAt: -1 });

    if (!previousAcademic) {
      await session.abortTransaction();
      session.endSession();
      return buildResponse(res, 400, "No previous semester found to revert to", null, true);
    }

    // ------------------ CRITICAL: CHECK FOR ACTIVE DEPARTMENT SEMESTERS CONFLICTS ------------------
    // Get all departments that have active semesters in current academic semester
    // NOTED
    const currentActiveDeptSemesters = await DepartmentSemester.find(
      {
        academicSemester: currentAcademic._id,
        isActive: true
      },
      'department',
      { session }
    ).distinct('department');

    // Check if any of these departments already have active semesters from previous academic semester
    const conflictingSemesters = await DepartmentSemester.find(
      {
        academicSemester: previousAcademic._id,
        isActive: true,  // This shouldn't happen, but let's check
        department: { $in: currentActiveDeptSemesters }
      },
      null,
      { session }
    );

    if (conflictingSemesters.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return buildResponse(res, 409,
        `Cannot rollback: ${conflictingSemesters.length} department(s) already have active semesters in the previous academic semester.`,
        { conflictingDepartments: conflictingSemesters.map(s => s.department) },
        true
      );
    }

    // ------------------ STEP 1: DEACTIVATE CURRENT ACADEMIC SEMESTER ------------------
    // Do this FIRST to free up the unique constraint
    await AcademicSemester.updateOne(
      { _id: currentAcademic._id },
      {
        isActive: false,
        endDate: new Date(),
        isRegistrationOpen: false,
        isResultsPublished: false
      },
      { session }
    );

    // ------------------ STEP 2: DEACTIVATE ALL CURRENT DEPARTMENT SEMESTERS ------------------
    // Deactivate ALL department semesters for current academic semester
    const deactivateResult = await DepartmentSemester.updateMany(
      {
        academicSemester: currentAcademic._id,
        isActive: true
      },
      {
        isActive: false,
        endDate: new Date(),
        isRegistrationOpen: false,
        isResultsPublished: false
      },
      { session }
    );

    console.log(`Deactivated ${deactivateResult.modifiedCount} department semesters`);

    // ------------------ STEP 3: REACTIVATE PREVIOUS ACADEMIC SEMESTER ------------------
    await AcademicSemester.updateOne(
      { _id: previousAcademic._id },
      {
        isActive: true,
        endDate: null,
        isRegistrationOpen: false,
        isResultsPublished: false
      },
      { session }
    );

    // ------------------ STEP 4: REACTIVATE PREVIOUS DEPARTMENT SEMESTERS ------------------
    // Now we can safely reactivate previous department semesters
    // But only reactivate those that match departments we just deactivated
    const reactivateResult = await DepartmentSemester.updateMany(
      {
        academicSemester: previousAcademic._id,
        isActive: false,
        department: { $in: currentActiveDeptSemesters }
      },
      {
        isActive: true,
        endDate: null,
        isRegistrationOpen: false,
        isResultsPublished: false
      },
      { session }
    );

    console.log(`Reactivated ${reactivateResult.modifiedCount} previous department semesters`);

    // ------------------ STEP 5: UPDATE SETTINGS ------------------
    const settings = await Settings.findOneAndUpdate(
      {},
      {
        currentSession: previousAcademic.session,
        currentSemester: previousAcademic.name,
        activeAcademicSemesterId: previousAcademic._id,
        registrationOpen: false,
        resultPublicationOpen: false,
        updatedBy: userId
      },
      { new: true, upsert: true, session }
    );

    // ------------------ STEP 6: OPTIONAL STUDENT UPDATES ------------------
    // BE VERY CAREFUL WITH THIS - Consider if you really need it
    // Maybe make this a separate operation that requires confirmation

    // If you decide to revert student data, do it here with caution
    // But I'd recommend making it a separate endpoint or at least adding a confirmation flag

    if (req.body.revertStudents === true) {
      // Only proceed if explicitly requested
      await handleStudentRollback(currentAcademic, previousAcademic, session, userId);
    }

    // ------------------ STEP 7: LOG THE ROLLBACK ------------------
    await Settings.findOneAndUpdate(
      {},
      {
        $push: {
          semesterRollbacks: {
            timestamp: new Date(),
            performedBy: userId,
            fromAcademicSemester: {
              id: currentAcademic._id,
              name: currentAcademic.name,
              session: currentAcademic.session
            },
            toAcademicSemester: {
              id: previousAcademic._id,
              name: previousAcademic.name,
              session: previousAcademic.session
            },
            reason: req.body.reason || 'Administrative rollback',
            departmentsAffected: currentActiveDeptSemesters.length,
            studentDataReverted: req.body.revertStudents || false
          }
        }
      },
      { session }
    );

    // Commit all operations
    await session.commitTransaction();
    session.endSession();

    return buildResponse(res, 200, "Semester rollback successful", {
      previousSemester: {
        name: previousAcademic.name,
        session: previousAcademic.session,
        startDate: previousAcademic.startDate
      },
      rolledBackFrom: {
        name: currentAcademic.name,
        session: currentAcademic.session,
        startDate: currentAcademic.startDate
      },
      departmentsAffected: currentActiveDeptSemesters.length,
      departmentSemesters: {
        deactivated: deactivateResult.modifiedCount,
        reactivated: reactivateResult.modifiedCount
      },
      settings: {
        currentSession: settings.currentSession,
        currentSemester: settings.currentSemester
      },
      warning: req.body.revertStudents
        ? "Student data has been modified. Please review."
        : "Student data was not modified. Use revertStudents flag if needed."
    });

  } catch (error) {

    // Enhanced error handling
    if (error.code === 11000) {
      console.error("Duplicate key error details:", error.keyValue);

      // Try to identify what caused the constraint violation
      if (error.keyPattern && error.keyPattern.isActive === 1) {
        await session.abortTransaction();
        session.endSession();
        return buildResponse(res, 409,
          "Academic semester constraint violation. Another academic semester is already active.",
          null, true);
      } else if (error.keyPattern && error.keyPattern.department && error.keyPattern.isActive) {
        await session.abortTransaction();
        session.endSession();
        return buildResponse(res, 409,
          "Department semester constraint violation. A department already has an active semester.",
          { conflictingDepartment: error.keyValue.department },
          true);
      }
    }

    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// Optional: Separate function for student rollback
async function handleStudentRollback(currentAcademic, previousAcademic, session, userId) {
  // Implement with extreme caution
  // This should have its own validation and confirmation

  if (currentAcademic.session === previousAcademic.session) {
    // Only revert if within same academic session
    if (currentAcademic.name === 'first' && previousAcademic.name === 'second') {
      // Demote students by one level
      await Student.updateMany(
        {
          isActive: true,
          level: { $in: ['200', '300', '400', '500'] }
        },
        [
          {
            $set: {
              level: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$level", "200"] }, then: "100" },
                    { case: { $eq: ["$level", "300"] }, then: "200" },
                    { case: { $eq: ["$level", "400"] }, then: "300" },
                    { case: { $eq: ["$level", "500"] }, then: "400" }
                  ],
                  default: "$level"
                }
              },
              session: previousAcademic.session,
              updatedBy: userId
            }
          }
        ],
        { session }
      );
    }
  }

  // Always update session to match rolled back semester
  await Student.updateMany(
    { isActive: true },
    {
      $set: {
        session: previousAcademic.session,
        updatedBy: userId
      }
    },
    { session }
  );
}

export const canRollbackSemester = async (req, res) => {
  try {
    // Check if there's an active semester
    const currentAcademic = await SemesterService.getActiveAcademicSemester();

    if (!currentAcademic) {
      return buildResponse(res, 400, "No active semester found", null, true);
    }

    // Check if there's a previous semester to revert to
    const previousAcademic = await AcademicSemester.findOne(
      {
        _id: { $ne: currentAcademic._id },
        endDate: { $ne: null }
      }
    ).sort({ endDate: -1 });

    if (!previousAcademic) {
      return buildResponse(res, 400, "No previous semester to revert to", null, true);
    }

    return buildResponse(res, 200, "Rollback is possible", {
      canRollback: true,
      currentSemester: currentAcademic.name,
      currentSession: currentAcademic.session,
      previousSemester: previousAcademic.name,
      previousSession: previousAcademic.session
    });

  } catch (error) {
    throw error
  }
};

export const toggleRegistration = async (req, res) => {
  const startTime = Date.now();

  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // ---------------- ONLY ADMIN CAN TOGGLE REGISTRATION ----------------
    if (userRole !== "admin") {
      // Log unauthorized access attempt
      await AuditLogService.logOperation({
        req,
        action: "TOGGLE_REGISTRATION",
        entity: "AcademicSemester",
        status: "FAILURE",
        reason: "Unauthorized attempt to toggle registration - Admin role required",
        severity: "HIGH",
        isSuspicious: true,
        requiresReview: true,
        tags: ["registration", "admin", "unauthorized", "security"]
      });

      return buildResponse(res, 403, "Only admin can toggle registration", null, true);
    }

    // Call the comprehensive service method
    const result = await SemesterService.toggleAcademicSemesterRegistration({
      req,
      userId,
      userDetails: {
        username: req.user.username,
        email: req.user.email,
        role: userRole,
        department: req.user.department
      },
      ipAddress: req.ip,
      requestDetails: {
        endpoint: req.originalUrl,
        method: req.method,
        requestId: req.requestId,
        userAgent: req.get('user-agent')
      }
    });

    req.auditContext = result.auditContext; // Pass audit context to response for logging middleware
    delete result.auditContext; // Remove audit context from response body
    return buildResponse(
      res,
      200,
      result.message,
      result
    );

  } catch (error) {

    req.auditContext = {
      entity: "AcademicSemester",
      resource: "AcademicSemester",
      action: "TOGGLE_REGISTRATION",
      entity: "AcademicSemester",
      status: "ERROR",
      reason: error.message || "Error toggling registration",
      severity: "HIGH",
      isSuspicious: true,
      requiresReview: true,
      tags: ["registration", "admin", "error"]
    };
    throw error
  }
};

/**
 * --------------------------------------------------
 * CHECK REGISTRATION STATUS (Simplified)
 * --------------------------------------------------
 */
export const checkRegistrationStatus = async (req, res, next) => {
  try {
    const result = await SemesterService.checkRegistrationStatusWithAudit({
      userId: req.user?._id,
      userDetails: req.user,
      ipAddress: req.ip,
      requestDetails: {
        endpoint: req.originalUrl,
        method: req.method,
        requestId: req.requestId,
        userAgent: req.get('user-agent')
      },
      departmentId: req.query.departmentId || req.body.departmentId
    });

    return buildResponse(
      res,
      200,
      result.message,
      result
    );

  } catch (error) {
    next(error)
  }
};

/**
 * --------------------------------------------------
 * GET REGISTRATION STATUS ENDPOINT
 * --------------------------------------------------
 * Anyone can check registration status
 */
export const getRegistrationStatus = async (req, res, next) => {
  try {
    const status = await SemesterService.getRegistrationStatusDetails();

    return buildResponse(
      res,
      200,
      status.message,
      status
    );

  } catch (error) {
    next(error)
  }
};
// 🔹 Toggle results publication - Enhanced with service
export const toggleResultPublication = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    const { status } = req.body;
    let departmentId = req.body?.departmentId || null;

    if (typeof status !== "boolean") {
      return buildResponse(res, 400, "Status must be a boolean", null, true);
    }

    let targetDepartments = [];

    // ---------------- ADMIN LOGIC ----------------
    if (userRole === "admin") {
      if (departmentId) {
        targetDepartments = [departmentId];
      } else {
        const allDepts = await departmentModel.find({}, "_id");
        targetDepartments = allDepts.map(d => d._id);
      }
    }

    // ---------------- HOD / DEAN LOGIC ----------------
    if (userRole === "hod" || userRole === "dean") {
      const dept = await departmentService.getDepartmentByHod(req.user._id)

      if (!dept) {
        return buildResponse(res, 400, "No department assigned to this user", null, true);
      }

      targetDepartments = [dept._id];
    }

    // ---------------- ONLY ALLOWED ROLES ----------------
    if (targetDepartments.length === 0) {
      return buildResponse(res, 403, "Insufficient permissions", null, true);
    }

    // ---------------- UPDATE USING SERVICE ----------------
    await SemesterService.updateResultPublicationForDepartments({
      departmentIds: targetDepartments,
      isPublished: status,
      userId
    });

    return buildResponse(
      res,
      200,
      `Result publication ${status ? "opened" : "closed"} successfully`,
      { affectedDepartments: targetDepartments }
    );

  } catch (error) {
    console.error("Error updating result publication:", error);
    return buildResponse(
      res,
      500,
      "Error updating result publication",
      null,
      true,
      error
    );
  }
};

// 🔹 Get active semester - Enhanced with service
export const getActiveSemester = async (req, res) => {
  try {
    let departmentId = null;

    // ------------------- STUDENT -------------------
    if (req.user.role === "student") {
      const student = await studentModel
        .findById(req.user._id)
        .populate("departmentId");

      if (!student || !student.departmentId) {
        return buildResponse(res, 400, "Department not found for this student", null, true);
      }

      departmentId = student.departmentId._id;
    }

    // ------------------- HOD/DEAN -------------------
    if (req.user.role === "hod" || req.user.role === "dean") {
      const userDept = await departmentService.getDepartmentByHod(req.user._id)

      if (!userDept) {
        return buildResponse(res, 400, "Department not found for this user", null, true);
      }

      departmentId = userDept._id;
    }

    // ------------------- ADMIN -------------------
    const academic = await SemesterService.getActiveAcademicSemester();
    if (req.user.role === "admin") {
      const body = req.body || {};
      const query = req.query || {};

      if (body.departmentId) {
        departmentId = req.body.departmentId;
      } else if (query.departmentId) {
        departmentId = req.query.departmentId;
      }

      if (!departmentId) {

        if (!academic) {
          return buildResponse(res, 404, "No active academic semester found", null, true);
        }

        return buildResponse(res, 200, "Active academic semester fetched", academic);
      }
    }

    // ------------------- FETCH DEPARTMENT SEMESTER USING SERVICE ----------------
    const semester = await SemesterService.getDepartmentSemester(departmentId);


    return buildResponse(res, 200, "Active semester fetched successfully", {...semester, ...academic});

  } catch (error) {
    console.error("Error fetching semester:", error);
    return buildResponse(res, 500, "Error fetching semester", null, true, error);
  }
};

// 🔹 Deactivate semester - Enhanced with service
export const deactivateSemester = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return buildResponse(res, 403, "Only admin can deactivate semesters", null, true);
    }

    const { semesterId } = req.params;

    if (!semesterId || !mongoose.Types.ObjectId.isValid(semesterId)) {
      return buildResponse(res, 400, "Valid semester ID is required", null, true);
    }

    // Use service to deactivate
    const activeSemester = await SemesterService.deactivateSemester(semesterId, req.user._id);

    if (!activeSemester) {
      return buildResponse(res, 404, "No active semester found with this ID", null, true);
    }

    // Update global settings (maintains existing behavior)
    await Settings.findOneAndUpdate(
      { activeSemesterId: semesterId },
      {
        activeSemesterId: null,
        registrationOpen: false,
        resultPublicationOpen: false,
        updatedBy: req.user._id,
      }
    );

    return buildResponse(res, 200, "Semester deactivated successfully", activeSemester);
  } catch (error) {
    console.error("Error deactivating semester:", error);
    return buildResponse(res, 500, "Error deactivating semester", null, true, error);
  }
};

// 🔹 Update level settings - Enhanced with service
export const updateLevelSettings = async (req, res) => {
  try {
    const { levelSettings, registrationDeadline, lateRegistrationDate } = req.body;
    const { departmentId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Validate level settings
    if (!levelSettings || !Array.isArray(levelSettings)) {
      return buildResponse(res, 400, "Level settings array is required", null, true);
    }

    let targetDepartmentId = departmentId;

    // 🔹 HOD/Dean — auto detect their department
    if (userRole === "hod" || userRole === "dean") {
      const userDept = await departmentService.getDepartmentByHod(req.user._id)

      if (!userDept) {
        return buildResponse(res, 403, "No department assigned to this HOD/Dean", null, true);
      }

      targetDepartmentId = userDept._id.toString();
    }

    // 🔹 Admin — must provide departmentId in params
    else if (userRole === "admin") {
      if (!mongoose.Types.ObjectId.isValid(targetDepartmentId)) {
        return buildResponse(res, 400, "Invalid department ID", null, true);
      }
    }

    // 🔹 Others not allowed
    else {
      return buildResponse(res, 403, "Insufficient permissions", null, true);
    }

    // Find active semester for department
    const semester = await DepartmentSemester.findOne({
      department: targetDepartmentId,
      isActive: true,
    });

    if (!semester) {
      return buildResponse(res, 404, "Active semester not found for this department", null, true);
    }

    // 🔹 Update using service
    const updatedSemester = await SemesterService.updateSemesterSettings({
      semesterId: semester._id,
      levelSettings,
      registrationDeadline,
      lateRegistrationDate,
      userId
    });

    return buildResponse(res, 200, "Semester settings updated successfully", updatedSemester);

  } catch (error) {
    console.error("Error updating level settings:", error);
    return buildResponse(res, 500, error.message || "Error updating level settings", null, true, error);
  }
};

// 🔹 Get semesters by department - Enhanced with service
export const getSemestersByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return buildResponse(res, 400, "Invalid department ID", null, true);
    }

    // Authorization: HOD/Dean can only access their own department
    // Note: This uses req.user.department which exists in your original code
    if (req.user.role === 'hod' || req.user.role === 'dean') {
      if (req.user.department && req.user.department.toString() !== departmentId) {
        return buildResponse(res, 403, "Not authorized to access this department", null, true);
      }
    }

    // Use service to get department semesters
    const semesters = await SemesterService.getDepartmentSemesters(departmentId);

    return buildResponse(res, 200, "Semesters fetched successfully", semesters);
  } catch (error) {
    console.error("Error fetching semesters:", error);
    return buildResponse(res, 500, "Error fetching semesters", null, true, error);
  }
};

// 🔹 Get student semester settings - Maintains EXACT original response format
export const getStudentSemesterSettings = async (req, res) => {
  try {
    const studentId = req.user._id;

    // 1. Get student information (original logic)
    const student = await studentModel.findById(studentId)
      .populate('departmentId')
      .select('level department');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    if (!student.departmentId) {
      return res.status(400).json({
        success: false,
        message: "Student does not have a department assigned"
      });
    }

    // 2. Find active semester using service
    const activeSemester = await SemesterService.getActiveDepartmentSemester(student.departmentId._id);

    if (!activeSemester) {
      return res.status(404).json({
        success: false,
        message: "No active semester found for this department"
      });
    }

    // 3. Find level settings for the student's level
    const levelSetting = activeSemester.levelSettings.find(
      setting => String(setting.level) === String(student.level)
    );

    if (!levelSetting) {
      return res.status(404).json({
        success: false,
        message: `No level settings found for level ${student.level}`
      });
    }

    // 4. Return the EXACT same response format as original
    return res.status(200).json({
      success: true,
      data: {
        level: levelSetting.level,
        minUnits: levelSetting.minUnits,
        maxUnits: levelSetting.maxUnits,
        minCourses: levelSetting.minCourses,
        maxCourses: levelSetting.maxCourses,
        semester: {
          name: activeSemester.name,
          session: activeSemester.session,
        },
        isRegistrationOpen: activeSemester.isRegistrationOpen,
        registratioinDeadline: activeSemester.registrationDeadline, // Note: Typo kept for compatibility
        lateRegistrationDate: activeSemester.lateRegistrationDate,
        registrationDeadline: activeSemester.registrationDeadline,
        lateRegistrationDate: activeSemester.lateRegistrationDate
      }
    });

  } catch (error) {
    console.error("Error getting student semester settings:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};