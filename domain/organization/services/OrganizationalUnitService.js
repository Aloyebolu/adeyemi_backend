// domain/organization/organizationalUnit.service.with-dtos.js
import mongoose from "mongoose";
import OrganizationalUnit from "../models/organizationalUnit.model.js";
import User from "#domain/user/user.model.js";
import { logger } from "#utils/logger.js";
import AppError from "#shared/errors/AppError.js";
import {
  CreateUnitDto,
  UpdateUnitDto,
  UnitResponseDto,
  UnitListResponseDto,
  UnitTreeResponseDto,
  UnitWithStatsResponseDto,
  DepartmentResponseDto,
  FacultyResponseDto,
  UnitQueryDto,
  AssignHeadDto,
  AssignHeadResponseDto,
  PaginatedUnitsResponseDto
} from "../dtos/organizational-unit.dto.js";

/**
 * 🏛️ ORGANIZATIONAL UNIT SERVICE WITH DTOs
 * ------------------------------------------
 * Clean separation between data layer and business logic
 * All inputs/outputs use DTOs
 */
class OrganizationalUnitService {
  
  // ==================== HIERARCHY RULES ====================
  
  #validHierarchyRules = {
    university: ["faculty", "registry", "bursary", "ict", "library", "security", "transport", "health"],
    faculty: ["department"],
    department: [],
    registry: ["student_affairs", "admissions"],
    student_affairs: ["hostel"],
    "*": ["other"]
  };

  #validateParentChildRelationship(parentType, childType) {
    const allowedChildren = this.#validHierarchyRules[parentType] 
                         || this.#validHierarchyRules["*"];
    
    if (!allowedChildren.includes(childType)) {
      throw new AppError(
        `Cannot place ${childType} under ${parentType}. Allowed: ${allowedChildren.join(", ")}`,
        400,
        "INVALID_HIERARCHY"
      );
    }
    return true;
  }

  // ==================== DTO TRANSFORMATION HELPERS ====================

  #toResponseDto(unit, options = {}) {
    if (!unit) return null;
    
    if (options.type === 'department') {
      return new DepartmentResponseDto(unit, options.faculty);
    }
    
    if (options.type === 'faculty') {
      return new FacultyResponseDto(unit, options.departments);
    }
    
    if (options.withStats) {
      return new UnitWithStatsResponseDto(unit, options.stats);
    }
    
    return new UnitResponseDto(unit);
  }

  #toListResponseDto(units) {
    return units.map(unit => new UnitListResponseDto(unit));
  }

  #toTreeResponseDto(units) {
    return units.map(unit => new UnitTreeResponseDto(unit));
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * Create a new organizational unit
   * @param {Object} data - Raw input data
   * @param {string} userId - Creator's user ID
   * @returns {Promise<UnitResponseDto>}
   */
  async createUnit(data, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 1. Create and validate DTO
      const createDto = new CreateUnitDto(data);
      const validationErrors = createDto.validate();
      
      if (validationErrors.length > 0) {
        throw new AppError(validationErrors.join('; '), 400, "VALIDATION_ERROR");
      }
      
      // 2. Validate parent relationship
      if (createDto.parent_unit) {
        const parent = await OrganizationalUnit.findById(createDto.parent_unit)
          .session(session)
          .lean();
          
        if (!parent) {
          throw new AppError("Parent unit not found", 404);
        }
        
        this.#validateParentChildRelationship(parent.type, createDto.type);
      }
      
      // 3. Enforce single university root
      if (createDto.type === "university") {
        const existing = await OrganizationalUnit.findOne({ type: "university" })
          .session(session);
          
        if (existing) {
          throw new AppError("Only one university root can exist", 400, "DUPLICATE_UNIVERSITY");
        }
      }
      
      // 4. Check for duplicate code
      const existingCode = await OrganizationalUnit.findOne({ code: createDto.code })
        .session(session);
        
      if (existingCode) {
        throw new AppError(`Unit with code '${createDto.code}' already exists`, 409, "DUPLICATE_CODE");
      }
      
      // 5. Create unit from DTO
      const modelData = createDto.toModel(userId);
      const [unit] = await OrganizationalUnit.create([modelData], { session });
      
      // 6. Build materialized path
      await this.#updateMaterializedPath(unit._id, unit.parent_unit, session);
      
      await session.commitTransaction();
      
      // 7. Return DTO response
      const createdUnit = await OrganizationalUnit.findById(unit._id).lean();
      return this.#toResponseDto(createdUnit);
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Update organizational unit
   * @param {string} unitId 
   * @param {Object} data - Raw update data
   * @param {string} userRole - Role of user performing update
   * @returns {Promise<UnitResponseDto>}
   */
  async updateUnit(unitId, data, userRole) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const unit = await OrganizationalUnit.findById(unitId).session(session);
      if (!unit) {
        throw new AppError("Unit not found", 404);
      }
      
      // 1. Create and validate DTO
      const updateDto = new UpdateUnitDto(data);
      const validationErrors = updateDto.validate(unit);
      
      if (validationErrors.length > 0) {
        throw new AppError(validationErrors.join('; '), 400, "VALIDATION_ERROR");
      }
      
      // 2. Apply role-based restrictions
      if (userRole === 'dean') {
        if (updateDto.code !== undefined) {
          throw new AppError("Deans cannot change unit codes", 403);
        }
        if (updateDto.head_user_id !== undefined) {
          throw new AppError("Deans cannot reassign leadership", 403);
        }
      }
      
      // 3. Protect university root
      if (unit.type === "university") {
        if (updateDto.parent_unit !== undefined) {
          throw new AppError("University root cannot have a parent", 400, "ROOT_PARENT_FORBIDDEN");
        }
        if (updateDto.type && updateDto.type !== "university") {
          throw new AppError("Cannot change university root type", 400, "ROOT_TYPE_IMMUTABLE");
        }
      }
      
      // 4. Validate parent change
      if (updateDto.parent_unit !== undefined) {
        const newParentId = updateDto.parent_unit;
        
        const wouldCycle = await this.#wouldCreateCycle(unitId, newParentId);
        if (wouldCycle) {
          throw new AppError("Cannot create circular hierarchy", 400, "CIRCULAR_HIERARCHY");
        }
        
        if (newParentId) {
          const parent = await OrganizationalUnit.findById(newParentId).session(session).lean();
          if (!parent) {
            throw new AppError("Parent unit not found", 404);
          }
          
          const targetType = updateDto.type || unit.type;
          this.#validateParentChildRelationship(parent.type, targetType);
        }
      }
      
      // 5. Check for duplicate code if changing
      if (updateDto.code && updateDto.code !== unit.code) {
        const existingCode = await OrganizationalUnit.findOne({
          code: updateDto.code,
          _id: { $ne: unitId }
        }).session(session);
        
        if (existingCode) {
          throw new AppError(`Unit with code '${updateDto.code}' already exists`, 409);
        }
      }
      
      // 6. Apply updates from DTO
      const oldParentId = unit.parent_unit;
      const updates = updateDto.toModelUpdates();
      Object.assign(unit, updates);
      await unit.save({ session });
      
      // 7. Update materialized paths if parent changed
      if (updateDto.parent_unit !== undefined && 
          oldParentId?.toString() !== updateDto.parent_unit?.toString()) {
        await this.#updateMaterializedPath(unitId, updateDto.parent_unit, session);
        await this.#updateDescendantPaths(unitId, session);
      }
      
      await session.commitTransaction();
      
      // 8. Return DTO response
      const updatedUnit = await OrganizationalUnit.findById(unitId).lean();
      return this.#toResponseDto(updatedUnit);
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get unit by ID
   * @param {string} unitId 
   * @param {Object} options 
   * @returns {Promise<UnitResponseDto|null>}
   */
  async getUnitById(unitId, options = {}) {
    try {
      let query = OrganizationalUnit.findById(unitId);
      
      if (options.populate) {
        query = query.populate(options.populate);
      }
      
      const unit = await query.lean();
      
      if (!unit) {
        if (options.throwIfNotFound !== false) {
          throw new AppError("Unit not found", 404);
        }
        return null;
      }
      
      return this.#toResponseDto(unit, {
        type: unit.type,
        withStats: options.withStats
      });
      
    } catch (error) {
      logger.error(`getUnitById failed: ${error.message}`, { unitId, options });
      throw error;
    }
  }

  /**
   * Query units with pagination and filters
   * @param {Object} queryParams 
   * @returns {Promise<PaginatedUnitsResponseDto>}
   */
  async queryUnits(queryParams = {}) {
    try {
      const queryDto = new UnitQueryDto(queryParams);
      const mongoQuery = queryDto.toMongoQuery();
      const { skip, limit } = queryDto.getPagination();
      const sort = queryDto.getSort();
      
      const [units, total] = await Promise.all([
        OrganizationalUnit.find(mongoQuery)
          .populate('head_user_id', 'first_name last_name email')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        OrganizationalUnit.countDocuments(mongoQuery)
      ]);
      
      return new PaginatedUnitsResponseDto(
        units,
        total,
        queryDto.page,
        queryDto.limit
      );
      
    } catch (error) {
      logger.error(`queryUnits failed: ${error.message}`, { queryParams });
      throw error;
    }
  }

  /**
   * Get full tree structure
   * @returns {Promise<Array<UnitTreeResponseDto>>}
   */
  async getFullTree() {
    try {
      const allUnits = await OrganizationalUnit.find({ is_active: true })
        .sort({ depth: 1, name: 1 })
        .lean();
      
      const unitMap = new Map();
      const roots = [];
      
      // Build tree
      allUnits.forEach(unit => {
        unit.children = [];
        unitMap.set(unit._id.toString(), unit);
      });
      
      allUnits.forEach(unit => {
        if (unit.parent_unit) {
          const parent = unitMap.get(unit.parent_unit.toString());
          if (parent) {
            parent.children.push(unit);
          }
        } else {
          roots.push(unit);
        }
      });
      
      return this.#toTreeResponseDto(roots);
      
    } catch (error) {
      logger.error(`getFullTree failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get descendants using materialized path
   * @param {string} unitId 
   * @returns {Promise<Array<UnitListResponseDto>>}
   */
  async getDescendants(unitId) {
    try {
      const unit = await OrganizationalUnit.findById(unitId).select("path").lean();
      if (!unit) {
        throw new AppError("Unit not found", 404);
      }
      
      const descendants = await OrganizationalUnit.find({
        path: new RegExp(`^${unit.path}/`),
        is_active: true
      }).lean();
      
      return this.#toListResponseDto(descendants);
      
    } catch (error) {
      logger.error(`getDescendants failed: ${error.message}`, { unitId });
      throw error;
    }
  }

  /**
   * Get ancestors using materialized path
   * @param {string} unitId 
   * @returns {Promise<Array<UnitListResponseDto>>}
   */
  async getAncestors(unitId) {
    try {
      const unit = await OrganizationalUnit.findById(unitId).select("path").lean();
      if (!unit) {
        throw new AppError("Unit not found", 404);
      }
      
      const ancestorIds = unit.path.split('/')
        .filter(id => id && id !== unitId)
        .map(id => new mongoose.Types.ObjectId(id));
      
      if (ancestorIds.length === 0) return [];
      
      const ancestors = await OrganizationalUnit.find({
        _id: { $in: ancestorIds },
        is_active: true
      }).lean();
      
      return this.#toListResponseDto(ancestors);
      
    } catch (error) {
      logger.error(`getAncestors failed: ${error.message}`, { unitId });
      throw error;
    }
  }

  /**
   * Assign head to unit
   * @param {string} unitId 
   * @param {Object} data 
   * @returns {Promise<AssignHeadResponseDto>}
   */
  async assignHead(unitId, data) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const assignDto = new AssignHeadDto(data);
      const validationErrors = assignDto.validate();
      
      if (validationErrors.length > 0) {
        throw new AppError(validationErrors.join('; '), 400, "VALIDATION_ERROR");
      }
      
      const [unit, user] = await Promise.all([
        OrganizationalUnit.findById(unitId).session(session),
        User.findById(assignDto.user_id).session(session)
      ]);
      
      if (!unit) throw new AppError("Unit not found", 404);
      if (!user) throw new AppError("User not found", 404);
      
      // Check if user is already head of another unit
      const existingLeadership = await OrganizationalUnit.findOne({
        head_user_id: assignDto.user_id,
        _id: { $ne: unitId },
        is_active: true
      }).session(session);
      
      if (existingLeadership) {
        throw new AppError(
          `User is already head of '${existingLeadership.name}'`,
          409,
          "ALREADY_HEAD"
        );
      }
      
      const oldHeadId = unit.head_user_id;
      
      // Update unit
      unit.head_user_id = assignDto.user_id;
      if (assignDto.title_override) {
        unit.head_title_override = assignDto.title_override;
      }
      await unit.save({ session });
      
      // Update user roles
      const roleName = unit.type === 'faculty' ? 'dean' : 
                      unit.type === 'department' ? 'hod' : 'unit_head';
      
      await User.updateOne(
        { _id: assignDto.user_id },
        { 
          $addToSet: { extra_roles: roleName },
          $set: { 
            [`role_assignments.${unit.type}_${unitId}`]: roleName
          }
        },
        { session }
      );
      
      await session.commitTransaction();
      
      return new AssignHeadResponseDto(unit, user, oldHeadId);
      
    } catch (error) {
      await session.abortTransaction();
      logger.error(`assignHead failed: ${error.message}`, { unitId, data });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get department with full details
   * @param {string} departmentId 
   * @returns {Promise<DepartmentResponseDto>}
   */
  async getDepartmentWithDetails(departmentId) {
    try {
      const department = await OrganizationalUnit.findOne({
        _id: departmentId,
        type: "department"
      })
        .populate("head_user_id", "first_name last_name email")
        .lean();
      
      if (!department) {
        throw new AppError("Department not found", 404);
      }
      
      let faculty = null;
      if (department.parent_unit) {
        faculty = await OrganizationalUnit.findById(department.parent_unit)
          .select("name code")
          .lean();
      }
      
      return new DepartmentResponseDto(department, faculty);
      
    } catch (error) {
      logger.error(`getDepartmentWithDetails failed: ${error.message}`, { departmentId });
      throw error;
    }
  }

  /**
   * Get faculty with departments
   * @param {string} facultyId 
   * @returns {Promise<FacultyResponseDto>}
   */
  async getFacultyWithDetails(facultyId) {
    try {
      const faculty = await OrganizationalUnit.findOne({
        _id: facultyId,
        type: "faculty"
      })
        .populate("head_user_id", "first_name last_name email")
        .lean();
      
      if (!faculty) {
        throw new AppError("Faculty not found", 404);
      }
      
      const departments = await OrganizationalUnit.find({
        parent_unit: facultyId,
        type: "department",
        is_active: true
      })
        .populate("head_user_id", "first_name last_name email")
        .sort({ name: 1 })
        .lean();
      
      return new FacultyResponseDto(faculty, departments);
      
    } catch (error) {
      logger.error(`getFacultyWithDetails failed: ${error.message}`, { facultyId });
      throw error;
    }
  }

  // ==================== PRIVATE HELPERS ====================

  async #wouldCreateCycle(unitId, newParentId) {
    if (!newParentId) return false;
    if (unitId && unitId.toString() === newParentId.toString()) return true;
    
    if (unitId) {
      const [unit, parent] = await Promise.all([
        OrganizationalUnit.findById(unitId).select("path").lean(),
        OrganizationalUnit.findById(newParentId).select("path").lean()
      ]);
      
      if (unit && parent) {
        return parent.path.includes(`/${unitId.toString()}/`) ||
               parent.path.endsWith(`/${unitId.toString()}`);
      }
    }
    
    return false;
  }

  async #updateMaterializedPath(unitId, parentId = null, session = null) {
    if (!parentId) {
      await OrganizationalUnit.findByIdAndUpdate(
        unitId,
        { path: `/${unitId.toString()}`, depth: 0 },
        { session }
      );
      return;
    }
    
    const parent = await OrganizationalUnit.findById(parentId)
      .select("path depth")
      .session(session)
      .lean();
      
    if (!parent) return;
    
    const path = `${parent.path}/${unitId.toString()}`;
    const depth = parent.depth + 1;
    
    await OrganizationalUnit.findByIdAndUpdate(
      unitId,
      { path, depth },
      { session }
    );
  }

  async #updateDescendantPaths(parentId, session = null) {
    const parent = await OrganizationalUnit.findById(parentId)
      .select("path depth")
      .session(session)
      .lean();
      
    if (!parent) return;
    
    const descendants = await OrganizationalUnit.find({
      path: new RegExp(`/${parentId}/`)
    }).session(session);
    
    for (const desc of descendants) {
      const newPath = desc.path.replace(
        /^\/[^/]+\/[^/]+/,
        parent.path
      );
      const newDepth = parent.depth + 1;
      
      await OrganizationalUnit.findByIdAndUpdate(
        desc._id,
        { path: newPath, depth: newDepth },
        { session }
      );
    }
  }
}

// Export singleton instance
export default new OrganizationalUnitService();