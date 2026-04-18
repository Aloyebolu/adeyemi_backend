import { AdminUnit } from "../models/adminUnit.model.js";
import { AdminUnitMember } from "../models/adminUnitMember.model.js";
import buildResponse from "#utils/responseBuilder.js";
import { fetchDataHelper } from "#utils/fetchDataHelper.js";
import mongoose from "mongoose";
import { dataMaps } from "#config/dataMap.js";
import AdminUnitService from "../services/adminUnit.service.js";
import { resolveUserName } from "#utils/resolveUserName.js";
import AppError from "#shared/errors/AppError.js";

// Common configuration for fetchDataHelper
const ADMIN_UNIT_FETCH_CONFIG = {
  configMap: dataMaps.AdminUnit,
  autoPopulate: false,
  models: {},
};

const ADMIN_UNIT_MEMBER_FETCH_CONFIG = {
  configMap: dataMaps.AdminUnitMember,
  autoPopulate: false,
  models: {},
};

/**
 * Validate ObjectId
 */
const validateObjectId = (id, entityName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.log(id)
    throw new AppError(`Invalid ${entityName} ID format`, 500);
  }
};

/**
 * Create audit context object
 */
const createAuditContext = (action, status, reason, metadata = {}, changes = null) => {
  const severityMap = {
    "CREATE_ADMIN_UNIT": "MEDIUM",
    "UPDATE_ADMIN_UNIT": "MEDIUM",
    "DEACTIVATE_ADMIN_UNIT": "HIGH",
    "ADD_UNIT_MEMBER": "MEDIUM",
    "UPDATE_UNIT_MEMBER": "LOW",
    "REMOVE_UNIT_MEMBER": "MEDIUM",
    "ASSIGN_HEAD": "HIGH",
    "REMOVE_HEAD": "HIGH",
    "ACCESS_ADMIN_UNIT": "LOW",
  };

  return {
    action,
    resource: action.includes("MEMBER") ? "AdminUnitMember" : "AdminUnit",
    severity: severityMap[action] || "LOW",
    status,
    reason,
    metadata,
    ...(changes && { changes }),
  };
};

/**
 * Handle authorization for unit heads
 */
const handleHeadAuthorization = async (req, unitId) => {
  // Admin can access everything
  if (req.user.role === "admin") return true;

  // Check if user is the head of this unit
  const isHead = await AdminUnitService.userHasRole(req.user._id, unitId, ["HEAD"]);
  
  if (!isHead && req.user.role !== "admin") {
    req.auditContext = createAuditContext(
      "ACCESS_ADMIN_UNIT",
      "FAILURE",
      "Unauthorized access attempt",
      {
        unitId,
        attemptedBy: req.user.role,
        attemptedByUserId: req.user._id,
        reason: "User is not the head of this unit",
      }
    );
    return false;
  }

  return true;
};

/**
 * Check if user belongs to unit (for member-level operations)
 */
const handleMemberAuthorization = async (req, unitId) => {
  // Admin can access everything
  if (req.user.role === "admin") return true;

  // Check if user is a member of this unit
  const isMember = await AdminUnitService.userHasRole(req.user._id, unitId, [
    "HEAD", "DEPUTY", "STAFF", "ASSISTANT", "OFFICER"
  ]);
  
  if (!isMember) {
    req.auditContext = createAuditContext(
      "ACCESS_ADMIN_UNIT",
      "FAILURE",
      "Unauthorized access attempt - not a unit member",
      {
        unitId,
        attemptedBy: req.user.role,
        attemptedByUserId: req.user._id,
        reason: "User is not a member of this unit",
      }
    );
    return false;
  }

  return true;
};

