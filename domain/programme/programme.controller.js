import mongoose from "mongoose";
import buildResponse from "#utils/responseBuilder.js";
import { fetchDataHelper } from "#utils/fetchDataHelper.js";
import { dataMaps } from "#config/dataMap.js";
import ProgrammeService from "./programme.service.js";
import DepartmentService from "#domain/department/department.service.js";
import FacultyService from "#domain/faculty/faculty.service.js";
import AppError from "#shared/errors/AppError.js";
import programmeModel from "./programme.model.js";
import { getDepartmentById } from "#domain/department/department.controller.js";
import departmentService from "#domain/department/department.service.js";

// Common configuration for fetchDataHelper
const PROGRAMME_FETCH_CONFIG = {
  configMap: dataMaps.ProgrammeList,
  autoPopulate: true,
  models: { programmeModel },
};

/**
 * Handle authorization for programme operations
 */
const handleProgrammeAuthorization = async (req, programmeId = null, departmentId = null) => {
  const { role, _id: userId } = req.user;

  // Admin has full access
  if (role === 'admin') return true;

  // Dean access check
  if (role === 'dean') {
    if (departmentId) {
      const hasAccess = await DepartmentService.checkDeanDepartmentAccess(userId, departmentId);
      if (!hasAccess) return false;
    }
    
    if (programmeId) {
      const programme = await programmeModel.findById(programmeId).populate('department');
      if (!programme || !programme.department) return false;
      
      const hasAccess = await DepartmentService.checkDeanDepartmentAccess(userId, programme.department._id);
      return hasAccess;
    }
  }

  // HOD access check
  if (role === 'hod') {
    const userDepartment = await DepartmentService.getUserDepartment(userId);
    if (!userDepartment) return false;

    if (departmentId && departmentId.toString() !== userDepartment._id.toString()) {
      return false;
    }

    if (programmeId) {
      const programme = await programmeModel.findById(programmeId);
      if (!programme) return false;
      
      return programme.department.toString() === userDepartment._id.toString();
    }
  }

  return true;
};

/**
 * Validate ObjectId
 */
