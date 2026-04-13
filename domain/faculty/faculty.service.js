import { logger } from "../../utils/logger.js";
import departmentModel from "../department/department.model.js";
import AppError from "../errors/AppError.js";
import lecturerModel from "../lecturer/lecturer.model.js";
import User from "../user/user.model.js";
import facultyModel from "./faculty.model.js";
// import logger from "../utils/logger.js";

class FacultyService {
  constructor() {
    this.facultyModel = facultyModel;
  }

  async getFacultyByDean(deanId, options = {}) {
    try {
      let query = this.facultyModel.findOne({ dean: deanId });

      if (options.session) {
        query = query.session(options.session);
      }

      if (options.populate) {
        query = query.populate(options.populate);
      }

      if (options.lean) {
        query = query.lean();
      }

      return await query;
    } catch (error) {
      logger.error(`FacultyService.getFacultyByDean failed: ${error.message}`, {
        deanId,
        options,
        stack: error.stack
      });
      throw error;
    }
  }

  async getFacultyByDepartment(departmentId, options = {}) {
    try {
      let query = this.facultyModel.findOne({ department: departmentId });

      if (options.session) {
        query = query.session(options.session);
      }

      if (options.populate) {
        query = query.populate(options.populate);
      }

      if (options.lean) {
        query = query.lean();
      }

      if (options.select) {
        query = query.select(options.select);
      }

      return await query;
    } catch (error) {
      logger.error(`FacultyService.getFacultyByDepartment failed: ${error.message}`, {
        departmentId,
        options,
        stack: error.stack
      });
      throw error;
    }
  }