/* ===== Create Admin Unit ===== */
export const createAdminUnit = async (req, res, next) => {
  try {
    const { name, code, type, description, parent_unit, fields, search_term, filters, page } = req.body;
    const userFromMiddleware = req.user;

    // Handle GET-like operations (filtering/searching)
    if (fields || search_term || filters || page) {
      const result = await fetchDataHelper(req, res, AdminUnit, {
        ...ADMIN_UNIT_FETCH_CONFIG,
        populate: ["parent_unit", "head"],
      });
      return;
    }

    // Only admin can create units
    if (userFromMiddleware.role !== "admin") {
      req.auditContext = createAuditContext(
        "CREATE_ADMIN_UNIT",
        "FAILURE",
        "Only admin can create administrative units",
        {
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 403, "Only admin can create administrative units", null, true);
    }

    // Create unit
    const unit = await AdminUnitService.createUnit({
      name,
      code,
      type,
      description,
      parent_unit,
    });

    // Set audit context for success
    req.auditContext = createAuditContext(
      "CREATE_ADMIN_UNIT",
      "SUCCESS",
      `Admin unit ${unit.name} created successfully`,
      {
        unitId: unit._id,
        unitName: unit.name,
        unitCode: unit.code,
        unitType: unit.type,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        createdBy: userFromMiddleware._id,
      }
    );

    return buildResponse(res, 201, "Admin unit created successfully", unit);
  } catch (error) {
    // Handle MongoDB duplicate key errors
    if (error.code === 11000 && error.keyValue?.code) {
      req.auditContext = createAuditContext(
        "CREATE_ADMIN_UNIT",
        "FAILURE",
        `Unit code '${error.keyValue.code}' already exists`,
        {
          attemptedBy: req.user?.role,
          attemptedByUserId: req.user?._id,
          duplicateCode: error.keyValue.code,
        }
      );
      return buildResponse(res, 409, `Unit code '${error.keyValue.code}' already exists`, null, true);
    }

    // Set audit context based on error type
    const status = error.message.includes("required") ||
                   error.message.includes("already exists") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("required") ? 400 :
                      error.message.includes("already exists") ? 409 : 500;

    req.auditContext = createAuditContext(
      "CREATE_ADMIN_UNIT",
      status,
      error.message,
      {
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        attemptedData: { 
          name: req.body.name, 
          code: req.body.code,
          type: req.body.type 
        },
        error: error.message,
      }
    );

    next(error);
  }
};

/* ===== Get All Admin Units ===== */
export const getAllAdminUnits = async (req, res, next) => {
  try {
    let additionalFilters = {};
    
    // If user is a unit head, only show their unit(s)
    if (req.user.role !== "admin") {
      const userUnits = await AdminUnitService.getUserUnits(req.user._id);
      const unitIds = userUnits.map(u => u.unit._id);
      additionalFilters._id = { $in: unitIds };
    }

    const result = await fetchDataHelper(req, res, AdminUnit, {
      ...ADMIN_UNIT_FETCH_CONFIG,
      additionalFilters,
      populate: ["parent_unit", "head"],
    });

    return;
  } catch (error) {
    next(error);
  }
};

/* ===== Get Admin Unit by ID ===== */
export const getAdminUnitById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Authorization check for unit heads
    const isAuthorized = await handleMemberAuthorization(req, id);
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to access this unit");
    }

    const result = await fetchDataHelper(req, res, AdminUnit, {
    //   configMap: dataMaps.AdminUnitById,
      autoPopulate: false,
      forceFind: true,
      models: {},
      additionalFilters: { _id: id },
      populate: ["parent_unit", "head"],
      singleResponse: true
    });
    return;
  } catch (error) {
    next(error);
  }
};