const validateObjectId = (id, entityName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${entityName} ID provided`, 400);
  }
};

/**
 * Build additional filters based on user role
 */
const buildProgrammeFilters = async (req) => {
  const filters = {};

  // Only show active programmes by default
  filters.isActive = true;

  // Apply role-based filters
  if (req.user.role === 'dean') {
    const faculty = await FacultyService.getDeanFaculty(req.user._id);
    if (faculty) {
      filters.faculty = faculty._id;
    }
  } else if (req.user.role === 'hod') {
    const department = await DepartmentService.getUserDepartment(req.user._id);
    if (department) {
      filters.department = department._id;
    }
  }

  return filters;
};

/* ===== Get All Programmes ===== */
export const getAllProgrammes = async (req, res, next) => {
  try {
    const additionalFilters = await buildProgrammeFilters(req);

    return await fetchDataHelper(req, res, programmeModel, {
      ...PROGRAMME_FETCH_CONFIG,
      populate: ["department", "faculty"],
      additionalFilters
    });
  } catch (error) {
    throw error
  }
};

/* ===== Get Programme Stats ===== */
export const getProgrammeStats = async (req, res, next) => {
  try {
    const additionalFilters = await buildProgrammeFilters(req);

    return await fetchDataHelper(req, res, programmeModel, {
      configMap: dataMaps.ProgrammeStats,
      autoPopulate: true,
      models: { programmeModel },
      additionalFilters
    });
  } catch (error) {
    next(error);
  }
};

/* ===== Create Programme ===== */
export const createProgramme = async (req, res, next) => {
  try {
    const {
      code,
      department,
      duration,
      degreeType,
      programmeType,
      description,
      accreditationStatus,
      accreditationExpiry,
      intakeCapacity
    } = req.body;

    const userFromMiddleware = req.user;

    // Handle GET-like operations (filtering)
    if (req.body.fields || req.body.search_term || req.body.filters || req.body.page) {
      const result = await fetchDataHelper(req, res, programmeModel, {
        ...PROGRAMME_FETCH_CONFIG,
        populate: ["department", "faculty"]
      });
      return;
    }

    // Authorization check
    const isAuthorized = await handleProgrammeAuthorization(req, null, department);
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to create programme in this department");
    }

    const departmentData = await departmentService.getDepartmentById(department);

    // Create programme
    const programme = await ProgrammeService.createProgramme({
      name: departmentData.name,
      code,
      department,
      duration,
      degreeType,
      programmeType,
      description,
      accreditationStatus,
      accreditationExpiry,
      intakeCapacity,
      createdBy: userFromMiddleware._id
    });

    // Set audit context
    req.auditContext = ProgrammeService.createAuditContext(
      "CREATE_PROGRAMME",
      "SUCCESS",
      `Programme ${programme.name} created successfully`,
      {
        programmeId: programme._id,
        programmeName: programme.name,
        programmeCode: programme.code,
        department,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id
      },
      {
        before: null,
        after: programme.toObject()
      }
    );

    // Return the created programme
    return await getProgrammeById({...req, params: { programmeId: programme._id } }, res, next);
  } catch (error) {

    // Set audit context
    req.auditContext = ProgrammeService.createAuditContext(
      "CREATE_PROGRAMME",
      error.message.includes("already exists") ? "FAILURE" : "ERROR",
      error.message,
      {
        attemptedBy: req.user.role,
        attemptedByUserId: req.user._id,
        attemptedData: req.body,
        error: error.message
      }
    );

    throw error
  }
};

/* ===== Get Programme by ID ===== */
export const getProgrammeById = async (req, res, next) => {
  try {
    const { programmeId } = req.params;

    validateObjectId(programmeId, "programme");

    // Authorization check
    const isAuthorized = await handleProgrammeAuthorization(req, programmeId);
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to access this programme");
    }

    const additionalFilters = await buildProgrammeFilters(req);
    additionalFilters._id = programmeId;

    const result = await fetchDataHelper(req, res, programmeModel, {
      configMap: dataMaps.ProgrammeById,
      autoPopulate: false,
      models: { programmeModel },
      populate: ["department", "faculty", "createdBy", "lastUpdatedBy"],
      additionalFilters
    });

    return;
  } catch (error) {
    next(error);
  }
};

/* ===== Get Programmes by Department ===== */
export const getProgrammesByDepartment = async (req, res, next) => {
  try {
    const { departmentId } = req.params;
    const { page = 1, limit = 50, isActive = true } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    validateObjectId(departmentId, "department");

    // Authorization check
    const isAuthorized = await handleProgrammeAuthorization(req, null, departmentId);
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to access programmes in this department");
    }

    const [programmes, totalCount] = await Promise.all([
      programmeModel.find({ department: departmentId, isActive })
        .populate("department", "name code")
        .populate("faculty", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      programmeModel.countDocuments({ department: departmentId, isActive })
    ]);

    if (!programmes || programmes.length === 0) {
      return buildResponse(res, 404, "No programmes found for this department");
    }

    const totalPages = Math.ceil(totalCount / Number(limit));

    return buildResponse(res, 200, "Programmes fetched successfully", {
      pagination: {
        current_page: Number(page),
        limit: Number(limit),
        total_pages: totalPages,
        total_items: totalCount,
      },
      data: programmes,
    });
  } catch (error) {
    next(error);
  }
};

/* ===== Update Programme ===== */
export const updateProgramme = async (req, res, next) => {
  try {
    const { programmeId } = req.params;
    const userFromMiddleware = req.user;

    validateObjectId(programmeId, "programme");

    // Authorization check
    const isAuthorized = await handleProgrammeAuthorization(req, programmeId);
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to update this programme");
    }

    // Get programme before update
    const programmeBefore = await ProgrammeService.getProgrammeById(programmeId)
      .catch(() => null);

    if (!programmeBefore) {
      return buildResponse(res, 404, "Programme not found");
    }

    // Update programme
    const updatedProgramme = await ProgrammeService.updateProgramme(
      programmeId,
      req.body,
      userFromMiddleware
    );

    // Set audit context
    req.auditContext = ProgrammeService.createAuditContext(
      "UPDATE_PROGRAMME",
      "SUCCESS",
      `Programme ${updatedProgramme.name} updated successfully`,
      {
        programmeId,
        programmeName: updatedProgramme.name,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id
      },
      {
        before: programmeBefore.toObject(),
        after: updatedProgramme.toObject(),
        changedFields: Object.keys(req.body).filter(key => req.body[key] !== undefined)
      }
    );

    return buildResponse(res, 200, "Programme updated successfully", updatedProgramme);
  } catch (error) {

    // Set audit context
    req.auditContext = ProgrammeService.createAuditContext(
      "UPDATE_PROGRAMME",
      error.message.includes("not found") || error.message.includes("already exists") ? "FAILURE" : "ERROR",
      error.message,
      {
        programmeId: req.params.programmeId,
        attemptedBy: req.user.role,
        attemptedByUserId: req.user._id,
        updateData: req.body,
        error: error.message
      }
    );

    next(error);
  }
};

/* ===== Delete Programme (Soft Delete) ===== */
export const deleteProgramme = async (req, res, next) => {
  try {
    const { programmeId } = req.params;
    const userFromMiddleware = req.user;

    validateObjectId(programmeId, "programme");

    // Authorization check
    const isAuthorized = await handleProgrammeAuthorization(req, programmeId);
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to delete this programme");
    }

    // Get programme before deletion
    const programmeBefore = await ProgrammeService.getProgrammeById(programmeId)
      .catch(() => null);

    if (!programmeBefore) {
      return buildResponse(res, 404, "Programme not found");
    }

    // Soft delete programme
    await ProgrammeService.deleteProgramme(programmeId, userFromMiddleware._id);

    // Set audit context
    req.auditContext = ProgrammeService.createAuditContext(
      "DELETE_PROGRAMME",
      "SUCCESS",
      `Programme ${programmeBefore.name} deleted successfully`,
      {
        programmeId,
        programmeName: programmeBefore.name,
        programmeCode: programmeBefore.code,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        deletedAt: new Date().toISOString()
      }
    );

    return buildResponse(res, 200, "Programme deleted successfully");
  } catch (error) {

    // Set audit context
    req.auditContext = ProgrammeService.createAuditContext(
      "DELETE_PROGRAMME",
      error.message.includes("not found") || error.message.includes("Cannot delete") ? "FAILURE" : "ERROR",
      error.message,
      {
        programmeId: req.params.programmeId,
        attemptedBy: req.user.role,
        attemptedByUserId: req.user._id,
        error: error.message
      }
    );

    next(error);
  }
};

/* ===== Toggle Programme Status ===== */
export const toggleProgrammeStatus = async (req, res, next) => {
  try {
    const { programmeId } = req.params;
    const { isActive } = req.body;
    const userFromMiddleware = req.user;

    validateObjectId(programmeId, "programme");

    if (typeof isActive !== 'boolean') {
      return buildResponse(res, 400, "isActive must be a boolean value");
    }

    // Authorization check
    const isAuthorized = await handleProgrammeAuthorization(req, programmeId);
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to update this programme");
    }

    // Get programme before update
    const programmeBefore = await ProgrammeService.getProgrammeById(programmeId);

    // Update status
    const updatedProgramme = await ProgrammeService.updateProgrammeStatus(
      programmeId,
      isActive,
      userFromMiddleware._id
    );

    // Set audit context
    req.auditContext = ProgrammeService.createAuditContext(
      "TOGGLE_PROGRAMME_STATUS",
      "SUCCESS",
      `Programme ${updatedProgramme.name} status changed to ${isActive ? 'active' : 'inactive'}`,
      {
        programmeId,
        programmeName: updatedProgramme.name,
        previousStatus: programmeBefore.isActive,
        newStatus: updatedProgramme.isActive,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id
      },
      {
        before: { isActive: programmeBefore.isActive },
        after: { isActive: updatedProgramme.isActive }
      }
    );

    return buildResponse(res, 200, `Programme ${isActive ? 'activated' : 'deactivated'} successfully`, updatedProgramme);
  } catch (error) {
    next(error);
  }
};

/* ===== Get Programmes by Degree Type ===== */
export const getProgrammesByDegreeType = async (req, res, next) => {
  try {
    const { degreeType } = req.params;
    const { departmentId, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const validDegreeTypes = ['BACHELOR', 'MASTER', 'PHD', 'DIPLOMA', 'CERTIFICATE'];
    if (!validDegreeTypes.includes(degreeType.toUpperCase())) {
      return buildResponse(res, 400, "Invalid degree type");
    }

    // Build query
    const query = { 
      degreeType: degreeType.toUpperCase(),
      isActive: true 
    };

    // Apply department filter if provided
    if (departmentId) {
      validateObjectId(departmentId, "department");
      
      // Authorization check
      const isAuthorized = await handleProgrammeAuthorization(req, null, departmentId);
      if (!isAuthorized) {
        return buildResponse(res, 403, "Not authorized to access programmes in this department");
      }
      query.department = departmentId;
    } else {
      // Apply role-based filters
      const additionalFilters = await buildProgrammeFilters(req);
      Object.assign(query, additionalFilters);
    }

    const [programmes, totalCount] = await Promise.all([
      programmeModel.find(query)
        .populate("department", "name code")
        .populate("faculty", "name")
        .sort({ name: 1 })
        .skip(skip)
        .limit(Number(limit)),
      programmeModel.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / Number(limit));

    return buildResponse(res, 200, "Programmes fetched successfully", {
      pagination: {
        current_page: Number(page),
        limit: Number(limit),
        total_pages: totalPages,
        total_items: totalCount,
      },
      data: programmes,
      degreeType: degreeType.toUpperCase()
    });
  } catch (error) {
    next(error);
  }
};

/* ===== Search Programmes ===== */
export const searchProgrammes = async (req, res, next) => {
  try {
    const { search_term, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    if (!search_term || search_term.trim().length < 2) {
      return buildResponse(res, 400, "Search term must be at least 2 characters");
    }

    const additionalFilters = await buildProgrammeFilters(req);
    
    // Build search query
    const query = {
      ...additionalFilters,
      $or: [
        { name: { $regex: search_term, $options: 'i' } },
        { code: { $regex: search_term, $options: 'i' } }
      ]
    };

    const [programmes, totalCount] = await Promise.all([
      programmeModel.find(query)
        .populate("department", "name code")
        .populate("faculty", "name")
        .sort({ name: 1 })
        .skip(skip)
        .limit(Number(limit)),
      programmeModel.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / Number(limit));

    return buildResponse(res, 200, "Programmes search results", {
      pagination: {
        current_page: Number(page),
        limit: Number(limit),
        total_pages: totalPages,
        total_items: totalCount,
      },
      search_term,
      data: programmes,
    });
  } catch (error) {
    next(error);
  }
};

/* ===== Get Accredited Programmes ===== */
export const getAccreditedProgrammes = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const additionalFilters = await buildProgrammeFilters(req);
    additionalFilters.accreditationStatus = 'ACCREDITED';
    additionalFilters.accreditationExpiry = { $gt: new Date() };

    const [programmes, totalCount] = await Promise.all([
      programmeModel.find(additionalFilters)
        .populate("department", "name code")
        .populate("faculty", "name")
        .sort({ name: 1 })
        .skip(skip)
        .limit(Number(limit)),
      programmeModel.countDocuments(additionalFilters)
    ]);

    const totalPages = Math.ceil(totalCount / Number(limit));

    return buildResponse(res, 200, "Accredited programmes", {
      pagination: {
        current_page: Number(page),
        limit: Number(limit),
        total_pages: totalPages,
        total_items: totalCount,
      },
      data: programmes,
    });
  } catch (error) {
    next(error);
  }
};