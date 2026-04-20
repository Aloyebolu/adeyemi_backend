// domain/organization/organizationalUnit.service.js
// EXTENSION: Adding department-specific methods to the existing service
// MERGE THIS with the existing OrganizationalUnitService

import mongoose from "mongoose";
import User from "#domain/user/user.model.js";
import studentModel from "#domain/user/student/student.model.js";
import { logger } from "#utils/logger.js";
import AppError from "#shared/errors/AppError.js";
import OrganizationalUnit from "#domain/organization/models/organizationalUnit.model.js";
import { DB } from "#config/db-contract.js";

/**
 * 🏛️ ORGANIZATIONAL UNIT SERVICE (EXTENDED)
 * ------------------------------------------
 * Now includes all department-specific functionality
 * Works with unified OrganizationalUnit model
 */
class OrganizationalUnitService {
  
  // ==================== EXISTING METHODS (from previous implementation) ====================
  // ... (keep all the existing methods: createUnit, updateUnit, deactivateUnit, etc.)
  
  // ==================== DEPARTMENT-SPECIFIC METHODS ====================
  
  /**
   * Get department by ID (compatibility wrapper)
   * @param {string|ObjectId} id - Department ID
   * @param {Object} options - { session, lean, populate }
   * @returns {Promise<OrganizationalUnit>}
   */
  async getDepartmentById(id, options = {}) {
    try {
      let query = OrganizationalUnit.findOne({ 
        _id: id, 
        type: "department" 
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

      const department = await query;

      if (!department && options.throwIfNotFound !== false) {
        throw new AppError(`Department with id ${id} not found`, 404);
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
   * Get unit by HOD or Dean (unified leadership query)
   * @param {string|ObjectId} leaderId - User ID (HOD or Dean)
   * @param {Object} options - { session, lean, populate }
   * @returns {Promise<OrganizationalUnit|null>}
   */
  async getUnitByLeader(leaderId, options = {}) {
    try {
      let query = OrganizationalUnit.findOne({
        head_user_id: leaderId,
        is_active: true
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
      logger.error(`OrganizationalUnitService.getUnitByLeader failed: ${error.message}`, {
        leaderId,
        options,
        stack: error.stack
      });
      throw error;
    }
  }

  // Backward compatibility alias
  async getDepartmentByHod(hodId, options = {}) {
    return this.getUnitByLeader(hodId, options);
  }

  /**
   * Get user's primary department
   * 🔄 UPDATED: Uses Student.programme_id -> Programme.department_id chain
   * @param {string|ObjectId} userId - User ID
   * @param {Object} session - Optional mongoose session
   * @returns {Promise<OrganizationalUnit|null>}
   */
  async getUserDepartment(userId, session = null) {
    try {
      const user = await User.findById(userId).session(session).lean();
      if (!user) return null;

      // Handle different user types
      const academicRoles = ['lecturer', 'hod', 'dean', 'instructor', 'ta'];
      const isAcademic = academicRoles.some(role => 
        user.role === role || user.extra_roles?.includes(role)
      );

      if (isAcademic) {
        // 🔄 NEW: Query EmployeeProfile (formerly lecturerModel)
        // NOTE: This requires the new EmployeeProfile model
        const EmployeeProfile = mongoose.model('EmployeeProfile');
        const employee = await EmployeeProfile.findById(userId).session(session).lean();
        
        if (employee?.department_id) {
          return await OrganizationalUnit.findOne({
            _id: employee.department_id,
            type: "department",
            is_active: true
          }).session(session).lean();
        }
      } else if (user.role === "student") {
        // 🔄 NEW: Student department comes from Programme
        const student = await studentModel.findById(userId).session(session).lean();
        if (student?.programmeId) {
          const Programme = mongoose.model('Programme');
          const programme = await Programme.findById(student.programmeId)
            .select('department_id')
            .session(session)
            .lean();
          
          if (programme?.department_id) {
            return await OrganizationalUnit.findOne({
              _id: programme.department_id,
              type: "department",
              is_active: true
            }).session(session).lean();
          }
        }
      } else {
        logger.warn(`User "${userId}" has no associated department`);
        return null;
      }
      
      return null;
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
   * 🔄 UPDATED: Uses OrganizationalUnit hierarchy
   * @param {string} deanUserId 
   * @param {string} departmentId 
   * @returns {Promise<boolean>}
   */
  async checkDeanDepartmentAccess(deanUserId, departmentId) {
    try {
      // Find faculty where user is dean
      const faculty = await OrganizationalUnit.findOne({
        head_user_id: deanUserId,
        type: "faculty",
        is_active: true
      }).lean();

      if (!faculty) return false;

      // Check if department belongs to this faculty
      const department = await OrganizationalUnit.findOne({
        _id: departmentId,
        type: "department",
        parent_unit: faculty._id,
        is_active: true
      }).lean();

      return !!department;
    } catch (error) {
      logger.error("Error checking dean department access:", error);
      return false;
    }
  }

  /**
   * Validate department/unit data
   */
  validateUnitData(name, code) {
    if (!name || !code) {
      throw new AppError("Unit name and code are required", 400);
    }
    
    // Code format validation
    const codeRegex = /^[A-Z0-9]{2,10}$/;
    if (!codeRegex.test(code)) {
      throw new AppError("Code must be 2-10 uppercase letters/numbers", 400);
    }
  }

  /**
   * Check for duplicate department/unit
   */
  async checkDuplicateUnit(name, code, excludeId = null) {
    try {
      const query = {
        $or: [
          { name: { $regex: new RegExp(`^${name}$`, 'i') } },
          { code: code.toUpperCase() }
        ]
      };
      
      if (excludeId) {
        query._id = { $ne: excludeId };
      }

      const existing = await OrganizationalUnit.findOne(query).lean();

      if (existing) {
        if (existing.name.toLowerCase() === name.toLowerCase()) {
          throw new AppError("Unit with this name already exists", 409);
        }
        if (existing.code === code.toUpperCase()) {
          throw new AppError("Unit with this code already exists", 409);
        }
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Duplicate check failed: ${error.message}`, 500);
    }
  }

  /**
   * Assign HOD to department
   * 🔄 UPDATED: Uses OrganizationalUnit.head_user_id
   * @param {string} departmentId 
   * @param {string} lecturerId 
   * @param {Object} session 
   * @returns {Promise<Object>}
   */
  async assignHOD(departmentId, lecturerId, session = null) {
    const dbSession = session || await mongoose.startSession();
    const isExternalSession = !!session;
    
    if (!isExternalSession) {
      dbSession.startTransaction();
    }

    try {
      // Get department
      const department = await OrganizationalUnit.findOne({
        _id: departmentId,
        type: "department"
      }).session(dbSession);

      if (!department) {
        throw new AppError("Department not found", 404);
      }

      // Get lecturer user
      const lecturer = await User.findById(lecturerId).session(dbSession);
      if (!lecturer) {
        throw new AppError("Lecturer not found", 404);
      }

      // 🔄 NEW: Check if lecturer belongs to department via EmployeeProfile
      const EmployeeProfile = mongoose.model('EmployeeProfile');
      const employeeProfile = await EmployeeProfile.findById(lecturerId).session(dbSession);
      
      if (!employeeProfile) {
        throw new AppError("Lecturer profile not found", 404);
      }

      if (!employeeProfile.department_id || 
          employeeProfile.department_id.toString() !== departmentId) {
        throw new AppError("Lecturer must belong to department before becoming HOD", 400);
      }

      // Check if department already has HOD
      if (department.head_user_id) {
        if (department.head_user_id.toString() === lecturerId) {
          throw new AppError("Lecturer is already HOD of this department", 400);
        }
        throw new AppError(`Department "${department.name}" already has an HOD`, 409);
      }

      // Check if lecturer is already a dean elsewhere
      const existingLeadership = await OrganizationalUnit.findOne({
        head_user_id: lecturerId,
        is_active: true
      }).session(dbSession);

      if (existingLeadership) {
        throw new AppError(
          `Lecturer is already ${existingLeadership.effective_head_title} of "${existingLeadership.name}"`,
          409
        );
      }

      // Store old state for audit
      const oldHodId = department.head_user_id;

      // Update department
      department.head_user_id = lecturerId;
      department.head_title_override = null; // Use default "Head of Department"
      await department.save({ session: dbSession });

      // 🔄 NEW: Update user's extra_roles (role system)
      await User.updateOne(
        { _id: lecturerId },
        { 
          $addToSet: { extra_roles: "hod" },
          $set: { 
            [`role_assignments.department_${departmentId}`]: "hod"
          }
        },
        { session: dbSession }
      );

      if (!isExternalSession) {
        await dbSession.commitTransaction();
      }

      return {
        department,
        lecturer,
        oldHodId,
        success: true
      };
    } catch (error) {
      if (!isExternalSession) {
        await dbSession.abortTransaction();
      }
      logger.error(`assignHOD failed: ${error.message}`, {
        departmentId,
        lecturerId,
        stack: error.stack
      });
      throw error;
    } finally {
      if (!isExternalSession) {
        dbSession.endSession();
      }
    }
  }

  /**
   * Remove HOD from department
   * @param {string} departmentId 
   * @param {Object} session 
   * @returns {Promise<Object>}
   */
  async removeHOD(departmentId, session = null) {
    const dbSession = session || await mongoose.startSession();
    const isExternalSession = !!session;
    
    if (!isExternalSession) {
      dbSession.startTransaction();
    }

    try {
      const department = await OrganizationalUnit.findOne({
        _id: departmentId,
        type: "department"
      }).session(dbSession);

      if (!department) {
        throw new AppError("Department not found", 404);
      }

      if (!department.head_user_id) {
        throw new AppError("No HOD assigned to remove", 400);
      }

      const removedHodId = department.head_user_id;

      // Update department
      department.head_user_id = null;
      department.head_title_override = null;
      await department.save({ session: dbSession });

      // 🔄 NEW: Remove HOD role from user
      await User.updateOne(
        { _id: removedHodId },
        { 
          $pull: { extra_roles: "hod" },
          $unset: { [`role_assignments.department_${departmentId}`]: "" }
        },
        { session: dbSession }
      );

      if (!isExternalSession) {
        await dbSession.commitTransaction();
      }

      return {
        department,
        removedHodId,
        success: true
      };
    } catch (error) {
      if (!isExternalSession) {
        await dbSession.abortTransaction();
      }
      logger.error(`removeHOD failed: ${error.message}`, {
        departmentId,
        stack: error.stack
      });
      throw error;
    } finally {
      if (!isExternalSession) {
        dbSession.endSession();
      }
    }
  }

  /**
   * Create new department (wrapper for createUnit)
   * @param {string} name 
   * @param {string} code 
   * @param {string} facultyId 
   * @param {string} userId 
   * @returns {Promise<OrganizationalUnit>}
   */
  async createDepartment(name, code, facultyId, userId) {
    this.validateUnitData(name, code);
    await this.checkDuplicateUnit(name, code);

    // Verify faculty exists
    if (facultyId) {
      const faculty = await OrganizationalUnit.findOne({
        _id: facultyId,
        type: "faculty"
      }).lean();
      
      if (!faculty) {
        throw new AppError("Parent faculty not found", 404);
      }
    }

    return await this.createUnit({
      name,
      code: code.toUpperCase(),
      type: "department",
      parent_unit: facultyId || null
    }, userId);
  }

  /**
   * Update department
   * @param {string} departmentId 
   * @param {Object} updateData 
   * @param {string} userRole 
   * @returns {Promise<OrganizationalUnit>}
   */
  async updateDepartment(departmentId, updateData, userRole) {
    try {
      const department = await OrganizationalUnit.findOne({
        _id: departmentId,
        type: "department"
      });

      if (!department) {
        throw new AppError("Department not found", 404);
      }

      const { name, code, faculty } = updateData;

      // Check duplicates (excluding current department)
      if (name || code) {
        await this.checkDuplicateUnit(
          name || department.name,
          code || department.code,
          departmentId
        );
      }

      // Deans cannot change faculty assignment
      if (faculty && userRole === 'dean') {
        throw new AppError("Deans cannot change faculty assignment", 403);
      }

      const updates = {};
      if (name) updates.name = name;
      if (code) updates.code = code.toUpperCase();
      if (faculty && userRole === 'admin') {
        // Verify new faculty exists
        const newFaculty = await OrganizationalUnit.findOne({
          _id: faculty,
          type: "faculty"
        }).lean();
        
        if (!newFaculty) {
          throw new AppError("Target faculty not found", 404);
        }
        
        updates.parent_unit = faculty;
      }

      return await this.updateUnit(departmentId, updates, null);
    } catch (error) {
      logger.error(`updateDepartment failed: ${error.message}`, {
        departmentId,
        updateData,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Delete department
   * @param {string} departmentId 
   * @returns {Promise<void>}
   */
  async deleteDepartment(departmentId) {
    try {
      const department = await OrganizationalUnit.findOne({
        _id: departmentId,
        type: "department"
      });

      if (!department) {
        throw new AppError("Department not found", 404);
      }

      if (department.head_user_id) {
        throw new AppError("Cannot delete department with an assigned HOD", 400);
      }

      // Check for active members
      if (department.active_member_count > 0) {
        throw new AppError(
          `Cannot delete department with ${department.active_member_count} active members`,
          400
        );
      }

      // Check for active programmes
      const Programme = mongoose.model('Programme');
      const activeProgrammes = await Programme.countDocuments({
        department_id: departmentId,
        isActive: true
      });

      if (activeProgrammes > 0) {
        throw new AppError(
          `Cannot delete department with ${activeProgrammes} active programmes`,
          400
        );
      }

      // Soft delete (deactivate)
      await this.deactivateUnit(departmentId);
    } catch (error) {
      logger.error(`deleteDepartment failed: ${error.message}`, {
        departmentId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get department with populated data
   * @param {string} departmentId 
   * @returns {Promise<OrganizationalUnit>}
   */
  async getDepartmentWithDetails(departmentId) {
    try {
      const department = await OrganizationalUnit.findOne({
        _id: departmentId,
        type: "department"
      })
        .populate("parent_unit", "name code type")
        .populate("head_user_id", "first_name last_name email")
        .lean();

      if (!department) {
        throw new AppError("Department not found", 404);
      }

      // Get additional stats
      const [programmeCount, studentCount, lecturerCount] = await Promise.all([
        mongoose.model('Programme').countDocuments({ 
          department_id: departmentId, 
          isActive: true 
        }),
        this.#getStudentCount(departmentId),
        this.#getLecturerCount(departmentId)
      ]);

      return {
        ...department,
        stats: {
          programmes: programmeCount,
          students: studentCount,
          lecturers: lecturerCount
        }
      };
    } catch (error) {
      logger.error(`getDepartmentWithDetails failed: ${error.message}`, {
        departmentId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get departments count
   * @param {Object} filter 
   * @returns {Promise<number>}
   */
  async getDepartmentsCount(filter = {}) {
    try {
      return await OrganizationalUnit.countDocuments({
        ...filter,
        type: "department"
      });
    } catch (error) {
      logger.error(`getDepartmentsCount failed: ${error.message}`, { filter });
      throw error;
    }
  }

  /**
   * Check if user is HOD
   * @param {string|ObjectId} userId 
   * @param {Object} options 
   * @returns {Promise<Object>}
   */
  async isHod(userId, options = {}) {
    try {
      let query = OrganizationalUnit.findOne({
        head_user_id: userId,
        type: "department",
        is_active: true
      });

      if (options.session) {
        query = query.session(options.session);
      }

      if (options.populate) {
        query = query.populate(options.populate);
      }

      const department = await query.lean();

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
      logger.error(`isHod failed: ${error.message}`, {
        userId,
        options,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get all departments
   * @param {Object} filters 
   * @returns {Promise<Array>}
   */
  async getAllDepartments(filters = {}) {
    try {
      const query = {
        type: "department",
        ...filters
      };

      return await OrganizationalUnit.find(query)
        .populate("parent_unit", "name code")
        .populate("head_user_id", "first_name last_name email")
        .sort({ name: 1 })
        .lean();
    } catch (error) {
      logger.error(`getAllDepartments failed: ${error.message}`, { filters });
      throw error;
    }
  }

  // ==================== PRIVATE HELPERS ====================
  
  async #getStudentCount(departmentId) {
    try {
      const Programme = mongoose.model('Programme');
      const programmes = await Programme.find({ 
        department_id: departmentId 
      }).select('_id').lean();
      
      const programmeIds = programmes.map(p => p._id);
      
      return await studentModel.countDocuments({
        programmeId: { $in: programmeIds },
        isActive: true,
        deletedAt: null
      });
    } catch {
      return 0;
    }
  }

  async #getLecturerCount(departmentId) {
    try {
      const EmployeeProfile = mongoose.model('EmployeeProfile');
      return await EmployeeProfile.countDocuments({
        department_id: departmentId,
        is_active: true
      });
    } catch {
      return 0;
    }
  }

  // ==================== AUDIT CONTEXT ====================
  
  /**
   * Create audit context for department operations
   */
  createAuditContext(action, status, reason, metadata = {}, changes = null) {
    let severity = "MEDIUM";
    if (status === "ERROR") severity = "CRITICAL";
    if (status === "FAILURE" && reason?.includes("Unauthorized")) severity = "HIGH";

    return {
      action,
      resource: DB.OrganizationalUnit.MODEL,
      severity,
      entityId: metadata.unitId || metadata.departmentId || null,
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

// ==================== BACKWARD COMPATIBILITY WRAPPER ====================
// For existing code that expects the old DepartmentService API

class DepartmentServiceCompatibilityWrapper {
  constructor(unitService) {
    this.unitService = unitService;
  }

  async getDepartmentById(id, options) {
    return this.unitService.getDepartmentById(id, options);
  }

  async getDepartmentByHod(hodId, options) {
    return this.unitService.getDepartmentByHod(hodId, options);
  }

  async getUserDepartment(userId, session) {
    return this.unitService.getUserDepartment(userId, session);
  }

  async checkDeanDepartmentAccess(deanUserId, departmentId) {
    return this.unitService.checkDeanDepartmentAccess(deanUserId, departmentId);
  }

  async assignHOD(departmentId, lecturerId, session) {
    return this.unitService.assignHOD(departmentId, lecturerId, session);
  }

  async removeHOD(departmentId, session) {
    return this.unitService.removeHOD(departmentId, session);
  }

  async createDepartment(name, code, facultyId, userId) {
    return this.unitService.createDepartment(name, code, facultyId, userId);
  }

  async updateDepartment(departmentId, updateData, userRole) {
    return this.unitService.updateDepartment(departmentId, updateData, userRole);
  }

  async deleteDepartment(departmentId) {
    return this.unitService.deleteDepartment(departmentId);
  }

  async getDepartmentsCount(filter) {
    return this.unitService.getDepartmentsCount(filter);
  }

  async isHod(userId, options) {
    return this.unitService.isHod(userId, options);
  }

  createAuditContext(action, status, reason, metadata, changes) {
    return this.unitService.createAuditContext(action, status, reason, metadata, changes);
  }

  // New methods
  async getAllDepartments(filters) {
    return this.unitService.getAllDepartments(filters);
  }

  async getDepartmentWithDetails(departmentId) {
    return this.unitService.getDepartmentWithDetails(departmentId);
  }
}

// Export singleton instance
const unitService = new OrganizationalUnitService();
export const DepartmentService = new DepartmentServiceCompatibilityWrapper(unitService);
export default unitService;