/* ===== Update Admin Unit ===== */
export const updateAdminUnit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userFromMiddleware = req.user;

    // Authorization check for unit heads
    const isAuthorized = await handleHeadAuthorization(req, id);
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to update this unit");
    }

    // Validate unit ID
    try {
      validateObjectId(id, "admin unit");
    } catch (error) {
      req.auditContext = createAuditContext(
        "UPDATE_ADMIN_UNIT",
        "FAILURE",
        error.message,
        {
          unitId: id,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      throw new Error(error);
    }

    // Get unit before update
    const unitBefore = await AdminUnitService.getUnitById(id).catch(() => null);
    if (!unitBefore) {
      req.auditContext = createAuditContext(
        "UPDATE_ADMIN_UNIT",
        "FAILURE",
        "Admin unit not found",
        {
          unitId: id,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 404, "Admin unit not found");
    }

    // Unit heads cannot change unit type or code
    if (userFromMiddleware.role !== "admin") {
      if (req.body.type || req.body.code) {
        req.auditContext = createAuditContext(
          "UPDATE_ADMIN_UNIT",
          "FAILURE",
          "Unit heads cannot change unit type or code",
          {
            unitId: id,
            attemptedBy: userFromMiddleware.role,
            attemptedByUserId: userFromMiddleware._id,
            restrictedFields: req.body.type ? "type" : "code",
          }
        );
        return buildResponse(res, 403, "Unit heads cannot change unit type or code");
      }
    }

    // Update unit
    const updatedUnit = await AdminUnitService.updateUnit(id, req.body);

    // Set audit context for success
    req.auditContext = createAuditContext(
      "UPDATE_ADMIN_UNIT",
      "SUCCESS",
      `Admin unit ${updatedUnit.name} updated successfully`,
      {
        unitId: id,
        unitName: updatedUnit.name,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
      },
      {
        before: {
          name: unitBefore.name,
          code: unitBefore.code,
          type: unitBefore.type,
          description: unitBefore.description,
          is_active: unitBefore.is_active,
        },
        after: {
          name: updatedUnit.name,
          code: updatedUnit.code,
          type: updatedUnit.type,
          description: updatedUnit.description,
          is_active: updatedUnit.is_active,
        },
        changedFields: Object.keys(req.body).filter(
          (key) => req.body[key] !== undefined && 
          ["name", "code", "type", "description", "is_active", "parent_unit"].includes(key)
        ),
      }
    );

    return buildResponse(res, 200, "Admin unit updated successfully", updatedUnit);
  } catch (error) {
    // Set audit context based on error type
    const status = error.message.includes("not found") ||
                   error.message.includes("already exists") ||
                   error.message.includes("cannot change") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 :
                      error.message.includes("already exists") ? 409 :
                      error.message.includes("cannot change") ? 403 : 500;

    req.auditContext = createAuditContext(
      "UPDATE_ADMIN_UNIT",
      status,
      error.message,
      {
        unitId: req.params.id,
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        updateData: req.body,
        error: error.message,
      }
    );

    next(error);
  }
};

/* ===== Deactivate Admin Unit ===== */
export const deactivateAdminUnit = async (req, res, next) => {
  try {
    const userFromMiddleware = req.user;

    // Only admin can deactivate units
    if (userFromMiddleware.role !== "admin") {
      req.auditContext = createAuditContext(
        "DEACTIVATE_ADMIN_UNIT",
        "FAILURE",
        "Only admin can deactivate administrative units",
        {
          unitId: req.params.id,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 403, "Only admin can deactivate administrative units", null, true);
    }

    // Add delay for UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get unit before deactivation
    const unitBefore = await AdminUnitService.getUnitById(req.params.id).catch(() => null);
    if (!unitBefore) {
      req.auditContext = createAuditContext(
        "DEACTIVATE_ADMIN_UNIT",
        "FAILURE",
        "Admin unit not found",
        {
          unitId: req.params.id,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 404, "Admin unit not found");
    }

    // Deactivate unit
    await AdminUnitService.deactivateUnit(req.params.id);

    // Set audit context for success
    req.auditContext = createAuditContext(
      "DEACTIVATE_ADMIN_UNIT",
      "SUCCESS",
      `Admin unit ${unitBefore.name} deactivated successfully`,
      {
        unitId: req.params.id,
        unitName: unitBefore.name,
        unitCode: unitBefore.code,
        unitType: unitBefore.type,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        deactivatedAt: new Date().toISOString(),
      }
    );

    return buildResponse(res, 200, "Admin unit deactivated");
  } catch (error) {
    // Set audit context based on error type
    const status = error.message.includes("not found") ||
                   error.message.includes("active sub-units") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 :
                      error.message.includes("active sub-units") ? 400 : 500;

    req.auditContext = createAuditContext(
      "DEACTIVATE_ADMIN_UNIT",
      status,
      error.message,
      {
        unitId: req.params.id,
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        error: error.message,
      }
    );

    next(error);
  }
};

/* ===== Get Unit Members ===== */
export const getUnitMembers = async (req, res, next) => {
  try {
    const { unitId } = req.params;

    // Authorization check
    const isAuthorized = await handleMemberAuthorization(req, unitId);
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to view members of this unit");
    }

    const result = await fetchDataHelper(req, res, AdminUnitMember, {
      ...ADMIN_UNIT_MEMBER_FETCH_CONFIG,
      additionalFilters: { unit: unitId },
      populate: ["user"],
    });

    return;
  } catch (error) {
    next(error);
  }
};

/* ===== Add Unit Member ===== */
export const addUnitMember = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { unitId } = req.params;
    const { user, role, title, responsibilities } = req.body;
    const userFromMiddleware = req.user;
    const userId = user._id
    // Authorization check
    const isAuthorized = await handleHeadAuthorization(req, unitId);
    if (!isAuthorized) {
      await session.abortTransaction();
      session.endSession();
      return buildResponse(res, 403, "Not authorized to add members to this unit");
    }

    // Validate IDs
    try {
      validateObjectId(userId, "user");
      validateObjectId(unitId, "unit");
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      req.auditContext = createAuditContext(
        "ADD_UNIT_MEMBER",
        "FAILURE",
        error.message,
        {
          unitId,
          userId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      
      next(error);
      return;
    }

    // Add member
    const member = await AdminUnitService.addMember(unitId, {
      user: userId,
      role,
      title,
      responsibilities: responsibilities ? [responsibilities] : [],
    }, session);

    await session.commitTransaction();
    session.endSession();

    // Populate member with user details
    const populatedMember = await AdminUnitMember.findById(member._id)
      .populate("user", "name email role staffId")
      .lean();

    // Set audit context for success
    req.auditContext = createAuditContext(
      "ADD_UNIT_MEMBER",
      "SUCCESS",
      `Member added to unit successfully`,
      {
        unitId,
        memberId: member._id,
        userId,
        userName: resolveUserName(populatedMember.user, "AdminUnit.addMember.userName"),
        memberRole: role,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
      }
    );

    return buildResponse(res, 201, "Member added successfully", populatedMember);
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
                   error.message.includes("active HEAD") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 :
                      error.message.includes("already") ||
                      error.message.includes("active HEAD") ? 400 : 500;

    req.auditContext = createAuditContext(
      "ADD_UNIT_MEMBER",
      status,
      error.message,
      {
        unitId: req.params.unitId,
        userId: req.body.user,
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        error: error.message,
      }
    );

    next(error);
  }
};

/* ===== Update Unit Member ===== */
export const updateUnitMember = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const userFromMiddleware = req.user;

    // Get member to check unit
    const member = await AdminUnitMember.findById(memberId);
    if (!member) {
      req.auditContext = createAuditContext(
        "UPDATE_UNIT_MEMBER",
        "FAILURE",
        "Member not found",
        {
          memberId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 404, "Member not found");
    }

    // Authorization check
    const isAuthorized = await handleHeadAuthorization(req, member.unit.toString());
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to update members of this unit");
    }

    // Get member before update
    const memberBefore = { ...member.toObject() };

    // Update member
    const updatedMember = await AdminUnitService.updateMember(memberId, req.body);

    // Populate member with user details
    const populatedMember = await AdminUnitMember.findById(updatedMember._id)
      .populate("user", "name email")
      .lean();

    // Set audit context for success
    req.auditContext = createAuditContext(
      "UPDATE_UNIT_MEMBER",
      "SUCCESS",
      `Member updated successfully`,
      {
        unitId: member.unit,
        memberId,
        userId: member.user,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
      },
      {
        before: {
          role: memberBefore.role,
          title: memberBefore.title,
          is_active: memberBefore.is_active,
        },
        after: {
          role: updatedMember.role,
          title: updatedMember.title,
          is_active: updatedMember.is_active,
        },
        changedFields: Object.keys(req.body).filter(
          (key) => req.body[key] !== undefined
        ),
      }
    );

    return buildResponse(res, 200, "Member updated successfully", populatedMember);
  } catch (error) {
    const status = error.message.includes("not found") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 : 500;

    req.auditContext = createAuditContext(
      "UPDATE_UNIT_MEMBER",
      status,
      error.message,
      {
        memberId: req.params.memberId,
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        updateData: req.body,
        error: error.message,
      }
    );

    next(error);
  }
};

