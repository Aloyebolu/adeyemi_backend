// controllers/organization.controller.js
import mongoose from "mongoose";
import OrganizationalUnitService from "#domain/organization/services/OrganizationalUnitService.js";
import buildResponse from "#utils/responseBuilder.js";
import { fetchDataHelper } from "#utils/fetchDataHelper.js";
import { dataMaps } from "#config/dataMap.js";
import AppError from "#shared/errors/AppError.js";
import OrganizationalUnit from "#domain/organization/models/organizationalUnit.model.js";
import OrganizationalUnitMemberService from "../services/organizationalUnitMember.service.js";
import { UnitListResponseDto } from "../dtos/organizational-unit.dto.js";

// Configuration for fetchDataHelper compatibility
const ORGANIZATIONAL_UNIT_FETCH_CONFIG = {
    configMap: dataMaps.AdminUnit, // Keep AdminUnit mapping for backward compatibility
    autoPopulate: false,
    models: {},
};

const ORGANIZATIONAL_UNIT_MEMBER_FETCH_CONFIG = {
    configMap: dataMaps.AdminUnitMember, // Keep AdminUnitMember mapping for backward compatibility
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

    try {
        // Check if user is the head of this unit using new service
        const unit = await OrganizationalUnitService.getUnitById(unitId);
        if (!unit) return false;

        // Check if the current user is the head
        const isHead = unit.head_user_id && unit.head_user_id.toString() === req.user._id.toString();

        if (!isHead) {
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
    } catch (error) {
        return false;
    }
};

/**
 * Check if user belongs to unit (for member-level operations)
 * Note: Member management is separate - this provides compatibility
 */
const handleMemberAuthorization = async (req, unitId) => {
    // Admin can access everything
    if (req.user.role === "admin") return true;

    try {
        const unit = await OrganizationalUnitService.getUnitById(unitId);
        if (!unit) return false;

        // Check if user is head (for now, treat heads as members)
        const isHead = unit.head_user_id && unit.head_user_id.toString() === req.user._id.toString();

        if (!isHead && req.user.role !== "admin") {
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
    } catch (error) {
        return false;
    }
};

/**
 * Transform OrganizationalUnit to match AdminUnit response format
 */
const transformToAdminUnitFormat = (unit) => {
    if (!unit) return null;

    return {
        _id: unit.id,
        name: unit.name,
        code: unit.code,
        type: unit.type,
        description: unit.description,
        parent_unit: unit.parent_unit,
        head: unit.head_user_id ? {
            _id: unit.head_user_id._id || unit.head_user_id,
            name: unit.head_user_id.name || `${unit.head_user_id.first_name} ${unit.head_user_id.last_name}`,
            email: unit.head_user_id.email
        } : null,
        is_active: unit.is_active,
        depth: unit.depth,
        path: unit.path,
        createdAt: unit.createdAt,
        updatedAt: unit.updatedAt,
        // Additional computed fields for compatibility
        category: unit.derived_category,
        head_title: unit.effective_head_title
    };
};

const transformToAdminUnitListFormat = (units) => {
    return units.map(unit => transformToAdminUnitFormat(unit));
};

/* ===== Create Admin Unit ===== */
export const createAdminUnit = async (req, res, next) => {
    try {
        const { fields, search_term, filters, page } = req.body;
        const userFromMiddleware = req.user;

        // Handle GET-like operations (filtering/searching) - maintain compatibility
        if (fields || search_term || filters || page) {
            const result = await fetchDataHelper(req, res, OrganizationalUnit, {
                ...ORGANIZATIONAL_UNIT_FETCH_CONFIG,
                populate: ["parent_unit", "head_user_id"],
            });
            return;
        }

        // Only admin can create units
        if (userFromMiddleware.role !== "admin") {
            req.auditContext = createAuditContext(
                "CREATE_ADMIN_UNIT",
                "FAILURE",
                "Only admin can create organizational units",
                {
                    attemptedBy: userFromMiddleware.role,
                    attemptedByUserId: userFromMiddleware._id,
                }
            );
            return buildResponse(res, 403, "Only admin can create organizational units", null, true);
        }

        // Create unit using new service
        const unit = await OrganizationalUnitService.createUnit({
            name: req.body.name,
            code: req.body.code,
            type: req.body.type,
            description: req.body.description,
            parent_unit: req.body.parent_unit,
        }, userFromMiddleware._id);

        // Set audit context for success
        req.auditContext = createAuditContext(
            "CREATE_ADMIN_UNIT",
            "SUCCESS",
            `Unit ${unit.name} created successfully`,
            {
                unitId: unit.id,
                unitName: unit.name,
                unitCode: unit.code,
                unitType: unit.type,
                performedBy: userFromMiddleware.role,
                performedByUserId: userFromMiddleware._id,
                createdBy: userFromMiddleware._id,
            }
        );

        // Transform response to match AdminUnit format
        const transformedUnit = transformToAdminUnitFormat(unit);
        return buildResponse(res, 201, "Admin unit created successfully", transformedUnit);
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
        req.params.type = 'department'
        const {  type } = req.params
        let additionalFilters = { is_active: true };
        if (type) {
            // additionalFilters.type = type
        }

        // If user is a unit head, only show their unit(s)
        if (req.user.role !== "admin") {
            // Get units where user is head
            const units = await OrganizationalUnitService.queryUnits({
                head_user_id: req.user._id,
                is_active: true
            });
            const unitIds = units.data.map(u => u.id);
            additionalFilters._id = { $in: unitIds };
        }

        // Use fetchDataHelper for compatibility
        let units = await fetchDataHelper(req, res, OrganizationalUnit, {
            ...ORGANIZATIONAL_UNIT_FETCH_CONFIG,
            additionalFilters,
            populate: ["parent_unit", "head_user_id"],
            returnType: "object"
        });

        const response = units.data.map(unit => unit ? new UnitListResponseDto(unit) : {});
        return buildResponse.success(res, "Success", response, 200, { pagination: units.pagination });
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

        const unit = await OrganizationalUnitService.getUnitById(id, { populate: 'head_user_id' });

        if (!unit) {
            return buildResponse(res, 404, "Unit not found");
        }

        const transformedUnit = transformToAdminUnitFormat(unit);
        return buildResponse(res, 200, "Unit retrieved successfully", transformedUnit);
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
            validateObjectId(id, "unit");
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
            throw error;
        }

        // Get unit before update
        const unitBefore = await OrganizationalUnitService.getUnitById(id).catch(() => null);
        if (!unitBefore) {
            req.auditContext = createAuditContext(
                "UPDATE_ADMIN_UNIT",
                "FAILURE",
                "Unit not found",
                {
                    unitId: id,
                    attemptedBy: userFromMiddleware.role,
                    attemptedByUserId: userFromMiddleware._id,
                }
            );
            return buildResponse(res, 404, "Unit not found");
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

        // Update unit using new service
        const updatedUnit = await OrganizationalUnitService.updateUnit(id, req.body, userFromMiddleware.role);

        // Set audit context for success
        req.auditContext = createAuditContext(
            "UPDATE_ADMIN_UNIT",
            "SUCCESS",
            `Unit ${updatedUnit.name} updated successfully`,
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

        const transformedUnit = transformToAdminUnitFormat(updatedUnit);
        return buildResponse(res, 200, "Admin unit updated successfully", transformedUnit);
    } catch (error) {
        // Set audit context based on error type
        const status = error.message.includes("not found") ||
            error.message.includes("already exists") ||
            error.message.includes("cannot change") ? "FAILURE" : "ERROR";

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
                "Only admin can deactivate units",
                {
                    unitId: req.params.id,
                    attemptedBy: userFromMiddleware.role,
                    attemptedByUserId: userFromMiddleware._id,
                }
            );
            return buildResponse(res, 403, "Only admin can deactivate units", null, true);
        }

        // Add delay for UX
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Get unit before deactivation
        const unitBefore = await OrganizationalUnitService.getUnitById(req.params.id).catch(() => null);
        if (!unitBefore) {
            req.auditContext = createAuditContext(
                "DEACTIVATE_ADMIN_UNIT",
                "FAILURE",
                "Unit not found",
                {
                    unitId: req.params.id,
                    attemptedBy: userFromMiddleware.role,
                    attemptedByUserId: userFromMiddleware._id,
                }
            );
            return buildResponse(res, 404, "Unit not found");
        }

        // Deactivate unit by setting is_active to false
        await OrganizationalUnitService.updateUnit(req.params.id, { is_active: false }, userFromMiddleware.role);

        // Set audit context for success
        req.auditContext = createAuditContext(
            "DEACTIVATE_ADMIN_UNIT",
            "SUCCESS",
            `Unit ${unitBefore.name} deactivated successfully`,
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

// Add/update these functions in organization.controller.js

/* ===== Get Unit Members ===== */
export const getUnitMembers = async (req, res, next) => {
    try {
        const { unitId } = req.params;
        const { page, limit, role, include_inactive } = req.query;

        // Authorization check
        const isAuthorized = await handleMemberAuthorization(req, unitId);
        if (!isAuthorized) {
            return buildResponse(res, 403, "Not authorized to view members of this unit");
        }

        const members = await OrganizationalUnitMemberService.getUnitMembers(unitId, {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 50,
            role,
            is_active: include_inactive === 'true' ? undefined : true
        });

        return buildResponse(res, 200, "Unit members retrieved successfully", members);
    } catch (error) {
        next(error);
    }
};

/* ===== Add Unit Member ===== */
export const addUnitMember = async (req, res, next) => {
    try {
        const { unitId } = req.params;
        const { user, role, title, responsibilities, start_date } = req.body;
        const userFromMiddleware = req.user;

        // Authorization check
        const isAuthorized = await handleHeadAuthorization(req, unitId);
        if (!isAuthorized) {
            return buildResponse(res, 403, "Not authorized to add members to this unit");
        }

        // Validate required fields
        if (!user || !role) {
            return buildResponse(res, 400, "User ID and role are required");
        }

        const member = await OrganizationalUnitMemberService.addMember(unitId, {
            user: user._id || user,
            role,
            title,
            responsibilities,
            start_date
        });

        req.auditContext = createAuditContext(
            "ADD_UNIT_MEMBER",
            "SUCCESS",
            `Member added to unit successfully`,
            {
                unitId,
                memberId: member._id,
                userId: member.user._id,
                memberRole: role,
                performedBy: userFromMiddleware.role,
                performedByUserId: userFromMiddleware._id,
            }
        );

        return buildResponse(res, 201, "Member added successfully", member);
    } catch (error) {
        req.auditContext = createAuditContext(
            "ADD_UNIT_MEMBER",
            "FAILURE",
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
        const { role, title, responsibilities, is_active, end_date } = req.body;
        const userFromMiddleware = req.user;

        // Get member to check unit
        const member = await OrganizationalUnitMemberService.getMemberById(memberId);
        if (!member) {
            return buildResponse(res, 404, "Member not found");
        }

        // Authorization check
        const isAuthorized = await handleHeadAuthorization(req, member.unit._id);
        if (!isAuthorized) {
            return buildResponse(res, 403, "Not authorized to update members of this unit");
        }

        const updatedMember = await OrganizationalUnitMemberService.updateMember(memberId, {
            role,
            title,
            responsibilities,
            is_active,
            end_date
        });

        req.auditContext = createAuditContext(
            "UPDATE_UNIT_MEMBER",
            "SUCCESS",
            `Member updated successfully`,
            {
                unitId: member.unit._id,
                memberId,
                userId: member.user._id,
                performedBy: userFromMiddleware.role,
                performedByUserId: userFromMiddleware._id,
            }
        );

        return buildResponse(res, 200, "Member updated successfully", updatedMember);
    } catch (error) {
        req.auditContext = createAuditContext(
            "UPDATE_UNIT_MEMBER",
            "FAILURE",
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

/* ===== Remove Unit Member ===== */
export const removeUnitMember = async (req, res, next) => {
    try {
        const { memberId } = req.params;
        const { reason } = req.body;
        const userFromMiddleware = req.user;

        // Get member to check unit
        const member = await OrganizationalUnitMemberService.getMemberById(memberId);
        if (!member) {
            return buildResponse(res, 404, "Member not found");
        }

        // Authorization check
        const isAuthorized = await handleHeadAuthorization(req, member.unit._id);
        if (!isAuthorized) {
            return buildResponse(res, 403, "Not authorized to remove members from this unit");
        }

        // Cannot remove yourself if you're the only HEAD
        if (member.user._id.toString() === userFromMiddleware._id && member.role === "HEAD") {
            const stats = await OrganizationalUnitMemberService.getMemberStats(member.unit._id);
            if (stats.by_role.HEAD === 1) {
                return buildResponse(res, 400, "Cannot remove the only head of a unit. Assign another head first.");
            }
        }

        const result = await OrganizationalUnitMemberService.removeMember(memberId, reason);

        req.auditContext = createAuditContext(
            "REMOVE_UNIT_MEMBER",
            "SUCCESS",
            `Member removed from unit successfully`,
            {
                unitId: member.unit._id,
                memberId,
                userId: member.user._id,
                memberRole: member.role,
                reason: reason || "No reason provided",
                performedBy: userFromMiddleware.role,
                performedByUserId: userFromMiddleware._id,
            }
        );

        return buildResponse(res, 200, "Member removed successfully", result);
    } catch (error) {
        req.auditContext = createAuditContext(
            "REMOVE_UNIT_MEMBER",
            "FAILURE",
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

/* ===== Get Member Statistics ===== */
export const getMemberStats = async (req, res, next) => {
    try {
        const { unitId } = req.params;

        const stats = await OrganizationalUnitMemberService.getMemberStats(unitId);

        return buildResponse(res, 200, "Member statistics retrieved successfully", stats);
    } catch (error) {
        next(error);
    }
};

/* ===== Get User's Role in Unit ===== */
export const getUserUnitRole = async (req, res, next) => {
    try {
        const { unitId, userId } = req.params;

        const role = await OrganizationalUnitMemberService.getUserRoleInUnit(userId, unitId);

        if (!role) {
            return buildResponse(res, 404, "User is not a member of this unit");
        }

        return buildResponse(res, 200, "User role retrieved successfully", role);
    } catch (error) {
        next(error);
    }
};

/* ===== Bulk Add Members ===== */
export const bulkAddMembers = async (req, res, next) => {
    try {
        const { unitId } = req.params;
        const { members } = req.body;
        const userFromMiddleware = req.user;

        // Authorization check
        const isAuthorized = await handleHeadAuthorization(req, unitId);
        if (!isAuthorized) {
            return buildResponse(res, 403, "Not authorized to add members to this unit");
        }

        if (!members || !Array.isArray(members) || members.length === 0) {
            return buildResponse(res, 400, "Members array is required");
        }

        const results = await OrganizationalUnitMemberService.bulkAddMembers(unitId, members);

        req.auditContext = createAuditContext(
            "ADD_UNIT_MEMBER",
            "SUCCESS",
            `Bulk members added to unit successfully`,
            {
                unitId,
                successfulCount: results.successful.length,
                failedCount: results.failed.length,
                performedBy: userFromMiddleware.role,
                performedByUserId: userFromMiddleware._id,
            }
        );

        return buildResponse(res, 201, "Bulk members added successfully", results);
    } catch (error) {
        next(error);
    }
};

/* ===== Get Unit Hierarchy ===== */
export const getUnitHierarchy = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Get ancestors and descendants
        const [ancestors, descendants] = await Promise.all([
            OrganizationalUnitService.getAncestors(id),
            OrganizationalUnitService.getDescendants(id)
        ]);

        const hierarchy = {
            ancestors: transformToAdminUnitListFormat(ancestors),
            current: await OrganizationalUnitService.getUnitById(id).then(transformToAdminUnitFormat),
            descendants: transformToAdminUnitListFormat(descendants)
        };

        if (!hierarchy.current) {
            return buildResponse(res, 404, "Unit not found");
        }

        console.log(hierarchy)
        return buildResponse(res, 200, "Unit hierarchy retrieved successfully", hierarchy);
    } catch (error) {
        next(error);
    }
};

/* ===== Get Unit Tree ===== */
// controllers/organization.controller.js

/* ===== Get Unit Tree ===== */
export const getUnitTree = async (req, res, next) => {
  try {
    const { id } = req.params; // id is the root unit ID
    const { include_stats } = req.query;
    
    let tree;
    
    if (!id) {
      // Get tree starting from specific root
      if (include_stats === 'true') {
        tree = await OrganizationalUnitService.getFullTreeWithStats(id);
      } else {
        tree = await OrganizationalUnitService.getTreeByRootId(id);
      }
    } else {
      // Get full tree from university level down
      if (include_stats === 'true') {
        tree = await OrganizationalUnitService.getFullTreeWithStats();
      } else {
        tree = await OrganizationalUnitService.getFullTree();
      }
    }
    
    // Transform to include proper nesting for frontend
    const transformNode = (node) => {
      return {
        id: node._id,
        _id: node._id,
        name: node.name,
        code: node.code,
        type: node.type,
        description: node.description,
        parent_unit: node.parent_unit,
        path: node.path,
        depth: node.depth,
        head_user_id: node.head_user_id,
        head_title: node.head_title,
        effective_head_title: node.effective_head_title,
        derived_category: node.derived_category,
        is_active: node.is_active,
        active_member_count: node.active_member_count,
        statistics: node.statistics,
        children: node.children?.map(child => transformNode(child)) || [],
        createdAt: node.createdAt,
        updatedAt: node.updatedAt
      };
    };
    
    const transformedTree = Array.isArray(tree) 
      ? tree.map(node => transformNode(node))
      : transformNode(tree);
    
    return buildResponse(res, 200, "Unit tree retrieved successfully", { 
      tree: transformedTree,
      root_id: id || (Array.isArray(tree) && tree[0]?._id) || tree._id,
      total_nodes: countNodes(transformedTree)
    });
  } catch (error) {
    next(error);
  }
};

// Helper to count nodes in tree
const countNodes = (tree) => {
  if (!tree) return 0;
  if (Array.isArray(tree)) {
    return tree.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
  }
  return 1 + countNodes(tree.children);
};

/* ===== Get Current User's Units ===== */
export const getMyUnits = async (req, res, next) => {
    try {
        // Get units where user is head
        const result = await OrganizationalUnitService.queryUnits({
            head_user_id: req.user._id,
            is_active: true
        });

        const units = result.data.map(unit => ({
            unit: transformToAdminUnitFormat(unit),
            role: "HEAD",
            joined_at: unit.updatedAt
        }));

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

        const result = await OrganizationalUnitService.queryUnits({
            head_user_id: userId,
            is_active: true
        });

        const units = result.data.map(unit => ({
            unit: transformToAdminUnitFormat(unit),
            role: "HEAD",
            joined_at: unit.updatedAt
        }));

        return buildResponse(res, 200, "User units retrieved successfully", { units });
    } catch (error) {
        next(error);
    }
};