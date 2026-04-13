import buildResponse from "../../utils/responseBuilder.js";
import { fetchDataHelper } from "../../utils/fetchDataHelper.js";
import { dataMaps } from "../../config/dataMap.js";
import departmentModel from "../department/department.model.js";
import User from "../user/user.model.js";
import facultyModel from "../faculty/faculty.model.js";
import lecturerModel from "./lecturer.model.js";
import LecturerService from "./lecturer.service.js";
import departmentService from "../department/department.service.js";
import { resolveUserName } from "../../utils/resolveUserName.js";
import AppError from "../errors/AppError.js";
import { sendNotificationCore } from "../notification/notification.controller.js";
import mongoose from "mongoose";
import { logger } from "../../utils/logger.js";

// Common configuration for fetchDataHelper
export const LECTURER_FETCH_CONFIG = {
  configMap: dataMaps.Lecturer,
  autoPopulate: true,
  forceFind: true,
  models: { departmentModel, User, facultyModel },
};

export const LECTURER_POPULATE_CONFIG = [
  { path: "_id", select: "email first_name last_name middle_name title" },
  { path: "departmentId", select: "name" },
  { path: "facultyId", select: "name" },
];

/**
 * 🧑‍🏫 Create Lecturer (Admin only)
 */
export const createLecturer = async (req, res, next) => {
  try {
    const { first_name, last_name, middle_name, email, staff_id: staffId, department_id, rank } = req.body;
    const userFromMiddleware = req.user;

    // Resolve department ID
    const resolvedDepartmentId = await LecturerService.resolveDepartmentId(
      userFromMiddleware,
      department_id
    );

    // Check for HOD without department
    if (userFromMiddleware?.role === "hod" && !resolvedDepartmentId) {
      req.auditContext = LecturerService.createAuditContext(
        "CREATE_LECTURER",
        "FAILURE",
        "Department not found for HOD during lecturer creation/read",
        {
          hodId: userFromMiddleware._id,
          hodName: userFromMiddleware.name,
          attemptedAction: req._intent === "READ" ? "filter_lecturers" : "create_lecturer",
        }
      );

      return buildResponse(res, 404, "Department not found for HOD", null, true);
    }

    // FILTER / SEARCH MODE (READ intent) - NO AUDIT LOGGING FOR READS
    if (req._intent === "READ") {
      const safeFilters = { ...(req.body.filters || {}) };
      const { extras } = req.body || {};

      if (resolvedDepartmentId) safeFilters.departmentId = resolvedDepartmentId;
      if (extras?.lecturerType === "hod") safeFilters.isHOD = true;
      if (extras?.lecturerType === "dean") safeFilters.isDean = true;

      return await fetchDataHelper(req, res, lecturerModel, {
        ...LECTURER_FETCH_CONFIG,
        custom_fields: { first_name: "_id.first_name", last_name: "_id.last_name", middle_name: "_id.middle_name", title: "_id.title", departmentName: 'departmentId.name', facultyName: 'facultyId.name' },
        populate: ["departmentId", "_id", "facultyId"],
        additionalFilters: safeFilters,
      });
    }

    // CREATE intent only below this point
    if (!resolvedDepartmentId) {
      req.auditContext = LecturerService.createAuditContext(
        "CREATE_LECTURER",
        "FAILURE",
        "Department is required to create lecturer",
        {
          attemptedBy: userFromMiddleware.role,
          attemptedUserId: userFromMiddleware._id,
          providedDepartmentId: department_id,
          resolvedDepartmentId,
          lecturerData: { first_name, middle_name, last_name, email, staffId, rank },
        }
      );
      return buildResponse(res, 400, "Department is required to create lecturer", null, true);
    }

    try {
      const result = await LecturerService.createLecturerWithUser(
        { first_name, last_name, middle_name, email, staffId, rank },
        resolvedDepartmentId
      );

      req.auditContext = LecturerService.createAuditContext(
        "CREATE_LECTURER",
        "SUCCESS",
        `Lecturer ${first_name} ${last_name} (${staffId}) created successfully`,
        {
          lecturerId: result.lecturer._id,
          lecturerName: `${first_name} ${last_name}`,
          lecturerStaffId: staffId,
          lecturerEmail: email,
          lecturerRank: rank,
          departmentId: resolvedDepartmentId,
          facultyId: result.faculty?._id,
          userAccountCreated: true,
          defaultPasswordSet: true,
          passwordChangeRequired: true,
          performedBy: userFromMiddleware.role,
          performedByUserId: userFromMiddleware._id,
        }
      );

      // Return created lecturer
      return await getLecturerById({ params: { id: result.lecturer._id } }, res);
    } catch (error) {
      // Handle specific errors
      if (error.message.includes("already exists")) {
        req.auditContext = LecturerService.createAuditContext(
          "CREATE_LECTURER",
          "FAILURE",
          error.message,
          {
            attemptedBy: userFromMiddleware.role,
            attemptedUserId: userFromMiddleware._id,
            duplicateStaffId: staffId,
            duplicateEmail: email,
            lecturerData: { first_name, last_name, middle_name, email, staffId, rank, departmentId: resolvedDepartmentId },
          }
        );
        return buildResponse(res, 400, error.message);
      }

      // Handle rollback case
      req.auditContext = LecturerService.createAuditContext(
        "CREATE_LECTURER",
        "ERROR_ROLLBACK",
        "Lecturer creation failed — user has been removed (rollback)",
        {
          attemptedBy: userFromMiddleware.role,
          attemptedUserId: userFromMiddleware._id,
          lecturerData: { first_name, last_name, middle_name, email, staffId, rank, departmentId: resolvedDepartmentId },
          error: error.message,
          rollbackPerformed: true,
        }
      );

      throw error
    }
  } catch (error) {

    if (req._intent !== "READ") {
      req.auditContext = LecturerService.createAuditContext(
        "CREATE_LECTURER",
        "ERROR",
        "Internal server error during lecturer creation",
        {
          attemptedBy: req.user?.role,
          attemptedUserId: req.user?._id,
          error: error.message,
        }
      );
    }

    next(error)
  }
};