/* ===== Remove Unit Member ===== */
export const removeUnitMember = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const { reason } = req.body;
    const userFromMiddleware = req.user;

    // Get member to check unit
    const member = await AdminUnitMember.findById(memberId);
    if (!member) {
      req.auditContext = createAuditContext(
        "REMOVE_UNIT_MEMBER",
        "FAILURE",
        "Member not found",
        {
          memberId,
          attemptedBy: userFromMiddleware.role,
          attemptedByUserId: userFromMiddleware._id,
        }
      );
      return buildResponse(res, 404, "Member not found");
    }

    // Authorization check
    const isAuthorized = await handleHeadAuthorization(req, member.unit.toString());
    if (!isAuthorized) {
      return buildResponse(res, 403, "Not authorized to remove members from this unit");
    }

    // Cannot remove yourself if you're the only HEAD
    if (member.user.toString() === userFromMiddleware._id && member.role === "HEAD") {
      const otherHeads = await AdminUnitMember.countDocuments({
        unit: member.unit,
        role: "HEAD",
        is_active: true,
        _id: { $ne: memberId },
      });

      if (otherHeads === 0) {
        req.auditContext = createAuditContext(
          "REMOVE_UNIT_MEMBER",
          "FAILURE",
          "Cannot remove the only head of a unit",
          {
            unitId: member.unit,
            memberId,
            attemptedBy: userFromMiddleware.role,
            attemptedByUserId: userFromMiddleware._id,
          }
        );
        return buildResponse(res, 400, "Cannot remove the only head of a unit. Assign another head first.");
      }
    }

    // Remove member
    const removedMember = await AdminUnitService.removeMember(memberId, reason);

    // Set audit context for success
    req.auditContext = createAuditContext(
      "REMOVE_UNIT_MEMBER",
      "SUCCESS",
      `Member removed from unit successfully`,
      {
        unitId: member.unit,
        memberId,
        userId: member.user,
        memberRole: member.role,
        reason: reason || "No reason provided",
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
      }
    );

    return buildResponse(res, 200, "Member removed successfully");
  } catch (error) {
    const status = error.message.includes("not found") ? "FAILURE" : "ERROR";
    const statusCode = error.message.includes("not found") ? 404 : 500;

    req.auditContext = createAuditContext(
      "REMOVE_UNIT_MEMBER",
      status,
      error.message,
      {
        memberId: req.params.memberId,
        attemptedBy: req.user?.role,
        attemptedByUserId: req.user?._id,
        error: error.message,
      }
    );

    next(error);
  }
};