  // Optional: Add more reusable methods
  async getFacultyById(facultyId, options = {}) {
    try {
      let query = this.facultyModel.findById(facultyId);

      if (options.session) {
        query = query.session(options.session);
      }

      if (options.populate) {
        query = query.populate(options.populate);
      }

      if (options.lean) {
        query = query.lean();
      }

      return await query;
    } catch (error) {
      logger.error(`FacultyService.getFacultyById failed: ${error.message}`, {
        facultyId,
        options,
        stack: error.stack
      });
      throw error;
    }
  }
  /**
   * Check if dean has access to faculty
   */
  async checkDeanFacultyAccess(deanUserId, facultyId) {
    try {
      const faculty = await facultyModel.findOne({
        _id: facultyId,
        dean: deanUserId,
      });
      return !!faculty;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate faculty data
   */
  validateFacultyData(name, code) {
    if (!name || !code) {
      throw new AppError("Name and code are required");
    }
  }

  /**
   * Check for duplicate faculty
   */
  async checkDuplicateFaculty(name, code, excludeId = null) {
    const query = {
      $or: [
        { code: { $regex: new RegExp(`^${code}$`, "i") } },
        { name: { $regex: new RegExp(`^${name}$`, "i") } },
      ],
    };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await facultyModel.findOne(query);

    if (existing) {
      if (existing.code.toLowerCase() === code.toLowerCase()) {
        throw new AppError(`Faculty code '${code}' already exists`);
      }
      if (existing.name.toLowerCase() === name.toLowerCase()) {
        throw new AppError(`Faculty name '${name}' already exists`);
      }
    }
  }

  /**
   * Format faculty code
   */
  formatFacultyCode(code) {
    return code.trim().toUpperCase();
  }

  /**
   * Get dean's faculty
   */
  async getDeanFaculty(deanUserId) {
    return await facultyModel.findOne({ dean: deanUserId });
  }

  /**
   * Create new faculty
   */
  async createFaculty(name, code, createdBy) {
    const formattedCode = this.formatFacultyCode(code);
    await this.validateFacultyData(name, formattedCode);
    await this.checkDuplicateFaculty(name, formattedCode);

    return await facultyModel.create({
      name: name.trim(),
      code: formattedCode,
      createdBy: createdBy,
    });
  }

  /**
   * Update faculty
   */
  async updateFaculty(facultyId, updateData, userRole) {
    const faculty = await facultyModel.findById(facultyId);
    if (!faculty) throw new AppError("Faculty not found");

    // Prepare safe update data based on user role
    const safeUpdateData = { ...updateData };

    // Deans cannot change dean assignment or faculty code
    if (userRole === "dean") {
      delete safeUpdateData.code;
      delete safeUpdateData.dean;
      delete safeUpdateData.createdBy;
    }

    // Check duplicates if updating name or code
    if (safeUpdateData.name || safeUpdateData.code) {
      await this.checkDuplicateFaculty(
        safeUpdateData.name || faculty.name,
        safeUpdateData.code || faculty.code,
        facultyId
      );
    }

    Object.keys(safeUpdateData).forEach((key) => {
      if (safeUpdateData[key] !== undefined) {
        faculty[key] = safeUpdateData[key];
      }
    });

    await faculty.save();
    return faculty;
  }

  /**
   * Delete faculty
   */
  async deleteFaculty(facultyId) {
    const faculty = await facultyModel.findById(facultyId);
    if (!faculty) throw new AppError("Faculty not found");

    // Check if faculty has departments
    const departmentCount = await departmentModel.countDocuments({
      faculty: facultyId,
    });
    if (departmentCount > 0) {
      throw new AppError("Cannot delete faculty with associated departments");
    }

    await facultyModel.findByIdAndDelete(facultyId);
  }

  /**
   * Assign dean to faculty
   */
  async assignDean(facultyId, userId, session = null) {
    const options = session ? { session } : {};

    const [faculty, user] = await Promise.all([
      facultyModel.findById(facultyId).session(session),
      User.findById(userId).session(session),
    ]);

    if (!faculty) throw new AppError("Faculty not found");
    if (!user) throw new AppError("User not found");

    // Ensure user is eligible (lecturer, hod, or current dean)
    if (!["lecturer", "hod", "dean"].includes((user.role || "").toLowerCase())) {
      throw new AppError("Only lecturers or HODs can be assigned as dean");
    }

    // Check if user is already dean of another faculty
    const existingDeanFaculty = await facultyModel.findOne({
      dean: userId,
      _id: { $ne: facultyId },
    }).session(session);
    if (existingDeanFaculty) {
      throw new AppError(
        `This user is already the dean of another faculty of '${existingDeanFaculty.name}'`
      );
    }

    // Check if user is HOD of a department
    const hodDepartment = await departmentModel
      .findOne({ hod: userId })
      .session(session);
    if (hodDepartment) {
      throw new AppError(
        `This user is already the HOD of the department of '${hodDepartment.name}'`
      );
    }

    // Update records
    const oldDeanId = faculty.dean;
    faculty.dean = user._id;
    user.role = "dean";
    user.faculty = facultyId;

    // Update lecturer model if exists
    const lecturer = await lecturerModel
      .findOne({ _id: user._id })
      .session(session);
    if (lecturer) {
      lecturer.isDean = true;
      lecturer.facultyId = facultyId;
      await lecturer.save({ session });
    }

    await faculty.save({ session });
    await user.save({ session });

    return {
      faculty,
      user,
      lecturer,
      oldDeanId,
      oldUserData: user.toObject?.(),
      oldLecturerData: lecturer?.toObject?.(),
    };
  }

  /**
   * Remove dean from faculty
   */
  async removeDean(facultyId, session = null) {
    const faculty = await facultyModel.findById(facultyId).session(session);
    if (!faculty) throw new AppError("Faculty not found");
    if (!faculty.dean) throw new AppError("No dean assigned to this faculty");

    const deanUserId = faculty.dean;
    const deanUser = await User.findById(deanUserId).session(session);
    if (!deanUser) throw new AppError("Dean user not found");

    // Update user role
    deanUser.role = "lecturer";
    // deanUser.faculty = null;
    await deanUser.save({ session });

    // Update lecturer model
    const lecturer = await lecturerModel
      .findOne({ _id: deanUserId })
      .session(session);
    if (lecturer) {
      lecturer.isDean = false;
      // lecturer.facultyId = null;
      await lecturer.save({ session });
    }

    const oldDeanId = faculty.dean;
    faculty.dean = null;
    await faculty.save({ session });

    return {
      faculty,
      user: deanUser,
      lecturer,
      oldDeanId,
      oldUserData: deanUser.toObject?.(),
      oldLecturerData: lecturer?.toObject?.(),
    };
  }

  /**
   * Get faculty with populated data
   */
  async getFacultyById(facultyId) {
    const faculty = await facultyModel.findById(facultyId).populate("dean", "name email");
    if (!faculty) {
      throw new AppError("Faculty not found");
    }
    return faculty;
  }

  /**
   * Create audit context for faculty operations
   */
  createAuditContext(action, status, reason, metadata = {}, changes) {
    let severity = "MEDIUM";
    if (status === "ERROR") severity = "CRITICAL";
    if (status === "FAILURE" && reason.includes("Unauthorized")) severity = "HIGH";
    if (status === "SUCCESS" && action.includes("DELETE")) severity = "HIGH";

    return {
      action,
      resource: "Faculty",
      severity,
      entityId: metadata.facultyId || null,
      status,
      reason,
      changes,
      metadata: {
        performedBy: metadata.performedBy,
        performedByUserId: metadata.performedByUserId,
        ...metadata,
      },
    };
  }
}

// Create and export a singleton instance
export default new FacultyService();