/**
 * 📋 Get All Lecturers (Admin / HOD / Dean)
 */
export const getAllLecturers = async (req, res, next) => {
  try {
    const includeArchived = req.query.archived === "true";
    const additionalFilters = await LecturerService.getAllLecturersWithFilters(req.user);
    return fetchDataHelper(req, res, lecturerModel, {
      ...LECTURER_FETCH_CONFIG,
      populate: ["departmentId", "_id", "facultyId"],
      additionalFilters,
      deletionMode: includeArchived ? "include" : "exclude",
      custom_fields: {
        first_name: '_id.first_name',
        middle_name: '_id.middle_name',
        last_name: '_id.last_name',
      },
      populate: [
      {
        path: "programmeId",
        populate: [
          {
            path: "department",
            select: "name code"
          }
        ]
      }, {
        path: "_id",
      },
    ],
    });
  } catch (error) {
    throw error
  }

};

/**
 * 🔍 Get Lecturer By ID
 */
export const getLecturerById = async (req, res, next) => {
  try {
    return await fetchDataHelper(req, res, lecturerModel, {
      ...LECTURER_FETCH_CONFIG,
      populate: ["departmentId", "_id"],
      additionalFilters: { _id: req.params.id },
    });
  } catch (error) {
    throw error
  }
};

/**
 * ✏️ Update Lecturer
 */
