import Faculty from "./faculty.model.js";
import buildResponse from "#utils/responseBuilder.js";
import { fetchDataHelper } from "#utils/fetchDataHelper.js";
import mongoose from "mongoose";
import { dataMaps } from "#config/dataMap.js";
import FacultyService from "./faculty.service.js";
import { resolveUserName } from "#utils/resolveUserName.js";
import AppError from "#shared/errors/AppError.js";

// Common configuration for fetchDataHelper
const FACULTY_FETCH_CONFIG = {
  configMap: dataMaps.Faculty,
  autoPopulate: false,
  models: {},
};

/**
 * Validate ObjectId
 */
const validateObjectId = (id, entityName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${entityName} ID format`, 500);
  }
};

/**
 * Handle authorization for dean users
 */
const handleDeanAuthorization = async (req, facultyId) => {
  if (req.user.role !== "dean") return true;

  const hasAccess = await FacultyService.checkDeanFacultyAccess(req.user._id, facultyId);
  if (!hasAccess) {
    req.auditContext = FacultyService.createAuditContext(
      "ACCESS_FACULTY",
      "FAILURE",
      "Unauthorized dean access attempt",
      {
        facultyId,
        attemptedBy: req.user.role,
        attemptedByUserId: req.user._id,
        reason: "Dean access check failed",
      }
    );
    return false;
  }

  return true;
};

/* ===== Create Faculty ===== */
export const createFaculty = async (req, res, next) => {
  try {
    const { name, code, fields, search_term, filters, page } = req.body;
    const userFromMiddleware = req.user;

    // Handle GET-like operations (filtering)
    if (fields || search_term || filters || page) {
      const result = await fetchDataHelper(req, res, Faculty, {
        ...FACULTY_FETCH_CONFIG,
        populate: [],
      });
      return;
      // return buildResponse(res, 200, "Faculties fetched successfully", result);
    }

    // Only admin can create faculties
    if (userFromMiddleware.role !== "admin") {
      req.auditContext = FacultyService.createAuditContext(
        "CREATE_FACULTY",
        "FAILURE",
        "Only admin can create faculties",
        {
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 403, "Only admin can create faculties", null, true);
    }

    // Create faculty
    const faculty = await FacultyService.createFaculty(name, code, userFromMiddleware._id);

    // Set audit context for success
    req.auditContext = FacultyService.createAuditContext(
      "CREATE_FACULTY",
      "SUCCESS",
      `Faculty ${faculty.name} created successfully`,
      {
        facultyId: faculty._id,
        facultyName: faculty.name,
        facultyCode: faculty.code,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        createdBy: userFromMiddleware._id,
      }
    );

    return buildResponse(res, 201, "Faculty created successfully", faculty);
  } catch (error) {

    // Handle MongoDB duplicate key errors
    if (error.code === 11000 && error.keyValue?.code) {
      req.auditContext = FacultyService.createAuditContext(
        "CREATE_FACULTY",
        "FAILURE",
        `Faculty code '${error.keyValue.code}' already exists`,
        {
          attemptedBy: req.user?.role,
          attemptedByUserId: req.user?._id,
          duplicateCode: error.keyValue.code,
        }
      );
      return buildResponse(res, 409, `Faculty code '${error.keyValue.code}' already exists`, null, true);
    }

    // Set audit context based on error type
    const status = error.message.includes("required") || 
                   error.message.includes("already exists") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("required") ? 400 : 
                      error.message.includes("already exists") ? 409 : 500;

    req.auditContext = FacultyService.createAuditContext(
      "CREATE_FACULTY",
      status,
      error.message,
      {
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        attemptedData: { name: req.body.name, code: req.body.code },
        error: error.message,
      }
    );

    next(error)
  }
};

/* ===== Get All Faculties ===== */
export const getAllFaculties = async (req, res, next) => {
  try {
    let additionalFilters = {};
    if (req.user.role === "dean") {
      additionalFilters.dean = req.user._id;
    }

    const result = await fetchDataHelper(req, res, Faculty, {
      ...FACULTY_FETCH_CONFIG,
      additionalFilters,
      populate: ["dean"],
    });

    return;
  } catch (error) {
    next(error)
  }
};

/* ===== Get Dean's Own Faculty ===== */
export const getMyFaculty = async (req, res, next) => {
  try {
    if (req.user.role !== "dean") {
      return buildResponse(res, 403, "This endpoint is for deans only");
    }

    const faculty = await FacultyService.getDeanFaculty(req.user._id);
    if (!faculty) {
      return buildResponse(res, 404, "Faculty not found");
    }

    const result = await fetchDataHelper(req, res, Faculty, {
      ...FACULTY_FETCH_CONFIG,
      additionalFilters: { _id: faculty._id },
    });
    
    return;
  } catch (error) {
   next(error)
  }
};

/* ===== Get Faculty by ID ===== */
export const getFacultyById = async (req, res, next) => {
  try {
    const { facultyId } = req.params;

    // Authorization check for deans
    const isAuthorized = await handleDeanAuthorization(req, facultyId);
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to access this faculty");
    }

    const result = await fetchDataHelper(req, res, Faculty, {
      configMap: dataMaps.FacultyById,
      autoPopulate: false,
      models: {},
      additionalFilters: { _id: facultyId },
    });
    return;
  } catch (error) {
    next(error)
  }
};

/* ===== Update Faculty ===== */
export const updateFaculty = async (req, res, next) => {
  try {
    const { facultyId } = req.params;
    const userFromMiddleware = req.user;

    // Authorization check for deans
    const isAuthorized = await handleDeanAuthorization(req, facultyId);
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to update this faculty");
    }

    // Validate faculty ID
    try {
      validateObjectId(facultyId, "faculty");
    } catch (error) {
      req.auditContext = FacultyService.createAuditContext(
        "UPDATE_FACULTY",
        "FAILURE",
        error.message,
        {
          facultyId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      throw new Error(error)
    }

    // Get faculty before update
    const facultyBefore = await FacultyService.getFacultyById(facultyId).catch(() => null);
    if (!facultyBefore) {
      req.auditContext = FacultyService.createAuditContext(
        "UPDATE_FACULTY",
        "FAILURE",
        "Faculty not found",
        {
          facultyId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 404, "Faculty not found");
    }

    // Deans cannot change dean assignment or faculty code
    if (userFromMiddleware.role === "dean") {
      if (req.body.dean || req.body.code) {
        req.auditContext = FacultyService.createAuditContext(
          "UPDATE_FACULTY",
          "FAILURE",
          "Deans cannot change dean assignment or faculty code",
          {
            facultyId,
            attemptedBy: userFromMiddleware.role,
            attemptedByUserId: userFromMiddleware._id,
            restrictedFields: req.body.dean ? "dean" : req.body.code ? "code" : "unknown",
          }
        );
        return buildResponse(res, 403, "Deans cannot change dean assignment or faculty code");
      }
    }

    // Update faculty
    const updatedFaculty = await FacultyService.updateFaculty(
      facultyId,
      req.body,
      userFromMiddleware.role
    );

    // Set audit context for success
    req.auditContext = FacultyService.createAuditContext(
      "UPDATE_FACULTY",
      "SUCCESS",
      `Faculty ${updatedFaculty.name} updated successfully`,
      {
        facultyId,
        facultyName: updatedFaculty.name,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        
      },{
          before: {
            name: facultyBefore.name,
            code: facultyBefore.code,
            dean: facultyBefore.dean,
          },
          after: {
            name: updatedFaculty.name,
            code: updatedFaculty.code,
            dean: updatedFaculty.dean,
          },
          changedFields: Object.keys(req.body).filter(
            (key) => req.body[key] !== undefined && ["name", "code", "dean"].includes(key)
          ),
        },
    );

    return buildResponse(res, 200, "Faculty updated successfully", updatedFaculty);
  } catch (error) {

    // Set audit context based on error type
    const status = error.message.includes("not found") ||
                   error.message.includes("already exists") ||
                   error.message.includes("cannot change") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 :
                      error.message.includes("already exists") ? 409 :
                      error.message.includes("cannot change") ? 403 : 500;

    req.auditContext = FacultyService.createAuditContext(
      "UPDATE_FACULTY",
      status,
      error.message,
      {
        facultyId: req.params.facultyId,
        attemptedBy: req.user.role,
        attemptedByUserId: req.user._id,
        updateData: req.body,
        error: error.message,
      }
    );

    next(error)
  }
};

/* ===== Delete Faculty ===== */
export const deleteFaculty = async (req, res, next) => {
  try {
    const userFromMiddleware = req.user;

    // Only admin can delete faculties
    if (userFromMiddleware.role !== "admin") {
      req.auditContext = FacultyService.createAuditContext(
        "DELETE_FACULTY",
        "FAILURE",
        "Only admin can delete faculties",
        {
          facultyId: req.params.facultyId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 403, "Only admin can delete faculties", null, true);
    }

    // Add delay for UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get faculty before deletion
    const facultyBefore = await FacultyService.getFacultyById(req.params.facultyId).catch(() => null);
    if (!facultyBefore) {
      req.auditContext = FacultyService.createAuditContext(
        "DELETE_FACULTY",
        "FAILURE",
        "Faculty not found",
        {
          facultyId: req.params.facultyId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 404, "Faculty not found");
    }

    // Delete faculty
    await FacultyService.deleteFaculty(req.params.facultyId);

    // Set audit context for success
    req.auditContext = FacultyService.createAuditContext(
      "DELETE_FACULTY",
      "SUCCESS",
      `Faculty ${facultyBefore.name} deleted successfully`,
      {
        facultyId: req.params.facultyId,
        facultyName: facultyBefore.name,
        facultyCode: facultyBefore.code,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        deletedAt: new Date().toISOString(),
      }
    );

    return buildResponse(res, 200, "Faculty deleted");
  } catch (error) {
    // Set audit context based on error type
    const status = error.message.includes("not found") ||
                   error.message.includes("associated departments") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 :
                      error.message.includes("associated departments") ? 400 : 500;

    req.auditContext = FacultyService.createAuditContext(
      "DELETE_FACULTY",
      status,
      error.message,
      {
        facultyId: req.params.facultyId,
        attemptedBy: req.user.role,
        attemptedByUserId: req.user._id,
        error: error.message,
      }
    );

    next(error)
  }
};

/* ===== Assign Dean to Faculty ===== */
export const assignDean = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId } = req.body;
    const { facultyId } = req.params;
    const userFromMiddleware = req.user;

    // Only admin can assign deans
    if (userFromMiddleware.role !== "admin") {
      await session.abortTransaction();
      session.endSession();
      
      req.auditContext = FacultyService.createAuditContext(
        "ASSIGN_DEAN",
        "FAILURE",
        "Only admin can assign deans",
        {
          facultyId,
          userId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      
      return buildResponse(res, 403, "Only admin can assign deans");
    }

    // Validate IDs
    try {
      validateObjectId(userId, "user");
      validateObjectId(facultyId, "faculty");
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      req.auditContext = FacultyService.createAuditContext(
        "ASSIGN_DEAN",
        "FAILURE",
        error.message,
        {
          facultyId,
          userId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      
      next(error);
    }

    // Assign dean
    const result = await FacultyService.assignDean(facultyId, userId, session);

    await session.commitTransaction();
    session.endSession();

    // Populate faculty with dean details
    const populatedFaculty = await Faculty.findById(facultyId)
      .populate({
        path: "dean",
        select: "firstName lastName email role staffId",
      })
      .lean();

    // Set audit context for success
    req.auditContext = FacultyService.createAuditContext(
      "ASSIGN_DEAN",
      "SUCCESS",
      `Dean assigned to faculty ${result.faculty.name} successfully`,
      {
        facultyId,
        facultyName: result.faculty.name,
        deanId: userId,
        deanName: resolveUserName(result.user, "FacultyService.assignDean.deanName"),
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        
      },
      {
          before: {
            dean: result.oldDeanId,
            userRole: result.oldUserData?.role,
            lecturerDean: result.oldLecturerData?.isDean,
          },
          after: {
            dean: userId,
            userRole: "dean",
            lecturerDean: true,
          },
        },
    );

    return buildResponse(res, 200, "Dean assigned successfully", populatedFaculty);
  } catch (error) {
    // Handle transaction cleanup
    if (session.transaction.isCommitted) {
      session.endSession();
    } else {
      await session.abortTransaction();
      session.endSession();
    }


    // Set audit context based on error type
    const status = error.message.includes("not found") ||
                   error.message.includes("already") ||
                   error.message.includes("Only lecturers") ||
                   error.message.includes("HOD") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 :
                      error.message.includes("already") ||
                      error.message.includes("Only lecturers") ||
                      error.message.includes("HOD") ? 400 : 500;

    req.auditContext = FacultyService.createAuditContext(
      "ASSIGN_DEAN",
      status,
      error.message,
      {
        facultyId: req.params.facultyId,
        userId: req.body.userId,
        attemptedBy: req.user.role,
        attemptedByUserId: req.user._id,
        error: error.message,
      }
    );

    next(error);
  }
};

/* ===== Remove Dean from Faculty ===== */
export const removeDean = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { facultyId } = req.params;
    const userFromMiddleware = req.user;

    // Only admin can remove deans
    if (userFromMiddleware.role !== "admin") {
      await session.abortTransaction();
      session.endSession();
      
      req.auditContext = FacultyService.createAuditContext(
        "REMOVE_DEAN",
        "FAILURE",
        "Only admin can remove deans",
        {
          facultyId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      
      return buildResponse(res, 403, "Only admin can remove deans");
    }

    // Validate faculty ID
    try {
      validateObjectId(facultyId, "faculty");
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      req.auditContext = FacultyService.createAuditContext(
        "REMOVE_DEAN",
        "FAILURE",
        error.message,
        {
          facultyId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      
      next(error);
    }

    // Remove dean
    const result = await FacultyService.removeDean(facultyId, session);

    await session.commitTransaction();
    session.endSession();

    // Set audit context for success
    req.auditContext = FacultyService.createAuditContext(
      "REMOVE_DEAN",
      "SUCCESS",
      `Dean removed from faculty ${result.faculty.name} successfully`,
      {
        facultyId,
        facultyName: result.faculty.name,
        removedDeanId: result.oldDeanId,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        
      },{
          before: {
            dean: result.oldDeanId,
            userRole: "dean",
            lecturerDean: true,
          },
          after: {
            dean: null,
            userRole: "lecturer",
            lecturerDean: false,
          },
        },
    );

    return buildResponse(res, 200, "Dean removed successfully");
  } catch (error) {
    await session.abortTransaction();
    session.endSession();


    // Set audit context based on error type
    const status = error.message.includes("not found") ||
                   error.message.includes("No dean") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 :
                      error.message.includes("No dean") ? 400 : 500;

    req.auditContext = FacultyService.createAuditContext(
      "REMOVE_DEAN",
      status,
      error.message,
      {
        facultyId: req.params.facultyId,
        attemptedBy: req.user.role,
        attemptedByUserId: req.user._id,
        error: error.message,
      }
    );

    next(error)
  }
};