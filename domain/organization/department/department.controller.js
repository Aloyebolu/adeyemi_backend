import mongoose from "mongoose";
import buildResponse from "#utils/responseBuilder.js";
import { fetchDataHelper } from "#utils/fetchDataHelper.js";
import { dataMaps } from "#config/dataMap.js";
import facultyModel from "#domain/organization/faculty/faculty.model.js";
import departmentModel from "./department.model.js";
import DepartmentService from "./department.service.js";
import { getDepartmentById as getDepartmentByIdHandler } from "./department.controller.js";
import AppError from "#shared/errors/AppError.js";
import FacultyService from "#domain/organization/faculty/faculty.service.js";

// Common configuration for fetchDataHelper
const DEPARTMENT_FETCH_CONFIG = {
  configMap: dataMaps.Department,
  autoPopulate: true,
  models: { facultyModel },
};

/**
 * Handle authorization for dean users
 */
const handleDeanAuthorization = async (req, departmentId = null, facultyId = null) => {
  if (req.user.role !== 'dean') return true;

  if (departmentId) {
    const hasAccess = await DepartmentService.checkDeanDepartmentAccess(req.user._id, departmentId);
    if (!hasAccess) {
      req.auditContext = DepartmentService.createAuditContext(
        "ACCESS_DEPARTMENT",
        "FAILURE",
        "Unauthorized dean access attempt",
        {
          departmentId,
          attemptedBy: req.user.role,
          attemptedByUserId: req.user._id,
          reason: "Dean access check failed"
        }
      );
      return false;
    }
  }

  if (facultyId) {
    const hasAccess = await FacultyService.checkDeanFacultyAccess(req.user._id, facultyId);
    if (!hasAccess) {
      req.auditContext = DepartmentService.createAuditContext(
        "ACCESS_FACULTY",
        "FAILURE",
        "Unauthorized dean faculty access attempt",
        {
          facultyId,
          attemptedBy: req.user.role,
          attemptedByUserId: req.user._id,
          reason: "Dean faculty access check failed"
        }
      );
      return false;
    }
  }

  return true;
};

/**
 * Handle ID validation
 */
