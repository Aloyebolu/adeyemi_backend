// domain/department/department.service.js
import Department from './department.model.js';
import { logger } from '#utils/logger.js'; // Adjust based on your logging setup
import lecturerModel from '#domain/user/lecturer/lecturer.model.js';
import User from '#domain/user/user.model.js';
import facultyModel from '#domain/faculty/faculty.model.js';
import studentModel from '#domain/user/student/student.model.js';
import AppError from '#shared/errors/AppError.js';
import userModel from '#domain/user/user.model.js';

class DepartmentService {
  /**
   * Get department by ID with optional population and session
   * @param {string|ObjectId} id - Department ID
   * @param {Object} options - { session, lean, populate }
   * @returns {Promise<Department>}
   */
  async getDepartmentById(id, options = {}) {
    try {
      let query = Department.findById(id);

      if (options.session) {
        query = query.session(options.session);
      }

      if (options.populate) {
        query = query.populate(options.populate);
      }

      if (options.lean) {
        query = query.lean();
      }

      const department = await query;

      if (!department && options.throwIfNotFound !== false) {
        throw new AppError(`Department with id ${id} not found`);
      }

      return department;
    } catch (error) {
      logger.error(`DepartmentService.getDepartmentById failed: ${error.message}`, {
        departmentId: id,
        options,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get department by HOD user ID or by Dean user ID
   * @param {string|ObjectId} hodId - HOD user ID or dean ID
   * @param {Object} options - { session, lean, populate }
   * @returns {Promise<Department>}
   */
  async getDepartmentByHod(hodId, options = {}) {
    try {
      let query = Department.findOne({
        $or: [
          { hod: hodId },
          { dean: hodId }
        ]
      });

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
      logger.error(`DepartmentService.getDepartmentByHod failed: ${error.message}`, {
        hodId,
        options,
        stack: error.stack
      });
      throw error;
    }
  }


  /**
   * Get departments by faculty ID
   * @param {string|ObjectId} facultyId - Faculty ID
   * @param {Object} options - { session, lean, populate }
   * @returns {Promise<Department[]>}
   */
  async getDepartmentsByFaculty(facultyId, options = {}) {
    try {
      let query = Department.find({ faculty: facultyId });

      if (options.session) {
        query = query.session(options.session);
      }

      if (options.populate) {
        query = query.populate(options.populate);
      }

      if (options.lean) {
        query = query.lean();
      }

      if (options.sort) {
        query = query.sort(options.sort);
      }

      return await query;
    } catch (error) {
      logger.error(`DepartmentService.getDepartmentsByFaculty failed: ${error.message}`, {
        facultyId,
        options,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Check if department exists (lightweight)
   * @param {string|ObjectId} id - Department ID
   * @returns {Promise<boolean>}
   */
  async departmentExists(id) {
    try {
      const count = await Department.countDocuments({ _id: id });
      return count > 0;
    } catch (error) {
      logger.error(`DepartmentService.departmentExists failed: ${error.message}`, {
        departmentId: id,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get department IDs by faculty (for counting/aggregation)
   * @param {string|ObjectId} facultyId - Faculty ID
   * @returns {Promise<ObjectId[]>}
   */
  async getDepartmentIdsByFaculty(facultyId, options = {}) {
    try {
      const departmentIds = await Department.find({ faculty: facultyId }).distinct('_id');

      // Log migration if context provided
      if (options._migrationContext) {
        logger.migration(
          `Department.find({ faculty: ${facultyId} }).distinct('_id')`,
          `DepartmentService.getDepartmentIdsByFaculty(${facultyId})`,
          options._migrationContext.file,
          { facultyId, count: departmentIds.length }
        );
      }

      return departmentIds;
    } catch (error) {
      logger.error(`DepartmentService.getDepartmentIdsByFaculty failed: ${error.message}`, {
        facultyId,
        stack: error.stack,
        options
      });
      throw error;
    }
  }

  /**
   * Get department by name
   * @param {string} name - Department name
   * @param {Object} options - { session, lean, populate }
   * @returns {Promise<Department>}
   */
  async getDepartmentByName(name, options = {}) {
    try {
      let query = Department.findOne({ name });

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
      logger.error(`DepartmentService.getDepartmentByName failed: ${error.message}`, {
        name,
        options,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get user's department
   * @param {string|ObjectId} userId - User ID
   * @param {Object} session - Optional mongoose session
   * @returns {Promise<Department|null>}
   */
  async getUserDepartment(userId, session = null) {
    try {
      const user = await User.findById(userId).session(session);
      if (!user) {
        return null;
      }
      if (user.role === 'lecturer' || user.role === 'hod' || user.role === 'ta' || user.role === 'instructor') {
        const lecturer = await lecturerModel.findById(userId).session(session);
        if (lecturer && lecturer.departmentId) {
          return await Department.findById(lecturer.departmentId).session(session);
        }
      } else if (user.role == "student") {
        const student = await studentModel.findById(userId).session(session);
        if (student && student.departmentId) {
          return await Department.findById(student.departmentId).session(session);
        }
      } else {
        console.warn(`User with ID "${userId}" has no associated department.`);
        return null;
      }
    } catch (error) {
      logger.error(`DepartmentService.getUserDepartment failed: ${error.message}`, {
        userId,
        stack: error.stack
      });
      throw error;
    }
  }
  /**
   * Check if a dean has access to a department
   * @param {string} deanUserId 
   * @param {string} departmentId 
   * @returns {boolean}
   */
  async checkDeanDepartmentAccess(deanUserId, departmentId) {
    try {
      const faculty = await facultyModel.findOne({ dean: deanUserId });
      if (!faculty) return false;

      const department = await Department.findOne({
        _id: departmentId,
        faculty: faculty._id
      });

      return !!department;
    } catch (error) {
      logger.error("Error checking dean department access:", error);
      return false;
    }
  }

  /**
   * Validate department data
   */
  validateDepartmentData(name, code) {
    if (!name || !code) {
      throw new AppError("Department name and code are required");
    }
  }

  /**
   * Check for duplicate department
   */
  async checkDuplicateDepartment(name, code, excludeId = null) {
    try {
      const query = { $or: [{ name }, { code }] };
      if (excludeId) {
        query._id = { $ne: excludeId };
      }

      const existing = await Department.findOne(query);

      if (existing) {
        if (existing.name === name) {
          throw new AppError("Department with this name already exists");
        }
        if (existing.code === code) {
          throw new AppError("Department with this code already exists");
        }
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * Assign HOD to department
   */
  async assignHOD(departmentId, lecturerId, session = null) {
    try {
      const options = session ? { session } : {};

      const [department, lecturer] = await Promise.all([
        Department.findById(departmentId).session(session),
        lecturerModel.findById(lecturerId).session(session)
      ]);

      if (!department) throw new AppError("Department not found");
      if (!lecturer) throw new AppError("Lecturer not found");

      // Validate lecturer belongs to department
      if (!lecturer.departmentId || lecturer.departmentId.toString() !== departmentId) {
        throw new AppError("Lecturer must belong to department before becoming HOD");
      }

      // Check if department already has HOD
      if (department.hod) {
        if (department.hod.toString() === lecturerId) {
          throw new AppError("Lecturer is already HOD of this department");
        }
        throw new AppError(`Department "${department.name}" already has an HOD`);
      }

      // Check if lecturer is dean
      const facultyWhereDean = await facultyModel.findOne({ dean: lecturerId }).session(session);
      if (facultyWhereDean) {
        throw new AppError(`Lecturer is assigned as dean of the faculty of "${facultyWhereDean.name}"`);
      }

      // Check user role
      const user = await User.findById(lecturer._id).session(session);
      if (user && user.role === "dean") {
        throw new AppError("Cannot assign a dean as HOD");
      }

      // Update records
      const oldHodId = department.hod;
      department.hod = lecturer._id;
      lecturer.isHOD = true;

      if (user) {
        await userModel.updateOne(
          { _id: user._id },
          {
            $set: {
              department: departmentId
            },
            $addToSet: {
              extra_roles: "hod"
            }
          },
          { session }
        );
      }

      await department.save({ session });
      await lecturer.save({ session });

      return {
        department,
        lecturer,
        user,
        oldHodId,
        oldLecturerData: lecturer.toObject?.(),
        oldUserData: user?.toObject?.()
      };
    } catch (error) {
      throw error
    }
  }

  /**
   * Remove HOD from department
   */
  async removeHOD(departmentId, session = null) {
    try {
      const options = session ? { session } : {};

      const department = await Department.findById(departmentId).session(session);
      if (!department) throw new AppError("Department not found");

      if (!department.hod) throw new AppError("No HOD assigned to remove");

      let lecturer = null;
      let user = null;
      const removedHodId = department.hod;

      // Try to find lecturer
      lecturer = await lecturerModel.findById(department.hod).session(session);
      if (lecturer) {
        lecturer.isHOD = false;
        await lecturer.save({ session });

        user = await User.findById(lecturer._id).session(session);
        if (user) {
          user.role = "lecturer";
          await user.save({ session });
        }
      } else {
        // Check if it's a direct user assignment
        user = await User.findById(department.hod).session(session);
        if (user) {
          user.role = "lecturer";
          await user.save({ session });
        }
      }

      department.hod = null;
      await department.save({ session });

      return {
        department,
        lecturer,
        user,
        removedHodId,
        oldLecturerData: lecturer?.toObject?.(),
        oldUserData: user?.toObject?.()
      };
    } catch (error) {
      throw error
    }
  }

  /**
   * Create new department
   */
  async createDepartment(name, code, facultyId = null) {
    await this.validateDepartmentData(name, code);
    await this.checkDuplicateDepartment(name, code);

    return await Department.create({
      name,
      code,
      faculty: facultyId || null,
    });
  }

  /**
   * Update department
   */
  async updateDepartment(departmentId, updateData, userRole) {
    try {

      const department = await Department.findById(departmentId);
      if (!department) throw new AppError("Department not found");

      const { name, code, faculty } = updateData;

      // Check duplicates (excluding current department)
      if (name || code) {
        await this.checkDuplicateDepartment(
          name || department.name,
          code || department.code,
          departmentId
        );
      }

      // Deans cannot change faculty assignment
      if (faculty && userRole === 'dean') {
        throw new AppError("Deans cannot change faculty assignment");
      }

      if (name) department.name = name;
      if (code) department.code = code;
      if (faculty && userRole === 'admin') department.faculty = faculty;

      await department.save();
      return department;
    } catch (error) {
      throw error
    }
  }

  /**
   * Delete department
   */
  async deleteDepartment(departmentId) {
    try {
      const department = await Department.findById(departmentId);
      if (!department) throw new AppError("Department not found");

      if (department.hod) {
        throw new AppError("Cannot delete department with an assigned HOD");
      }

      const lecturers = await User.find({ department: departmentId });
      if (lecturers.length > 0) {
        throw new AppError("Cannot delete department with assigned lecturers");
      }

      await Department.findByIdAndDelete(departmentId);
    } catch (error) {
      throw error
    }

  }

  /**
   * Get department with populated data
   */
  async getDepartmentById(departmentId) {
    try {
      const department = await Department.findById(departmentId)
        .populate("faculty", "name")
        .populate("hod", "name email");

      if (!department) {
        throw new AppError("Department not found");
      }

      return department;
    } catch (error) {
      throw error
    }

  }

  /**
   * @param {Array} filter Filter based count
   * @returns {Promise<Number>}
   */

  async getDepartmentsCount(filter = {}) {
    try {
      const count = Department.countDocuments(filter)
      return count
    } catch (error) {
      throw error
    }
  }


  /**
 * Check if a user is HOD of a department (single source of truth from department)
 * @param {string|ObjectId} userId - User ID to check
 * @param {Object} options - { session, departmentId (optional) }
 * @returns {Promise<{isHod: boolean, department: Department|null, hodDepartmentId: string|null}>}
 */
  async isHod(userId, options = {}) {
    try {
      let query = Department.findOne({ hod: userId });

      if (options.session) {
        query = query.session(options.session);
      }

      if (options.populate) {
        query = query.populate(options.populate);
      }

      const department = await query;

      if (!department) {
        return {
          isHod: false,
          department: null,
          hodDepartmentId: null
        };
      }

      return {
        isHod: true,
        department: department,
        hodDepartmentId: department._id.toString()
      };
    } catch (error) {
      logger.error(`DepartmentService.isHod failed: ${error.message}`, {
        userId,
        options,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Check if user is HOD for a specific department
   * @param {string|ObjectId} userId - User ID
   * @param {string|ObjectId} departmentId - Department ID to check against
   * @param {Object} session - Optional mongoose session
   * @returns {Promise<boolean>}
   */
  async isHodOfDepartment(userId, departmentId, session = null) {
    try {
      const department = await this.getDepartmentById(departmentId, { session });

      if (!department) {
        return false;
      }

      return department.hod && department.hod.toString() === userId.toString();
    } catch (error) {
      logger.error(`DepartmentService.isHodOfDepartment failed: ${error.message}`, {
        userId,
        departmentId,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Get HOD of a department
   * @param {string|ObjectId} departmentId - Department ID
   * @param {Object} options - { session, populate }
   * @returns {Promise<{hod: Object|null, department: Department|null}>}
   */
  async getDepartmentHod(departmentId, options = {}) {
    try {
      const department = await this.getDepartmentById(departmentId, {
        session: options.session,
        populate: options.populate ? 'hod' : undefined,
        lean: options.lean
      });

      if (!department) {
        return {
          hod: null,
          department: null
        };
      }

      return {
        hod: department.hod,
        department: department
      };
    } catch (error) {
      logger.error(`DepartmentService.getDepartmentHod failed: ${error.message}`, {
        departmentId,
        options,
        stack: error.stack
      });
      throw error;
    }
  }


  /**
   * Create audit context for department operations
   */
  createAuditContext(action, status, reason, metadata = {}, changes,) {
    let severity = "MEDIUM";
    if (status === "ERROR") severity = "CRITICAL";
    if (status === "FAILURE" && reason.includes("Unauthorized")) severity = "HIGH";

    return {
      action,
      resource: "Department",
      severity,
      entityId: metadata.departmentId || null,
      status,
      reason,
      changes,
      metadata: {
        performedBy: metadata.performedBy,
        performedByUserId: metadata.performedByUserId,
        ...metadata
      }
    };
  }
}

// Export singleton instance
export default new DepartmentService();