export const updateLecturer = async (req, res, next) => {
  try {
    // Delete every unsafe fields
    delete req.body.rank;

    const lecturerId = req.params.id;
    const userFromMiddleware = req.user;


    // Get lecturer before update for audit logging
    let lecturerBeforeUpdate = null;
    try {
      lecturerBeforeUpdate = await LecturerService.getLecturerById(lecturerId);
    } catch (error) {
      // Lecturer not found - handled below
      throw new AppError("Unable to update Lecturer", 500)
    }

    if (!lecturerBeforeUpdate) {
      req.auditContext = LecturerService.createAuditContext(
        "UPDATE_LECTURER",
        "FAILURE",
        "Lecturer not found for update",
        {
          attemptedBy: userFromMiddleware.role,
          attemptedUserId: userFromMiddleware._id,
          lecturerId,
          updateData: req.body,
        }
      );
      return buildResponse(res, 404, "Lecturer not found");
    }

    const updatedLecturer = await LecturerService.updateLecturer(lecturerId, req.body);

    // Prepare changes for audit log
    const changes = {
      before: {
        lecturer: {
          staffId: lecturerBeforeUpdate.staffId,
          departmentId: lecturerBeforeUpdate.departmentId?._id,
          rank: lecturerBeforeUpdate.rank,
        },
        user: {
          name: resolveUserName(lecturerBeforeUpdate._id, "lecturer.controller"),
          email: lecturerBeforeUpdate._id?.email,
        },
      },
      after: {
        lecturer: {
          staffId: updatedLecturer.staffId,
          departmentId: updatedLecturer.departmentId?._id,
          rank: updatedLecturer.rank,
        },
        user: {
          name: resolveUserName(updatedLecturer._id, "lecturer.controller"),
          email: updatedLecturer._id?.email,
        },
      },
      changedFields: [],
    };

    // Determine which fields changed
    Object.keys(req.body).forEach((field) => {
      if (field in req.body && req.body[field] !== undefined) {
        changes.changedFields.push(field);
      }
    });

    req.auditContext = LecturerService.createAuditContext(
      "UPDATE_LECTURER",
      "SUCCESS",
      `Lecturer ${resolveUserName(updatedLecturer._id, "lecturer.controller")} (${updatedLecturer.staffId}) updated successfully`,
      {
        lecturerId,
        lecturerName: resolveUserName(updatedLecturer._id, "lecturer.controller"),
        lecturerStaffId: updatedLecturer.staffId,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        changes,
        updateSummary: `Updated fields: ${changes.changedFields.join(", ")}`,
      }
    );

    return buildResponse(res, 200, "Lecturer updated successfully", {
      lecturer: updatedLecturer,
      department: updatedLecturer.departmentId?.name || null,
    });
  } catch (error) {
    if (error.message.includes("not found")) {
      req.auditContext = LecturerService.createAuditContext(
        "UPDATE_LECTURER",
        "FAILURE",
        error.message,
        {
          attemptedBy: req.user.role,
          attemptedUserId: req.user._id,
          lecturerId: req.params.id,
          updateData: req.body,
        }
      );
      return buildResponse(res, 404, error.message);
    }

    req.auditContext = LecturerService.createAuditContext(
      "UPDATE_LECTURER",
      "ERROR",
      "Failed to update lecturer due to server error",
      {
        attemptedBy: req.user.role,
        attemptedUserId: req.user._id,
        lecturerId: req.params.id,
        updateData: req.body,
        error: error.message,
      }
    );

    throw error
  }
};

/**
 * 🎓 Update Lecturer Rank (Dedicated)
 */
export const updateLecturerRank = async (req, res, next) => {
  try {
    const lecturerId = req.params.id;
    const { rank: newRank } = req.body;
    const userFromMiddleware = req.user;

    if (!newRank) {
      return buildResponse(res, 400, "New rank is required");
    }

    // 🔍 Get lecturer before update
    let lecturerBeforeUpdate = null;

    lecturerBeforeUpdate = await LecturerService.getLecturerById(lecturerId);

    if (!lecturerBeforeUpdate) {
      req.auditContext = LecturerService.createAuditContext(
        "UPDATE_LECTURER_RANK",
        "FAILURE",
        "Lecturer not found for rank update",
        {
          attemptedBy: userFromMiddleware.role,
          attemptedUserId: userFromMiddleware._id,
          lecturerId,
          newRank,
        }
      );
      return buildResponse(res, 404, "Lecturer not found");
    }

    const oldRank = lecturerBeforeUpdate.rank;

    // 🛑 Prevent unnecessary update
    if (oldRank === newRank) {
      return buildResponse(res, 200, "No change detected in rank", {
        lecturer: lecturerBeforeUpdate,
      });
    }

    //  Update ONLY rank
    const updatedLecturer = await LecturerService.updateLecturer(lecturerId, {
      rank: newRank,
    });

    // 🔔 Trigger notification (plug your system here)
    try {

      await sendNotificationCore({
        userIds: [lecturerBeforeUpdate._id],
        message: `Congratulations🎉 Your rank has been updated from ${oldRank} to ${newRank}`,
      })
    } catch (err) {
      logger.warn("Notification failed:", err.message);
    }

    // 🧾 Audit log
    const changes = {
      before: { rank: oldRank },
      after: { rank: newRank },
      changedFields: ["rank"],
    };

    req.auditContext = LecturerService.createAuditContext(
      "UPDATE_LECTURER_RANK",
      "SUCCESS",
      `Lecturer ${resolveUserName(updatedLecturer._id, "lecturer.controller")} promoted from ${oldRank} to ${newRank}`,
      {
        lecturerId,
        lecturerName: resolveUserName(updatedLecturer._id, "lecturer.controller"),
        lecturerStaffId: updatedLecturer.staffId,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        changes,
        promotionSummary: `${oldRank} → ${newRank}`,
      }
    );

    return buildResponse(res, 200, "Lecturer rank updated successfully", {
      lecturer: updatedLecturer,
      previousRank: oldRank,
      newRank,
    });

  } catch (error) {
    req.auditContext = LecturerService.createAuditContext(
      "UPDATE_LECTURER_RANK",
      "ERROR",
      "Failed to update lecturer rank",
      {
        attemptedBy: req.user?.role,
        attemptedUserId: req.user?._id,
        lecturerId: req.params.id,
        newRank: req.body?.rank,
        error: error.message,
      }
    );
throw error
  }
};