/* ===== Get Unit Hierarchy ===== */
export const getUnitHierarchy = async (req, res, next) => {
  try {
    const { id } = req.params;

    const hierarchy = await AdminUnitService.getUnitHierarchy(id);

    if (!hierarchy) {
      return buildResponse(res, 404, "Unit not found");
    }

    return buildResponse(res, 200, "Unit hierarchy retrieved successfully", hierarchy);
  } catch (error) {
    next(error);
  }
};

/* ===== Get Unit Tree ===== */
export const getUnitTree = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const tree = await AdminUnitService.getUnitTree(id || null);

    return buildResponse(res, 200, "Unit tree retrieved successfully", { tree });
  } catch (error) {
    next(error);
  }
};

/* ===== Get Current User's Units ===== */
export const getMyUnits = async (req, res, next) => {
  try {
    const units = await AdminUnitService.getUserUnits(req.user._id);

    return buildResponse(res, 200, "User units retrieved successfully", { units });
  } catch (error) {
    next(error);
  }
};

/* ===== Get Units for Specific User ===== */
export const getUserUnits = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Only admin can view other users' units
    if (req.user.role !== "admin" && req.user._id.toString() !== userId) {
      return buildResponse(res, 403, "Not authorized to view other user's units");
    }

    const units = await AdminUnitService.getUserUnits(userId);

    return buildResponse(res, 200, "User units retrieved successfully", { units });
  } catch (error) {
    next(error);
  }
};