const validateObjectId = (id, entityName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Invalid ${entityName} ID provided`, 500);
  }
};

/* ===== Get All Departments ===== */
export const getAllDepartment = async (req, res, next) => {
  try {


    let additionalFilters = {};
    // For deans: only show departments in their faculty
    if (req.user.role === 'dean') {
      const faculty = await FacultyService.getDeanFaculty(req.user._id);
      if (!faculty) {
        return buildResponse(res, 403, "No faculty assigned to dean");
      }
      additionalFilters.faculty = faculty._id;
    }

    return await fetchDataHelper(req, res, departmentModel, {
      ...DEPARTMENT_FETCH_CONFIG,
      populate: ["faculty", "hod"],
      additionalFilters
    });
  } catch (error) {
    throw error
  }
};

/* ===== Get Department Stats ===== */
export const getDepartmentStats = async (req, res, next) => {
  try {
    let facultyFilter = {};

    if (req.user.role === 'dean') {
      const faculty = await FacultyService.getDeanFaculty(req.user._id);
      if (!faculty) {
        return buildResponse(res, 403, "No faculty assigned to dean");
      }
      facultyFilter.faculty = faculty._id;
    }

    return await fetchDataHelper(req, res, departmentModel, {
      configMap: dataMaps.DepartmentStats,
      autoPopulate: true,
      models: { departmentModel },
      additionalFilters: facultyFilter
    });
  } catch (error) {
    next(error)
  }
};

/* ===== Assign HOD to Department ===== */
export const assignHOD = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { lecturerId } = req.body;
    const { departmentId } = req.params;
    const userFromMiddleware = req.user;

    // Authorization check
    const isAuthorized = await handleDeanAuthorization(req, departmentId);
    if (!isAuthorized) {
      await session.abortTransaction();
      session.endSession();
      return buildResponse(res, 403, "Not authorized to manage this department");
    }

    // Validate IDs
    try {
      validateObjectId(lecturerId, "lecturer");
      validateObjectId(departmentId, "department");
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      req.auditContext = DepartmentService.createAuditContext(
        "ASSIGN_HOD",
        "FAILURE",
        error.message,
        {
          departmentId,
          lecturerId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id
        }
      );

      throw error
    }

    // Assign HOD
    const result = await DepartmentService.assignHOD(departmentId, lecturerId, session);

    await session.commitTransaction();
    session.endSession();

    // Set audit context for success
    req.auditContext = DepartmentService.createAuditContext(
      "ASSIGN_HOD",
      "SUCCESS",
      `HOD assigned successfully to department ${result.department.name}`,
      {
        departmentId,
        departmentName: result.department.name,
        lecturerId,
        lecturerName: result.lecturer.staffId,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,

      },
      {
        before: {
          hod: result.oldHodId,
          lecturerHOD: result.oldLecturerData?.isHOD,
          userRole: result.oldUserData?.role
        },
        after: {
          hod: result.lecturer._id,
          lecturerHOD: true,
          userRole: "hod"
        }
      }
    );

    // Return the updated department
    await getDepartmentByIdHandler({ params: { departmentId }, ...req }, res);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();


    // Set audit context based on error type
    const status = error.message.includes("not found") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 :
      error.message.includes("belong") ||
        error.message.includes("already") ||
        error.message.includes("Cannot") ? 400 : 500;

    req.auditContext = DepartmentService.createAuditContext(
      "ASSIGN_HOD",
      status,
      error.message,
      {
        departmentId: req.params.departmentId,
        lecturerId: req.body.lecturerId,
        attemptedBy: req.user.role,
        attemptedByUserId: req.user._id,
        error: error.message
      }
    );

    throw error
  }
};

/* ===== Remove HOD ===== */
export const removeHOD = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { departmentId } = req.params;
    const userFromMiddleware = req.user;

    // Authorization check
    const isAuthorized = await handleDeanAuthorization(req, departmentId);
    if (!isAuthorized) {
      await session.abortTransaction();
      session.endSession();
      return buildResponse(res, 403, "Not authorized to manage this department");
    }

    // Validate ID
    try {
      validateObjectId(departmentId, "department");
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      req.auditContext = DepartmentService.createAuditContext(
        "REMOVE_HOD",
        "FAILURE",
        error.message,
        {
          departmentId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id
        }
      );

      throw new AppError("Failed to remove HOD", 500, error)
    }

    // Remove HOD
    const result = await DepartmentService.removeHOD(departmentId, session);

    await session.commitTransaction();
    session.endSession();

    // Set audit context for success
    req.auditContext = DepartmentService.createAuditContext(
      "REMOVE_HOD",
      "SUCCESS",
      `HOD removed successfully from department ${result.department.name}`,
      {
        departmentId,
        departmentName: result.department.name,
        removedHodId: result.removedHodId,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,

      },
      {
        before: {
          hod: result.removedHodId,
          lecturerHOD: result.oldLecturerData?.isHOD,
          userRole: result.oldUserData?.role
        },
        after: {
          hod: null,
          lecturerHOD: false,
          userRole: "lecturer"
        }
      }
    );

    return buildResponse(res, 200, "HOD removed successfully");
  } catch (error) {
    await session.abortTransaction();
    session.endSession();


    // Set audit context based on error type
    const status = error.message.includes("not found") ||
      error.message.includes("No HOD") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 :
      error.message.includes("No HOD") ? 400 : 500;

    req.auditContext = DepartmentService.createAuditContext(
      "REMOVE_HOD",
      status,
      error.message,
      {
        departmentId: req.params.departmentId,
        attemptedBy: req.user.role,
        attemptedByUserId: req.user._id,
        error: error.message
      }
    );

    next(error)
  }
};

/* ===== Create Department ===== */
export const createDepartment = async (req, res, next) => {
  try {
    const { name, code, faculty_id: facultyId, fields, search_term, filters, page } = req.body;
    const userFromMiddleware = req.user;

    // Handle GET-like operations (filtering)
    if (fields || search_term || filters || page) {
      const result = await fetchDataHelper(req, res, departmentModel, {
        ...DEPARTMENT_FETCH_CONFIG,
        populate: ["faculty"]
      });
      return;
      // return buildResponse(res, 200, "Filtered departments fetched", result);
    }

    let resolvedFacultyId = facultyId;

    // Dean authorization
    if (userFromMiddleware.role === 'dean') {
      const deanFaculty = await FacultyService.getDeanFaculty(userFromMiddleware._id);
      if (!deanFaculty) {
        req.auditContext = DepartmentService.createAuditContext(
          "CREATE_DEPARTMENT",
          "FAILURE",
          "Dean has no assigned faculty for department creation",
          {
            attemptedBy: userFromMiddleware.role,
            attemptedByUserId: userFromMiddleware._id,
            deanId: userFromMiddleware._id
          }
        );
        return buildResponse(res, 403, "No faculty assigned to dean");
      }
      resolvedFacultyId = deanFaculty._id;
    }

    // Create department
    const department = await DepartmentService.createDepartment(name, code, resolvedFacultyId);

    // Set audit context for success
    req.auditContext = DepartmentService.createAuditContext(
      "CREATE_DEPARTMENT",
      "SUCCESS",
      `Department ${name} created successfully`,
      {
        departmentId: department._id,
        departmentName: department.name,
        departmentCode: department.code,
        facultyId: resolvedFacultyId,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,

      }, {
      before: null,
      after: {
        name: department.name,
        code: department.code,
        faculty: resolvedFacultyId
      }
    }
    );

    // Return the created department
    return await getDepartmentByIdHandler({ params: { departmentId: department._id } }, res);
  } catch (error) {

    // Set audit context based on error type
    const status = error.message.includes("required") ||
      error.message.includes("already exists") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("required") ? 400 :
      error.message.includes("already exists") ? 400 : 500;

    req.auditContext = DepartmentService.createAuditContext(
      "CREATE_DEPARTMENT",
      status,
      error.message,
      {
        attemptedBy: req.user.role,
        attemptedByUserId: req.user._id,
        attemptedData: { name: req.body.name, code: req.body.code },
        error: error.message
      }
    );

    next(error)
  }
};

/* ===== Get Departments by Faculty ===== */
export const getDepartmentsByFaculty = async (req, res, next) => {
  try {
    const { facultyId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Dean authorization
    const isAuthorized = await handleDeanAuthorization(req, null, facultyId);
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to access this faculty");
    }

    const [departments, totalCount] = await Promise.all([
      departmentModel.find({ faculty: facultyId })
        .populate("hod", "staffId userId isHOD")
        .skip(skip)
        .limit(Number(limit)),
      departmentModel.countDocuments({ faculty: facultyId })
    ]);

    if (!departments || departments.length === 0) {
      return buildResponse(res, 404, "No departments found for this faculty");
    }

    const totalPages = Math.ceil(totalCount / Number(limit));

    return buildResponse(res, 200, "Departments fetched successfully", {
      pagination: {
        current_page: Number(page),
        limit: Number(limit),
        total_pages: totalPages,
        total_items: totalCount,
      },
      data: departments,
    });
  } catch (error) {
    next(error)
  }
};

/* ===== Get Department by ID ===== */
export const getDepartmentById = async (req, res, next) => {
  try {
    const { departmentId } = req.params;
      validateObjectId(departmentId, "department");

    // For deans: only allow access to departments in their faculty
    let additionalFilters = {};
    if (req?.user?.role === 'dean') {
      const faculty = await FacultyService.getDeanFaculty(req.user._id);
      if (!faculty) {
        return buildResponse(res, 403, "No faculty assigned to dean");
      }
      additionalFilters.faculty = faculty._id;
    }

    const result = await fetchDataHelper(req, res, departmentModel, {
      configMap: dataMaps.DepartmentById,
      autoPopulate: false,
      models: { facultyModel },
      populate: ["faculty", "hod"],
      additionalFilters: { ...additionalFilters, _id: mongoose.Types.ObjectId(departmentId) }
    });

    return;
  } catch (error) {
    next(error)
  }
};

/* ===== Update Department ===== */
export const updateDepartment = async (req, res, next) => {
  try {
    const { departmentId } = req.params;
    const userFromMiddleware = req.user;

    // Authorization check
    const isAuthorized = await handleDeanAuthorization(req, departmentId);
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to update this department");
    }

    try {
      validateObjectId(departmentId, "department");
    } catch (error) {
      req.auditContext = DepartmentService.createAuditContext(
        "UPDATE_DEPARTMENT",
        "FAILURE",
        error.message,
        {
          departmentId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id
        }
      );
      next(error)
    }

    // Get department before update
    const departmentBefore = await DepartmentService.getDepartmentById(departmentId)
      .catch(() => null);

    if (!departmentBefore) {
      req.auditContext = DepartmentService.createAuditContext(
        "UPDATE_DEPARTMENT",
        "FAILURE",
        "Department not found",
        {
          departmentId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id
        }
      );
      return buildResponse(res, 404, "Department not found");
    }

    // Update department
    const updatedDepartment = await DepartmentService.updateDepartment(
      departmentId,
      req.body,
      userFromMiddleware.role
    );

    // Set audit context for success
    req.auditContext = DepartmentService.createAuditContext(
      "UPDATE_DEPARTMENT",
      "SUCCESS",
      `Department ${updatedDepartment.name} updated successfully`,
      {
        departmentId,
        departmentName: updatedDepartment.name,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,

      }, {
      before: {
        name: departmentBefore.name,
        code: departmentBefore.code,
        faculty: departmentBefore.faculty
      },
      after: {
        name: updatedDepartment.name,
        code: updatedDepartment.code,
        faculty: updatedDepartment.faculty
      },
      changedFields: Object.keys(req.body).filter(key =>
        req.body[key] !== undefined &&
        ['name', 'code', 'faculty'].includes(key)
      )
    }
    );

    return buildResponse(res, 200, "Department updated successfully", updatedDepartment);
  } catch (error) {

    // Set audit context based on error type
    const status = error.message.includes("not found") ||
      error.message.includes("already exists") ||
      error.message.includes("cannot change") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 :
      error.message.includes("already exists") ||
        error.message.includes("cannot change") ? 400 : 500;

    req.auditContext = DepartmentService.createAuditContext(
      "UPDATE_DEPARTMENT",
      status,
      error.message,
      {
        departmentId: req.params.departmentId,
        attemptedBy: req.user.role,
        attemptedByUserId: req.user._id,
        updateData: req.body,
        error: error.message
      }
    );

    next(error)
  }
};

/* ===== Delete Department ===== */
export const deleteDepartment = async (req, res, next) => {
  try {
    const { departmentId } = req.params;
    const userFromMiddleware = req.user;

    // Authorization check
    const isAuthorized = await handleDeanAuthorization(req, departmentId);
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to delete this department");
    }
      validateObjectId(departmentId, "department");

    // Get department before deletion
    const departmentBefore = await DepartmentService.getDepartmentById(departmentId)
      .catch(() => null);

    if (!departmentBefore) {
      req.auditContext = DepartmentService.createAuditContext(
        "DELETE_DEPARTMENT",
        "FAILURE",
        "Department not found",
        {
          departmentId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id
        }
      );
      return buildResponse(res, 404, "Department not found");
    }

    // Delete department
    await DepartmentService.deleteDepartment(departmentId);

    // Set audit context for success
    req.auditContext = DepartmentService.createAuditContext(
      "DELETE_DEPARTMENT",
      "SUCCESS",
      `Department ${departmentBefore.name} deleted successfully`,
      {
        departmentId,
        departmentName: departmentBefore.name,
        departmentCode: departmentBefore.code,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        deletedAt: new Date().toISOString()
      }
    );

    return buildResponse(res, 200, "Department deleted successfully");
  } catch (error) {

    // Set audit context based on error type
    const status = error.message.includes("not found") ||
      error.message.includes("Cannot delete") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 :
      error.message.includes("Cannot delete") ? 400 : 500;

    req.auditContext = DepartmentService.createAuditContext(
      "DELETE_DEPARTMENT",
      status,
      error.message,
      {
        departmentId: req.params.departmentId,
        attemptedBy: req.user.role,
        attemptedByUserId: req.user._id,
        error: error.message
      }
    );

    next(error)
  }
};