/**
 * 🗑️ Soft Delete Lecturer
 */
export const deleteLecturer = async (req, res, next) => {
  try {
    const lecturerId = req.params.id;
    const userFromMiddleware = req.user;


    // Get lecturer before deletion for audit logging
    let lecturerBeforeDelete = null;
    try {
      lecturerBeforeDelete = await LecturerService.getLecturerById(lecturerId);
    } catch (error) {
      // Lecturer not found - handled below
    }

    if (!lecturerBeforeDelete) {
      req.auditContext = LecturerService.createAuditContext(
        "DELETE_LECTURER",
        "FAILURE",
        "Lecturer not found for deletion",
        {
          attemptedBy: userFromMiddleware.role,
          attemptedUserId: userFromMiddleware._id,
          lecturerId,
        }
      );
      return buildResponse(res, 404, "Lecturer not found");
    }

    await LecturerService.deleteLecturer(lecturerId);

    req.auditContext = LecturerService.createAuditContext(
      "DELETE_LECTURER",
      "SUCCESS",
      `Lecturer ${resolveUserName(lecturerBeforeDelete._id, "lecturer.controller")} (${lecturerBeforeDelete.staffId}) deleted successfully`,
      {
        lecturerId,
        lecturerName: resolveUserName(lecturerBeforeDelete._id, "lecturer.controller"),
        lecturerStaffId: lecturerBeforeDelete.staffId,
        lecturerEmail: lecturerBeforeDelete._id?.email,
        departmentId: lecturerBeforeDelete.departmentId?._id,
        departmentName: lecturerBeforeDelete.departmentId?.name,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        deletionType: "soft_delete",
        userAccountRemoved: true,
      }
    );

    return buildResponse(res, 200, "Lecturer deleted successfully");
  } catch (error) {
    req.auditContext = LecturerService.createAuditContext(
      "DELETE_LECTURER",
      "ERROR",
      "Failed to delete lecturer due to server error",
      {
        attemptedBy: req.user.role,
        attemptedUserId: req.user._id,
        lecturerId: req.params.id,
        error: error.message,
      }
    );

    next(error)
  }
};

/**
 * 🧩 Assign Lecturer as HOD
 */
