import { StaffModel } from "../models/staff.model.js";
import StaffService from "../services/staff.service.js";
import buildResponse from "#utils/responseBuilder.js";
import { fetchDataHelper } from "#utils/fetchDataHelper.js";
import { dataMaps } from "#config/dataMap.js";
import { resolveUserName } from "#utils/resolveUserName.js";
import mongoose from "mongoose";
import AppError from "#shared/errors/AppError.js";

// Common configuration for fetchDataHelper
const STAFF_FETCH_CONFIG = {
  configMap: dataMaps.Staff,
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
 * Create audit context object
 */
const createAuditContext = (action, status, reason, metadata = {}, changes = null) => {
  const severityMap = {
    "CREATE_STAFF": "HIGH",
    "UPDATE_STAFF": "MEDIUM",
    "DEACTIVATE_STAFF": "HIGH",
    "ACTIVATE_STAFF": "MEDIUM",
    "BULK_CREATE_STAFF": "HIGH",
  };

  return {
    action,
    resource: "Staff",
    severity: severityMap[action] || "MEDIUM",
    status,
    reason,
    metadata,
    ...(changes && { changes }),
  };
};

/* ===== Create Staff with User (MAIN CREATE METHOD) ===== */
export const createStaff = async (req, res, next) => {
  try {
    if(req._intent= 'GET'){
      return getAllStaff(req, res, next);
    }
    const { 
      first_name, last_name, middle_name, email, phone, address,
      staffId, position, employment_type 
    } = req.body;
    const userFromMiddleware = req.user;

    // Only admin can create staff
    if (userFromMiddleware.role !== "admin") {
      req.auditContext = createAuditContext(
        "CREATE_STAFF_WITH_USER",
        "FAILURE",
        "Only admin can create staff records",
        {
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 403, "Only admin can create staff records", null, true);
    }

    // Validate required fields
    if (!first_name || !last_name || !email) {
      throw new AppError("First name, last name, and email are required", 400);
    }

    // Create staff with user account
    const result = await StaffService.createStaff({
      first_name, last_name, middle_name, email, phone, address,
      staffId, position, employment_type
    });

    // Set audit context for success
    req.auditContext = createAuditContext(
      "CREATE_STAFF_WITH_USER",
      "SUCCESS",
      `Staff record created for ${result.user.first_name} ${result.user.last_name}`,
      {
        staffId: result.staff.staffId,
        userId: result.user._id,
        userName: `${result.user.first_name} ${result.user.last_name}`,
        email: result.user.email,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        defaultPassword: result.defaultPassword, // Log the default password for admin reference
      }
    );

    return buildResponse(res, 201, "Staff created successfully", {
      staff: result.staff,
      defaultPassword: result.defaultPassword, // Return so frontend can display to admin
    });
  } catch (error) {
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = error.keyValue?.staffId ? "Staff ID" : "Email";
      const value = error.keyValue?.staffId || error.keyValue?.email;
      
      req.auditContext = createAuditContext(
        "CREATE_STAFF_WITH_USER",
        "FAILURE",
        `${field} '${value}' already exists`,
        {
          attemptedBy: req.user?.role,
          attemptedByUserId: req.user?._id,
          duplicateField: field,
          duplicateValue: value,
        }
      );
      return buildResponse(res, 409, `${field} already exists`, null, true);
    }

    req.auditContext = createAuditContext(
      "CREATE_STAFF_WITH_USER",
      "ERROR",
      error.message,
      {
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        error: error.message,
      }
    );

    next(error);
  }
};

/* ===== Get All Staff ===== */
export const getAllStaff = async (req, res, next) => {
  try {
    let additionalFilters = {};
    
    if (req.query.is_active !== undefined) {
      additionalFilters.is_active = req.query.is_active === 'true';
    }
    if (req.query.employment_type) {
      additionalFilters.employment_type = req.query.employment_type;
    }

    const result = await fetchDataHelper(req, res, StaffModel, {
      ...STAFF_FETCH_CONFIG,
      additionalFilters,
      populate: [{
        path: "_id",
        select: "name email role avatar phone"
      }],
    });

    return;
  } catch (error) {
    next(error);
  }
};

/* ===== Get Staff by ID ===== */
export const getStaffById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await fetchDataHelper(req, res, StaffModel, {
      configMap: dataMaps.StaffById,
      autoPopulate: false,
      models: {},
      additionalFilters: { _id: id },
      populate: [{
        path: "_id",
        select: "name email role avatar phone address"
      }],
    });
    return;
  } catch (error) {
    next(error);
  }
};

/* ===== Get Staff by Staff ID (Custom ID) ===== */
export const getStaffByStaffId = async (req, res, next) => {
  try {
    const { staffId } = req.params;

    const staff = await StaffService.getStaffByStaffId(staffId);

    return buildResponse(res, 200, "Staff retrieved successfully", { staff });
  } catch (error) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    next(new AppError(error.message, statusCode));
  }
};

