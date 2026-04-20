// domain/organization/organizationalUnit.service.js
// EXTENSION: Adding faculty-specific methods to the existing service
// MERGE THIS with the existing OrganizationalUnitService

import mongoose from "mongoose";
import OrganizationalUnit from "../models/organizationalUnit.model.js";
import User from "#domain/user/user.model.js";
import { logger } from "#utils/logger.js";
import AppError from "#shared/errors/AppError.js";

/**
 * 🏛️ FACULTY SERVICE (Refactored for OrganizationalUnit)
 * ------------------------------------------------------
 * Now uses unified OrganizationalUnit model with type="faculty"
 */
class FacultyService {
  
  // ==================== CORE QUERY METHODS ====================
  
  /**
   * Get faculty by dean (user ID)
   * @param {string|ObjectId} deanId - Dean's user ID
   * @param {Object} options - { session, populate, lean }
   * @returns {Promise<OrganizationalUnit|null>}
   */
  async getFacultyByDean(deanId, options = {}) {
    try {
      let query = OrganizationalUnit.findOne({
        head_user_id: deanId,
        type: "faculty",
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
      logger.error(`FacultyService.getFacultyByDean failed: ${error.message}`, {
        deanId,
        options,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get faculty by department ID
   * @param {string|ObjectId} departmentId - Department ID
   * @param {Object} options - { session, populate, lean, select }
   * @returns {Promise<OrganizationalUnit|null>}
   */
  async getFacultyByDepartment(departmentId, options = {}) {
    try {
      // First get the department to find its parent faculty
      const department = await OrganizationalUnit.findOne({
        _id: departmentId,
        type: "department"
      }).session(options.session || null).lean();

      if (!department || !department.parent_unit) {
        return null;
      }

      let query = OrganizationalUnit.findOne({
        _id: department.parent_unit,
        type: "faculty",
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

  /**
   * Get faculty by ID
   * @param {string|ObjectId} facultyId - Faculty ID
   * @param {Object} options - { session, populate, lean }
   * @returns {Promise<OrganizationalUnit|null>}
   */
  async getFacultyById(facultyId, options = {}) {
    try {
      let query = OrganizationalUnit.findOne({
        _id: facultyId,
        type: "faculty"
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

      const faculty = await query;

      if (!faculty && options.throwIfNotFound !== false) {
        throw new AppError(`Faculty with id ${facultyId} not found`, 404);
      }

      return faculty;
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
   * Get all faculties
   * @param {Object} options - { includeInactive, session, lean }
   * @returns {Promise<Array<OrganizationalUnit>>}
   */
  async getAllFaculties(options = {}) {
    try {
      const query = { type: "faculty" };
      
      if (!options.includeInactive) {
        query.is_active = true;
      }

      let facultyQuery = OrganizationalUnit.find(query);

      if (options.session) {
        facultyQuery = facultyQuery.session(options.session);
      }

      if (options.populate) {
        facultyQuery = facultyQuery.populate(options.populate);
      }

      if (options.lean) {
        facultyQuery = facultyQuery.lean();
      }

      return await facultyQuery.sort({ name: 1 });
    } catch (error) {
      logger.error(`FacultyService.getAllFaculties failed: ${error.message}`, {
        options,
        stack: error.stack
      });
      throw error;
    }
  }

  // ==================== ACCESS CONTROL ====================
  
  /**
   * Check if dean has access to faculty
   * @param {string} deanUserId 
   * @param {string} facultyId 
   * @returns {Promise<boolean>}
   */
  async checkDeanFacultyAccess(deanUserId, facultyId) {
    try {
      const faculty = await OrganizationalUnit.findOne({
        _id: facultyId,
        type: "faculty",
        head_user_id: deanUserId,
        is_active: true
      }).lean();

      return !!faculty;
    } catch (error) {
      logger.error(`FacultyService.checkDeanFacultyAccess failed: ${error.message}`, {
        deanUserId,
        facultyId,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Check if user has dean access to a resource (faculty or department)
   * @param {string} userId - User ID
   * @param {string} resourceId - Faculty or Department ID
   * @param {string} resourceType - 'faculty' or 'department'
   * @param {Object} session - Optional mongoose session
   * @returns {Promise<boolean>}
   */
  async hasDeanAccessToResource(userId, resourceId, resourceType, session = null) {
    try {
      // Find faculty where user is dean
      const deanFaculty = await OrganizationalUnit.findOne({
        head_user_id: userId,
        type: "faculty",
        is_active: true
      }).session(session).lean();

      if (!deanFaculty) {
        return false;
      }

      // If accessing faculty directly
      if (resourceType === 'faculty') {
        return deanFaculty._id.toString() === resourceId.toString();
      }

      // If accessing department, check if it belongs to dean's faculty
      if (resourceType === 'department') {
        const department = await OrganizationalUnit.findOne({
          _id: resourceId,
          type: "department"
        }).session(session).lean();

        if (!department) return false;
        
        return department.parent_unit?.toString() === deanFaculty._id.toString();
      }

      return false;
    } catch (error) {
      logger.error(`FacultyService.hasDeanAccessToResource failed: ${error.message}`, {
        userId,
        resourceId,
        resourceType,
        stack: error.stack
      });
      return false;
    }
  }

  // ==================== VALIDATION METHODS ====================
  
  /**
   * Validate faculty data
   * @param {string} name 
   * @param {string} code 
   */
  validateFacultyData(name, code) {
    if (!name || !code) {
      throw new AppError("Faculty name and code are required", 400);
    }

    if (name.length < 3) {
      throw new AppError("Faculty name must be at least 3 characters", 400);
    }

    const codeRegex = /^[A-Z0-9]{2,10}$/;
    if (!codeRegex.test(code)) {
      throw new AppError("Faculty code must be 2-10 uppercase letters/numbers", 400);
    }
  }

  /**
   * Check for duplicate faculty
   * @param {string} name 
   * @param {string} code 
   * @param {string} excludeId 
   */
  async checkDuplicateFaculty(name, code, excludeId = null) {
    try {
      const query = {
        type: "faculty",
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
          throw new AppError(`Faculty name '${name}' already exists`, 409);
        }
        if (existing.code === code.toUpperCase()) {
          throw new AppError(`Faculty code '${code}' already exists`, 409);
        }
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Duplicate check failed: ${error.message}`, 500);
    }
  }

  /**
   * Format faculty code
   * @param {string} code 
   * @returns {string}
   */
  formatFacultyCode(code) {
    return code.trim().toUpperCase();
  }

  // ==================== DEAN METHODS ====================
  
  /**
   * Get dean's faculty
   * @param {string} deanUserId 
   * @returns {Promise<OrganizationalUnit|null>}
   */
  async getDeanFaculty(deanUserId) {
    return await this.getFacultyByDean(deanUserId);
  }

  /**
   * Check if user is Dean of any faculty
   * @param {string} userId - User ID
   * @param {Object} options - { session, populate, lean }
   * @returns {Promise<{isDean: boolean, faculty: Object|null, deanFacultyId: string|null}>}
   */
  async isDean(userId, options = {}) {
    try {
      const faculty = await this.getFacultyByDean(userId, options);

      if (!faculty) {
        return {
          isDean: false,
          faculty: null,
          deanFacultyId: null
        };
      }

      return {
        isDean: true,
        faculty: faculty,
        deanFacultyId: faculty._id.toString()
      };
    } catch (error) {
      logger.error(`FacultyService.isDean failed: ${error.message}`, {
        userId,
        options,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Check if user is Dean of a specific faculty
   * @param {string} userId - User ID
   * @param {string} facultyId - Faculty ID to check against
   * @param {Object} session - Optional mongoose session
   * @returns {Promise<boolean>}
   */
  async isDeanOfFaculty(userId, facultyId, session = null) {
    try {
      const faculty = await OrganizationalUnit.findOne({
        _id: facultyId,
        type: "faculty"
      }).session(session).select('head_user_id').lean();

      if (!faculty) return false;

      return faculty.head_user_id?.toString() === userId.toString();
    } catch (error) {
      logger.error(`FacultyService.isDeanOfFaculty failed: ${error.message}`, {
        userId,
        facultyId,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Get Dean of a faculty
   * @param {string} facultyId - Faculty ID
   * @param {Object} options - { session, populate, lean }
   * @returns {Promise<{dean: Object|null, faculty: Object|null}>}
   */
  async getFacultyDean(facultyId, options = {}) {
    try {
      let query = OrganizationalUnit.findOne({
        _id: facultyId,
        type: "faculty"
      });

      if (options.session) {
        query = query.session(options.session);
      }

      if (options.populate) {
        query = query.populate('head_user_id');
      }

      if (options.lean) {
        query = query.lean();
      }

      const faculty = await query;

      if (!faculty) {
        return {
          dean: null,
          faculty: null
        };
      }

      return {
        dean: faculty.head_user_id || null,
        faculty: faculty
      };
    } catch (error) {
      logger.error(`FacultyService.getFacultyDean failed: ${error.message}`, {
        facultyId,
        options,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get all faculties where user is Dean (supports multiple faculties)
   * @param {string} userId - User ID
   * @param {Object} options - { session, populate, lean, sort, select }
   * @returns {Promise<Array<OrganizationalUnit>>}
   */
  async getFacultiesWhereDean(userId, options = {}) {
    try {
      let query = OrganizationalUnit.find({
        head_user_id: userId,
        type: "faculty",
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

      if (options.sort) {
        query = query.sort(options.sort);
      } else {
        query = query.sort({ name: 1 });
      }

      if (options.select) {
        query = query.select(options.select);
      }

      return await query;
    } catch (error) {
      logger.error(`FacultyService.getFacultiesWhereDean failed: ${error.message}`, {
        userId,
        options,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get dean's faculty with departments populated
   * @param {string} deanUserId - Dean user ID
   * @param {Object} options - { session, populateDepartments, lean }
   * @returns {Promise<Object|null>}
   */
  async getDeanFacultyWithDepartments(deanUserId, options = {}) {
    try {
      const faculty = await this.getFacultyByDean(deanUserId, {
        session: options.session,
        lean: options.lean
      });

      if (!faculty) return null;

      if (options.populateDepartments) {
        // Get all departments under this faculty
        const departments = await OrganizationalUnit.find({
          parent_unit: faculty._id,
          type: "department",
          is_active: true
        })
          .populate('head_user_id', 'first_name last_name email')
          .select('name code head_user_id')
          .sort({ name: 1 })
          .lean();

        faculty.departments = departments;
      }

      return faculty;
    } catch (error) {
      logger.error(`FacultyService.getDeanFacultyWithDepartments failed: ${error.message}`, {
        deanUserId,
        options,
        stack: error.stack
      });
      throw error;
    }
  }

  // ==================== CRUD OPERATIONS ====================
  
  /**
   * Create new faculty
   * @param {string} name 
   * @param {string} code 
   * @param {string} createdBy - User ID creating the faculty
   * @returns {Promise<OrganizationalUnit>}
   */
  async createFaculty(name, code, createdBy) {
    const formattedCode = this.formatFacultyCode(code);
    
    this.validateFacultyData(name, formattedCode);
    await this.checkDuplicateFaculty(name, formattedCode);

    // Find university root to set as parent
    const universityRoot = await OrganizationalUnit.findOne({
      type: "university",
      is_active: true
    }).lean();

    if (!universityRoot) {
      throw new AppError("University root not found. Please create university root first.", 500);
    }

    return await OrganizationalUnit.create({
      name: name.trim(),
      code: formattedCode,
      type: "faculty",
      parent_unit: universityRoot._id,
      created_by: createdBy,
      is_active: true
    });
  }

  /**
   * Update faculty
   * @param {string} facultyId 
   * @param {Object} updateData 
   * @param {string} userRole - Role of user performing update
   * @returns {Promise<OrganizationalUnit>}
   */
  async updateFaculty(facultyId, updateData, userRole) {
    const faculty = await OrganizationalUnit.findOne({
      _id: facultyId,
      type: "faculty"
    });

    if (!faculty) {
      throw new AppError("Faculty not found", 404);
    }

    // Prepare safe update data based on user role
    const safeUpdateData = { ...updateData };

    // Deans cannot change dean assignment or faculty code
    if (userRole === "dean") {
      delete safeUpdateData.code;
      delete safeUpdateData.head_user_id;
      delete safeUpdateData.created_by;
      delete safeUpdateData.parent_unit;
    }

    // Check duplicates if updating name or code
    if (safeUpdateData.name || safeUpdateData.code) {
      await this.checkDuplicateFaculty(
        safeUpdateData.name || faculty.name,
        safeUpdateData.code || faculty.code,
        facultyId
      );
    }

    // Apply updates
    if (safeUpdateData.name) faculty.name = safeUpdateData.name.trim();
    if (safeUpdateData.code) faculty.code = this.formatFacultyCode(safeUpdateData.code);
    if (safeUpdateData.head_user_id && userRole === 'admin') {
      faculty.head_user_id = safeUpdateData.head_user_id;
    }

    await faculty.save();
    return faculty;
  }

  /**
   * Delete faculty
   * @param {string} facultyId 
   * @returns {Promise<void>}
   */
  async deleteFaculty(facultyId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const faculty = await OrganizationalUnit.findOne({
        _id: facultyId,
        type: "faculty"
      }).session(session);

      if (!faculty) {
        throw new AppError("Faculty not found", 404);
      }

      // Check if faculty has departments
      const departmentCount = await OrganizationalUnit.countDocuments({
        parent_unit: facultyId,
        type: "department",
        is_active: true
      }).session(session);

      if (departmentCount > 0) {
        throw new AppError(
          `Cannot delete faculty with ${departmentCount} active departments`,
          400
        );
      }

      // Check if faculty has active members
      if (faculty.active_member_count > 0) {
        throw new AppError(
          `Cannot delete faculty with ${faculty.active_member_count} active members`,
          400
        );
      }

      // Soft delete (deactivate)
      faculty.is_active = false;
      await faculty.save({ session });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Assign dean to faculty
   * @param {string} facultyId 
   * @param {string} userId 
   * @param {Object} session - Optional mongoose session
   * @returns {Promise<Object>}
   */
  async assignDean(facultyId, userId, session = null) {
    const dbSession = session || await mongoose.startSession();
    const isExternalSession = !!session;

    if (!isExternalSession) {
      dbSession.startTransaction();
    }

    try {
      const [faculty, user] = await Promise.all([
        OrganizationalUnit.findOne({
          _id: facultyId,
          type: "faculty"
        }).session(dbSession),
        User.findById(userId).session(dbSession)
      ]);

      if (!faculty) throw new AppError("Faculty not found", 404);
      if (!user) throw new AppError("User not found", 404);

      // Ensure user is eligible (lecturer, hod, or current dean)
      const eligibleRoles = ['lecturer', 'hod', 'dean', 'professor', 'associate_professor'];
      const userRoleLower = (user.role || '').toLowerCase();
      const hasEligibleRole = eligibleRoles.includes(userRoleLower) ||
        user.extra_roles?.some(r => eligibleRoles.includes(r.toLowerCase()));

      if (!hasEligibleRole) {
        throw new AppError("Only academic staff can be assigned as dean", 400);
      }

      // Check if user is already dean of another faculty
      const existingDeanFaculty = await OrganizationalUnit.findOne({
        head_user_id: userId,
        type: "faculty",
        _id: { $ne: facultyId },
        is_active: true
      }).session(dbSession);

      if (existingDeanFaculty) {
        throw new AppError(
          `User is already dean of '${existingDeanFaculty.name}' faculty`,
          409
        );
      }

      // Check if user is HOD of a department
      const hodDepartment = await OrganizationalUnit.findOne({
        head_user_id: userId,
        type: "department",
        is_active: true
      }).session(dbSession);

      if (hodDepartment) {
        throw new AppError(
          `User is currently HOD of '${hodDepartment.name}' department. Remove HOD assignment first.`,
          409
        );
      }

      const oldDeanId = faculty.head_user_id;

      // Update faculty
      faculty.head_user_id = userId;
      await faculty.save({ session: dbSession });

      // Update user's extra_roles
      await User.updateOne(
        { _id: userId },
        { 
          $addToSet: { extra_roles: "dean" },
          $set: { 
            [`role_assignments.faculty_${facultyId}`]: "dean"
          }
        },
        { session: dbSession }
      );

      // 🔄 NEW: Update EmployeeProfile if exists
      const EmployeeProfile = mongoose.model('EmployeeProfile');
      await EmployeeProfile.updateOne(
        { _id: userId },
        { 
          $set: { 
            is_dean: true,
            dean_faculty_id: facultyId
          }
        },
        { session: dbSession }
      );

      if (!isExternalSession) {
        await dbSession.commitTransaction();
      }

      return {
        faculty,
        user,
        oldDeanId,
        success: true
      };
    } catch (error) {
      if (!isExternalSession) {
        await dbSession.abortTransaction();
      }
      logger.error(`FacultyService.assignDean failed: ${error.message}`, {
        facultyId,
        userId,
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
   * Remove dean from faculty
   * @param {string} facultyId 
   * @param {Object} session - Optional mongoose session
   * @returns {Promise<Object>}
   */
  async removeDean(facultyId, session = null) {
    const dbSession = session || await mongoose.startSession();
    const isExternalSession = !!session;

    if (!isExternalSession) {
      dbSession.startTransaction();
    }

    try {
      const faculty = await OrganizationalUnit.findOne({
        _id: facultyId,
        type: "faculty"
      }).session(dbSession);

      if (!faculty) throw new AppError("Faculty not found", 404);
      if (!faculty.head_user_id) throw new AppError("No dean assigned to this faculty", 400);

      const deanUserId = faculty.head_user_id;
      const oldDeanId = deanUserId;

      // Remove dean from faculty
      faculty.head_user_id = null;
      await faculty.save({ session: dbSession });

      // Update user's extra_roles
      await User.updateOne(
        { _id: deanUserId },
        { 
          $pull: { extra_roles: "dean" },
          $unset: { [`role_assignments.faculty_${facultyId}`]: "" }
        },
        { session: dbSession }
      );

      // 🔄 NEW: Update EmployeeProfile if exists
      const EmployeeProfile = mongoose.model('EmployeeProfile');
      await EmployeeProfile.updateOne(
        { _id: deanUserId },
        { 
          $set: { 
            is_dean: false,
            dean_faculty_id: null
          }
        },
        { session: dbSession }
      );

      if (!isExternalSession) {
        await dbSession.commitTransaction();
      }

      return {
        faculty,
        removedDeanId: oldDeanId,
        success: true
      };
    } catch (error) {
      if (!isExternalSession) {
        await dbSession.abortTransaction();
      }
      logger.error(`FacultyService.removeDean failed: ${error.message}`, {
        facultyId,
        stack: error.stack
      });
      throw error;
    } finally {
      if (!isExternalSession) {
        dbSession.endSession();
      }
    }
  }

  // ==================== FACULTY STATISTICS ====================
  
  /**
   * Get faculty with full details and statistics
   * @param {string} facultyId 
   * @returns {Promise<Object>}
   */
  async getFacultyWithDetails(facultyId) {
    try {
      const faculty = await OrganizationalUnit.findOne({
        _id: facultyId,
        type: "faculty"
      })
        .populate("head_user_id", "first_name last_name email")
        .populate("parent_unit", "name code")
        .lean();

      if (!faculty) {
        throw new AppError("Faculty not found", 404);
      }

      // Get departments under this faculty
      const departments = await OrganizationalUnit.find({
        parent_unit: facultyId,
        type: "department",
        is_active: true
      })
        .populate("head_user_id", "first_name last_name email")
        .select("name code head_user_id")
        .sort({ name: 1 })
        .lean();

      // Get statistics
      const [programmeCount, studentCount, lecturerCount] = await Promise.all([
        this.#getProgrammeCount(facultyId),
        this.#getStudentCount(facultyId),
        this.#getLecturerCount(facultyId)
      ]);

      return {
        ...faculty,
        departments,
        stats: {
          departments: departments.length,
          programmes: programmeCount,
          students: studentCount,
          lecturers: lecturerCount
        }
      };
    } catch (error) {
      logger.error(`FacultyService.getFacultyWithDetails failed: ${error.message}`, {
        facultyId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get faculties count
   * @param {Object} filter 
   * @returns {Promise<number>}
   */
  async getFacultiesCount(filter = {}) {
    try {
      return await OrganizationalUnit.countDocuments({
        ...filter,
        type: "faculty"
      });
    } catch (error) {
      logger.error(`FacultyService.getFacultiesCount failed: ${error.message}`, { filter });
      throw error;
    }
  }

  // ==================== PRIVATE HELPERS ====================
  
  async #getProgrammeCount(facultyId) {
    try {
      // Get all departments under faculty
      const departments = await OrganizationalUnit.find({
        parent_unit: facultyId,
        type: "department"
      }).select('_id').lean();

      const departmentIds = departments.map(d => d._id);
      
      const Programme = mongoose.model('Programme');
      return await Programme.countDocuments({
        department_id: { $in: departmentIds },
        isActive: true
      });
    } catch {
      return 0;
    }
  }

  async #getStudentCount(facultyId) {
    try {
      const departments = await OrganizationalUnit.find({
        parent_unit: facultyId,
        type: "department"
      }).select('_id').lean();

      const departmentIds = departments.map(d => d._id);
      
      const Programme = mongoose.model('Programme');
      const programmes = await Programme.find({
        department_id: { $in: departmentIds }
      }).select('_id').lean();

      const programmeIds = programmes.map(p => p._id);
      
      const Student = mongoose.model('Student');
      return await Student.countDocuments({
        programmeId: { $in: programmeIds },
        isActive: true,
        deletedAt: null
      });
    } catch {
      return 0;
    }
  }

  async #getLecturerCount(facultyId) {
    try {
      const EmployeeProfile = mongoose.model('EmployeeProfile');
      return await EmployeeProfile.countDocuments({
        faculty_id: facultyId,
        is_active: true
      });
    } catch {
      return 0;
    }
  }

  // ==================== AUDIT CONTEXT ====================
  
  /**
   * Create audit context for faculty operations
   * @param {string} action 
   * @param {string} status 
   * @param {string} reason 
   * @param {Object} metadata 
   * @param {Object} changes 
   * @returns {Object}
   */
  createAuditContext(action, status, reason, metadata = {}, changes = null) {
    let severity = "MEDIUM";
    if (status === "ERROR") severity = "CRITICAL";
    if (status === "FAILURE" && reason?.includes("Unauthorized")) severity = "HIGH";
    if (status === "SUCCESS" && action?.includes("DELETE")) severity = "HIGH";
    if (action?.includes("DEAN")) severity = "HIGH";

    return {
      action,
      resource: "OrganizationalUnit:Faculty",
      severity,
      entityId: metadata.facultyId || metadata.unitId || null,
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

// ==================== BACKWARD COMPATIBILITY EXPORT ====================
// Export singleton instance
export default new FacultyService();