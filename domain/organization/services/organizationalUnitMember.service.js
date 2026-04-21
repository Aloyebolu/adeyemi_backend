// domain/organization/organizationalUnitMember.service.js
import mongoose from "mongoose";
import OrganizationalUnitMember  from "../models/organizationalUnitMember.model.js";
import OrganizationalUnit from "../models/organizationalUnit.model.js";
import User from "#domain/user/user.model.js";
import { logger } from "#utils/logger.js";
import AppError from "#shared/errors/AppError.js";

/**
 * 🏛️ ORGANIZATIONAL UNIT MEMBER SERVICE
 * ------------------------------------------
 * Handles all membership-related operations
 * Separated from main UnitService for better maintainability
 */
class OrganizationalUnitMemberService {
  
  // ==================== MEMBERSHIP CRUD ====================

  /**
   * Add a member to a unit
   * @param {string} unitId - Unit ID
   * @param {Object} memberData - Member data { user, role, title, responsibilities, start_date }
   * @param {Object} session - MongoDB session (optional)
   * @returns {Promise<Object>} - Created member document
   */
  async addMember(unitId, memberData, session = null) {
    const shouldUseSession = !session;
    let dbSession = session;
    
    try {
      if (shouldUseSession) {
        dbSession = await mongoose.startSession();
        dbSession.startTransaction();
      }
      
      // Validate unit exists
      const unit = await OrganizationalUnit.findById(unitId)
        .session(dbSession)
        .lean();
      
      if (!unit) {
        throw new AppError("Unit not found", 404, "UNIT_NOT_FOUND");
      }
      
      // Validate user exists
      const user = await User.findById(memberData.user)
        .session(dbSession)
        .lean();
      
      if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
      }
      
      // Check if user is already an active member
      const existingMember = await OrganizationalUnitMember.findOne({
        unit: unitId,
        user: memberData.user,
        is_active: true
      }).session(dbSession);
      
      if (existingMember) {
        throw new AppError(
          `User is already an active member of this unit with role: ${existingMember.role}`,
          409,
          "MEMBER_ALREADY_EXISTS"
        );
      }
      
      // Check for HEAD uniqueness if role is HEAD
      if (memberData.role === "HEAD") {
        const existingHead = await OrganizationalUnitMember.findOne({
          unit: unitId,
          role: "HEAD",
          is_active: true
        }).session(dbSession);
        
        if (existingHead) {
          throw new AppError(
            `Unit already has an active HEAD. Please deactivate the current HEAD first.`,
            409,
            "HEAD_ALREADY_EXISTS"
          );
        }
      }
      
      // Create member
      const member = new OrganizationalUnitMember({
        unit: unitId,
        user: memberData.user,
        role: memberData.role,
        title: memberData.title || this.#getDefaultTitleForRole(memberData.role, unit.type),
        responsibilities: memberData.responsibilities || [],
        start_date: memberData.start_date || new Date(),
        is_active: true
      });
      
      await member.save({ session: dbSession });
      
      // If role is HEAD, update unit's head reference
      if (memberData.role === "HEAD") {
        await OrganizationalUnit.findByIdAndUpdate(
          unitId,
          { head_user_id: memberData.user },
          { session: dbSession }
        );
        
        // Update denormalized member count
        await this.#updateMemberCount(unitId, dbSession);
      }
      
      if (shouldUseSession) {
        await dbSession.commitTransaction();
      }
      
      // Populate user details for response
      const populatedMember = await OrganizationalUnitMember.findById(member._id)
        .populate("user", "first_name last_name email staffId profile_picture")
        .lean();
      
      return populatedMember;
      
    } catch (error) {
      if (shouldUseSession && dbSession) {
        await dbSession.abortTransaction();
      }
      throw error;
    } finally {
      if (shouldUseSession && dbSession) {
        dbSession.endSession();
      }
    }
  }
  
  /**
   * Update a member's details
   * @param {string} memberId - Member ID
   * @param {Object} updateData - Data to update { role, title, responsibilities, is_active, end_date }
   * @returns {Promise<Object>} - Updated member document
   */
  async updateMember(memberId, updateData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const member = await OrganizationalUnitMember.findById(memberId)
        .session(session);
      
      if (!member) {
        throw new AppError("Member not found", 404, "MEMBER_NOT_FOUND");
      }
      
      const oldRole = member.role;
      const oldActiveStatus = member.is_active;
      
      // If changing role to HEAD, ensure uniqueness
      if (updateData.role === "HEAD" && oldRole !== "HEAD") {
        const existingHead = await OrganizationalUnitMember.findOne({
          unit: member.unit,
          role: "HEAD",
          is_active: true,
          _id: { $ne: memberId }
        }).session(session);
        
        if (existingHead) {
          throw new AppError(
            `Unit already has an active HEAD. Cannot assign another HEAD.`,
            409,
            "HEAD_ALREADY_EXISTS"
          );
        }
      }
      
      // If removing HEAD role or deactivating HEAD, update unit reference
      const willBeHead = updateData.role === "HEAD" || 
                        (updateData.role === undefined && oldRole === "HEAD");
      const willBeActive = updateData.is_active !== undefined ? 
                          updateData.is_active : member.is_active;
      
      // Apply updates
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          member[key] = updateData[key];
        }
      });
      
      await member.save({ session });
      
      // Update unit head reference if needed
      if (oldRole === "HEAD" || willBeHead) {
        await this.#syncUnitHeadReference(member.unit, session);
      }
      
      // Update member count if active status changed
      if (oldActiveStatus !== member.is_active) {
        await this.#updateMemberCount(member.unit, session);
      }
      
      await session.commitTransaction();
      
      // Return populated member
      const populatedMember = await OrganizationalUnitMember.findById(memberId)
        .populate("user", "first_name last_name email staffId profile_picture")
        .lean();
      
      return populatedMember;
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Remove a member from a unit (soft delete)
   * @param {string} memberId - Member ID
   * @param {string} reason - Reason for removal (optional)
   * @returns {Promise<Object>} - Removed member data
   */
  async removeMember(memberId, reason = null) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const member = await OrganizationalUnitMember.findById(memberId)
        .session(session);
      
      if (!member) {
        throw new AppError("Member not found", 404, "MEMBER_NOT_FOUND");
      }
      
      if (!member.is_active) {
        throw new AppError("Member is already inactive", 400, "MEMBER_ALREADY_INACTIVE");
      }
      
      // Check if this is the only HEAD
      if (member.role === "HEAD") {
        const activeHeads = await OrganizationalUnitMember.countDocuments({
          unit: member.unit,
          role: "HEAD",
          is_active: true,
          _id: { $ne: memberId }
        }).session(session);
        
        if (activeHeads === 0) {
          throw new AppError(
            "Cannot remove the only HEAD of a unit. Please assign another HEAD first.",
            400,
            "LAST_HEAD_REMOVAL_FORBIDDEN"
          );
        }
      }
      
      // Soft delete
      member.is_active = false;
      member.end_date = new Date();
      if (reason) {
        member.metadata = { ...member.metadata, removal_reason: reason };
      }
      await member.save({ session });
      
      // Update unit head reference if this member was HEAD
      if (member.role === "HEAD") {
        await this.#syncUnitHeadReference(member.unit, session);
      }
      
      // Update member count
      await this.#updateMemberCount(member.unit, session);
      
      await session.commitTransaction();
      
      return {
        member_id: memberId,
        unit: member.unit,
        user: member.user,
        role: member.role,
        removed_at: member.end_date,
        reason
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Hard delete a member (permanent removal - use with caution)
   * @param {string} memberId 
   * @returns {Promise<Object>}
   */
  async hardDeleteMember(memberId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const member = await OrganizationalUnitMember.findById(memberId)
        .session(session);
      
      if (!member) {
        throw new AppError("Member not found", 404, "MEMBER_NOT_FOUND");
      }
      
      const unitId = member.unit;
      const wasHead = member.role === "HEAD";
      
      await OrganizationalUnitMember.findByIdAndDelete(memberId).session(session);
      
      if (wasHead) {
        await this.#syncUnitHeadReference(unitId, session);
      }
      
      await this.#updateMemberCount(unitId, session);
      
      await session.commitTransaction();
      
      return { deleted: true, member_id: memberId };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // ==================== QUERY METHODS ====================
  
  /**
   * Get all members of a unit with pagination
   * @param {string} unitId 
   * @param {Object} options - { page, limit, role, is_active }
   * @returns {Promise<Object>}
   */
  async getUnitMembers(unitId, options = {}) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;
      
      const query = { unit: unitId };
      
      if (options.role) {
        query.role = options.role;
      }
      
      if (options.is_active !== undefined) {
        query.is_active = options.is_active;
      } else {
        query.is_active = true; // Default to active members
      }
      
      const [members, total] = await Promise.all([
        OrganizationalUnitMember.find(query)
          .populate("user", "first_name last_name email staffId profile_picture phone_number")
          .sort({ role: 1, start_date: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        OrganizationalUnitMember.countDocuments(query)
      ]);
      
      // Group by role for better frontend consumption
      const groupedByRole = this.#groupMembersByRole(members);
      
      return {
        members,
        grouped_by_role: groupedByRole,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
      
    } catch (error) {
      logger.error(`getUnitMembers failed: ${error.message}`, { unitId, options });
      throw error;
    }
  }
  
  /**
   * Get all units a user belongs to
   * @param {string} userId 
   * @param {Object} options - { include_inactive, role }
   * @returns {Promise<Array>}
   */
  async getUserUnits(userId, options = {}) {
    try {
      const query = { 
        user: userId,
        is_active: options.include_inactive ? undefined : true
      };
      
      if (options.role) {
        query.role = options.role;
      }
      
      const memberships = await OrganizationalUnitMember.find(query)
        .populate("unit", "name code type parent_unit description is_active path depth")
        .sort({ start_date: -1 })
        .lean();
      
      // Transform to match frontend expectations
      return memberships.map(membership => ({
        id: membership._id,
        unit: membership.unit,
        role: membership.role,
        title: membership.title,
        responsibilities: membership.responsibilities,
        is_active: membership.is_active,
        start_date: membership.start_date,
        end_date: membership.end_date,
        joined_at: membership.createdAt
      }));
      
    } catch (error) {
      logger.error(`getUserUnits failed: ${error.message}`, { userId, options });
      throw error;
    }
  }
  
  /**
   * Get member by ID with full details
   * @param {string} memberId 
   * @returns {Promise<Object>}
   */
  async getMemberById(memberId) {
    try {
      const member = await OrganizationalUnitMember.findById(memberId)
        .populate("user", "first_name last_name email staffId profile_picture phone_number")
        .populate("unit", "name code type description")
        .lean();
      
      if (!member) {
        throw new AppError("Member not found", 404, "MEMBER_NOT_FOUND");
      }
      
      return member;
      
    } catch (error) {
      logger.error(`getMemberById failed: ${error.message}`, { memberId });
      throw error;
    }
  }
  
  /**
   * Check if user has a specific role in a unit
   * @param {string} userId 
   * @param {string} unitId 
   * @param {Array<string>} roles 
   * @returns {Promise<boolean>}
   */
  async userHasRole(userId, unitId, roles) {
    try {
      const member = await OrganizationalUnitMember.findOne({
        user: userId,
        unit: unitId,
        is_active: true,
        role: { $in: roles }
      }).lean();
      
      return !!member;
      
    } catch (error) {
      logger.error(`userHasRole failed: ${error.message}`, { userId, unitId, roles });
      return false;
    }
  }
  
  /**
   * Get user's role in a specific unit
   * @param {string} userId 
   * @param {string} unitId 
   * @returns {Promise<Object|null>}
   */
  async getUserRoleInUnit(userId, unitId) {
    try {
      const member = await OrganizationalUnitMember.findOne({
        user: userId,
        unit: unitId,
        is_active: true
      })
        .populate("unit", "name code type")
        .lean();
      
      if (!member) return null;
      
      return {
        role: member.role,
        title: member.title,
        responsibilities: member.responsibilities,
        unit: member.unit,
        start_date: member.start_date
      };
      
    } catch (error) {
      logger.error(`getUserRoleInUnit failed: ${error.message}`, { userId, unitId });
      return null;
    }
  }
  
  // ==================== BULK OPERATIONS ====================
  
  /**
   * Bulk add members to a unit
   * @param {string} unitId 
   * @param {Array} membersData - Array of member data objects
   * @returns {Promise<Object>}
   */
  async bulkAddMembers(unitId, membersData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const results = {
        successful: [],
        failed: []
      };
      
      for (const memberData of membersData) {
        try {
          const member = await this.addMember(unitId, memberData, session);
          results.successful.push({
            user_id: memberData.user,
            member_id: member._id,
            role: memberData.role
          });
        } catch (error) {
          results.failed.push({
            user_id: memberData.user,
            error: error.message
          });
        }
      }
      
      await session.commitTransaction();
      
      return results;
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Transfer all members from one unit to another
   * @param {string} sourceUnitId 
   * @param {string} targetUnitId 
   * @returns {Promise<Object>}
   */
  async transferMembers(sourceUnitId, targetUnitId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const result = await OrganizationalUnitMember.updateMany(
        { unit: sourceUnitId, is_active: true },
        { unit: targetUnitId },
        { session }
      );
      
      // Update member counts for both units
      await Promise.all([
        this.#updateMemberCount(sourceUnitId, session),
        this.#updateMemberCount(targetUnitId, session)
      ]);
      
      await session.commitTransaction();
      
      return {
        transferred_count: result.modifiedCount,
        source_unit: sourceUnitId,
        target_unit: targetUnitId
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // ==================== STATISTICS ====================
  
  /**
   * Get member statistics for a unit
   * @param {string} unitId 
   * @returns {Promise<Object>}
   */
  async getMemberStats(unitId) {
    try {
      const stats = await OrganizationalUnitMember.aggregate([
        { $match: { unit: new mongoose.Types.ObjectId(unitId), is_active: true } },
        { $group: {
            _id: "$role",
            count: { $sum: 1 }
          }
        },
        { $group: {
            _id: null,
            roles: { $push: { role: "$_id", count: "$count" } },
            total: { $sum: "$count" }
          }
        }
      ]);
      
      const roleStats = stats[0]?.roles || [];
      const total = stats[0]?.total || 0;
      
      // Format role stats
      const formattedStats = {};
      roleStats.forEach(stat => {
        formattedStats[stat.role] = stat.count;
      });
      
      return {
        unit_id: unitId,
        total_active_members: total,
        by_role: formattedStats,
        has_head: formattedStats.HEAD > 0
      };
      
    } catch (error) {
      logger.error(`getMemberStats failed: ${error.message}`, { unitId });
      throw error;
    }
  }
  
  // ==================== PRIVATE HELPERS ====================
  
  #getDefaultTitleForRole(role, unitType) {
    const titleMap = {
      HEAD: {
        university: "Vice Chancellor",
        faculty: "Dean",
        department: "Head of Department",
        registry: "Registrar",
        bursary: "Bursar",
        library: "University Librarian",
        ict: "Director of ICT",
        default: "Unit Head"
      },
      DEPUTY: {
        faculty: "Deputy Dean",
        department: "Deputy Head of Department",
        default: "Deputy Unit Head"
      },
      STAFF: "Staff Member",
      ASSISTANT: "Assistant",
      OFFICER: "Officer"
    };
    
    if (role === "HEAD" || role === "DEPUTY") {
      return titleMap[role]?.[unitType] || titleMap[role]?.default || titleMap[role];
    }
    
    return titleMap[role] || role;
  }
  
  #groupMembersByRole(members) {
    const grouped = {
      HEAD: [],
      DEPUTY: [],
      STAFF: [],
      ASSISTANT: [],
      OFFICER: []
    };
    
    members.forEach(member => {
      if (grouped[member.role]) {
        grouped[member.role].push(member);
      }
    });
    
    return grouped;
  }
  
  async #syncUnitHeadReference(unitId, session) {
    const activeHead = await OrganizationalUnitMember.findOne({
      unit: unitId,
      role: "HEAD",
      is_active: true
    }).session(session);
    
    await OrganizationalUnit.findByIdAndUpdate(
      unitId,
      { head_user_id: activeHead ? activeHead.user : null },
      { session }
    );
  }
  
  async #updateMemberCount(unitId, session) {
    const activeCount = await OrganizationalUnitMember.countDocuments({
      unit: unitId,
      is_active: true
    }).session(session);
    
    await OrganizationalUnit.findByIdAndUpdate(
      unitId,
      { active_member_count: activeCount },
      { session }
    );
  }
}

// Export singleton instance
export default new OrganizationalUnitMemberService();