/* ===== Update Staff ===== */
export const updateStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userFromMiddleware = req.user;

    // Only admin can update staff records
    if (userFromMiddleware.role !== "admin") {
      req.auditContext = createAuditContext(
        "UPDATE_STAFF",
        "FAILURE",
        "Only admin can update staff records",
        {
          staffId: id,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 403, "Only admin can update staff records", null, true);
    }

    // Get staff before update
    const staffBefore = await StaffService.getStaffById(id).catch(() => null);
    if (!staffBefore) {
      req.auditContext = createAuditContext(
        "UPDATE_STAFF",
        "FAILURE",
        "Staff not found",
        {
          staffId: id,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 404, "Staff not found");
    }

    // Update staff
    const updatedStaff = await StaffService.updateStaff(id, req.body);

    // Set audit context for success
    req.auditContext = createAuditContext(
      "UPDATE_STAFF",
      "SUCCESS",
      `Staff record updated successfully`,
      {
        staffId: updatedStaff.staffId,
        userId: updatedStaff._id,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
      },
      {
        before: {
          employment_type: staffBefore.employment_type,
          is_active: staffBefore.is_active,
        },
        after: {
          employment_type: updatedStaff.employment_type,
          is_active: updatedStaff.is_active,
        },
        changedFields: Object.keys(req.body).filter(
          (key) => req.body[key] !== undefined
        ),
      }
    );

    return buildResponse(res, 200, "Staff updated successfully", updatedStaff);
  } catch (error) {
    const status = error.message.includes("not found") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 : 500;

    req.auditContext = createAuditContext(
      "UPDATE_STAFF",
      status,
      error.message,
      {
        staffId: req.params.id,
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        updateData: req.body,
        error: error.message,
      }
    );

    next(error);
  }
};

/* ===== Deactivate Staff ===== */
export const deactivateStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userFromMiddleware = req.user;

    // Only admin can deactivate staff
    if (userFromMiddleware.role !== "admin") {
      req.auditContext = createAuditContext(
        "DEACTIVATE_STAFF",
        "FAILURE",
        "Only admin can deactivate staff records",
        {
          staffId: id,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 403, "Only admin can deactivate staff records", null, true);
    }

    // Get staff before deactivation
    const staffBefore = await StaffService.getStaffById(id).catch(() => null);
    if (!staffBefore) {
      return buildResponse(res, 404, "Staff not found");
    }

    // Deactivate staff
    const deactivatedStaff = await StaffService.deactivateStaff(id);

    // Set audit context for success
    req.auditContext = createAuditContext(
      "DEACTIVATE_STAFF",
      "SUCCESS",
      `Staff record deactivated successfully`,
      {
        staffId: deactivatedStaff.staffId,
        userId: deactivatedStaff._id,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
      }
    );

    return buildResponse(res, 200, "Staff deactivated successfully", deactivatedStaff);
  } catch (error) {
    req.auditContext = createAuditContext(
      "DEACTIVATE_STAFF",
      "ERROR",
      error.message,
      {
        staffId: req.params.id,
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        error: error.message,
      }
    );

    next(error);
  }
};

/* ===== Activate Staff ===== */
export const activateStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { employment_type } = req.body;
    const userFromMiddleware = req.user;

    // Only admin can activate staff
    if (userFromMiddleware.role !== "admin") {
      req.auditContext = createAuditContext(
        "ACTIVATE_STAFF",
        "FAILURE",
        "Only admin can activate staff records",
        {
          staffId: id,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 403, "Only admin can activate staff records", null, true);
    }

    const activatedStaff = await StaffService.activateStaff(id, employment_type);

    req.auditContext = createAuditContext(
      "ACTIVATE_STAFF",
      "SUCCESS",
      `Staff record activated successfully`,
      {
        staffId: activatedStaff.staffId,
        userId: activatedStaff._id,
        employment_type: activatedStaff.employment_type,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
      }
    );

    return buildResponse(res, 200, "Staff activated successfully", activatedStaff);
  } catch (error) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    next(new AppError(error.message, statusCode));
  }
};

/* ===== Search Staff ===== */
export const searchStaff = async (req, res, next) => {
  try {
    const { q, limit } = req.query;
    
    if (!q) {
      return buildResponse(res, 400, "Search term is required");
    }

    const staff = await StaffService.searchStaff(q, parseInt(limit) || 20);

    return buildResponse(res, 200, "Staff search results", { staff });
  } catch (error) {
    next(error);
  }
};

/* ===== Get Staff Statistics ===== */
export const getStaffStatistics = async (req, res, next) => {
  try {
    const statistics = await StaffService.getStaffStatistics();

    return buildResponse(res, 200, "Staff statistics retrieved successfully", { statistics });
  } catch (error) {
    next(error);
  }
};

/* ===== Bulk Create Staff ===== */
export const bulkCreateStaff = async (req, res, next) => {
  try {
    const { userIds, defaultData } = req.body;
    const userFromMiddleware = req.user;

    // Only admin can bulk create staff
    if (userFromMiddleware.role !== "admin") {
      req.auditContext = createAuditContext(
        "BULK_CREATE_STAFF",
        "FAILURE",
        "Only admin can bulk create staff records",
        {
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 403, "Only admin can bulk create staff records", null, true);
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return buildResponse(res, 400, "User IDs array is required");
    }

    const results = await StaffService.bulkCreateStaff(userIds, defaultData || {});

    req.auditContext = createAuditContext(
      "BULK_CREATE_STAFF",
      "SUCCESS",
      `Bulk staff creation completed`,
      {
        total: userIds.length,
        successful: results.successful.length,
        failed: results.failed.length,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
      }
    );

    return buildResponse(res, 201, "Bulk staff creation completed", results);
  } catch (error) {
    req.auditContext = createAuditContext(
      "BULK_CREATE_STAFF",
      "ERROR",
      error.message,
      {
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        error: error.message,
      }
    );

    next(error);
  }
};