export const assignHOD = async (req, res, next) => {
  try {
    const { departmentId, lecturerId } = req.params;
    const userFromMiddleware = req.user;

    // Get lecturer and department before assignment for audit logging
    let lecturerBefore = null;
    let departmentBefore = null;
    try {
      lecturerBefore = await LecturerService.getLecturerById(lecturerId);
      const department = await departmentService.getDepartmentById(departmentId);
      departmentBefore = department;
    } catch (error) {
      // Not found - handled by updateHODStatus
    }

    const lecturer = await LecturerService.updateHODStatus(departmentId, lecturerId, true);

    req.auditContext = LecturerService.createAuditContext(
      "ASSIGN_HOD",
      "SUCCESS",
      `Lecturer ${resolveUserName(lecturer._id, "lecturer.controller")} assigned as HOD of ${departmentBefore?.name || "Department"}`,
      {
        lecturerId,
        lecturerName: resolveUserName(lecturer._id, "lecturer.controller"),
        lecturerStaffId: lecturer.staffId,
        departmentId,
        departmentName: departmentBefore?.name || "Unknown",
        previousHOD: departmentBefore?.hod || null,
        newHOD: lecturerId,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        changes: {
          before: {
            isHOD: lecturerBefore?.isHOD || false,
            departmentHOD: departmentBefore?.hod || null,
          },
          after: {
            isHOD: true,
            departmentHOD: lecturerId,
          },
        },
      }
    );

    return buildResponse(res, 200, "Lecturer assigned as HOD successfully", lecturer);
  } catch (error) {

    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("belong") || error.message.includes("not the HOD")
        ? 400
        : 500;

    req.auditContext = LecturerService.createAuditContext(
      "ASSIGN_HOD",
      status === 404 ? "FAILURE" : status === 400 ? "FAILURE" : "ERROR",
      error.message,
      {
        attemptedBy: req.user.role,
        attemptedUserId: req.user._id,
        departmentId: req.params.departmentId,
        lecturerId: req.params.lecturerId,
        error: error.message,
      }
    );

    next(error)
  }
};

/**
 * 🧩 Remove Lecturer as HOD
 */
export const removeHOD = async (req, res, next) => {
  try {
    const { departmentId, lecturerId } = req.params;
    const userFromMiddleware = req.user;

    // Get lecturer and department before removal for audit logging
    let lecturerBefore = null;
    let departmentBefore = null;
    try {
      lecturerBefore = await LecturerService.getLecturerById(lecturerId);
      const department = await departmentService.getDepartmentById(departmentId);
      departmentBefore = department;
    } catch (error) {
      // Not found - handled by updateHODStatus
    }

    const lecturer = await LecturerService.updateHODStatus(departmentId, lecturerId, false);

    req.auditContext = LecturerService.createAuditContext(
      "REMOVE_HOD",
      "SUCCESS",
      `Lecturer ${resolveUserName(lecturer._id, "lecturer.controller")} removed as HOD of ${departmentBefore?.name || "Department"}`,
      {
        lecturerId,
        lecturerName: resolveUserName(lecturer._id, "lecturer.controller"),
        lecturerStaffId: lecturer.staffId,
        departmentId,
        departmentName: departmentBefore?.name || "Unknown",
        previousHOD: lecturerId,
        newHOD: null,
        performedBy: userFromMiddleware.role,
        performedByUserId: userFromMiddleware._id,
        changes: {
          before: {
            isHOD: true,
            departmentHOD: lecturerId,
          },
          after: {
            isHOD: false,
            departmentHOD: null,
          },
        },
      }
    );

    return buildResponse(res, 200, "Lecturer removed from HOD role successfully", lecturer);
  } catch (error) {
    console.error("❌ removeHOD Error:", error);

    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("not the HOD")
        ? 400
        : 500;

    req.auditContext = LecturerService.createAuditContext(
      "REMOVE_HOD",
      status === 404 ? "FAILURE" : status === 400 ? "FAILURE" : "ERROR",
      error.message,
      {
        attemptedBy: req.user.role,
        attemptedUserId: req.user._id,
        departmentId: req.params.departmentId,
        lecturerId: req.params.lecturerId,
        error: error.message,
      }
    );

    next(error)
  }
};

/**
 * 👨‍🏫 Get All Deans
 */
export const getAllDeans = async (req, res, next) => {
  try {
    return fetchDataHelper(req, res, lecturerModel, {
      ...LECTURER_FETCH_CONFIG,
      populate: LECTURER_POPULATE_CONFIG,
      additionalFilters: { isDean: true },
    });
  } catch (error) {
    next(error)
  }

};

/**
 * 👨‍🏫 Get All HODs
 */
export const getAllHODs = async (req, res, next) => {
  try {
    const additionalFilters = { isHOD: true };
    const roleFilters = await LecturerService.getAllLecturersWithFilters(req.user);
    Object.assign(additionalFilters, roleFilters);

    return fetchDataHelper(req, res, lecturerModel, {
      ...LECTURER_FETCH_CONFIG,
      populate: LECTURER_POPULATE_CONFIG,
      additionalFilters,
    });
  } catch (error) {
    next(error)
  }

};
