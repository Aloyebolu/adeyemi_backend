import { AdminUnit } from "../models/adminUnit.model.js";
import { AdminUnitMember } from "../models/adminUnitMember.model.js";
import mongoose from "mongoose";

class AdminUnitService {
  
  // ============================================
  // UNIT CRUD OPERATIONS
  // ============================================
  
  /**
   * Create a new administrative unit
   */
  async createUnit(unitData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check if code is unique (if provided)
      if (unitData.code) {
        const existing = await AdminUnit.findOne({ code: unitData.code }).session(session);
        if (existing) {
          throw new Error(`Unit with code "${unitData.code}" already exists`);
        }
      }

      // Validate parent exists if provided
      if (unitData.parent_unit) {
        const parent = await AdminUnit.findById(unitData.parent_unit).session(session);
        if (!parent) {
          throw new Error("Parent unit not found");
        }
      }

      const unit = new AdminUnit(unitData);
      await unit.save({ session });

      await session.commitTransaction();
      return unit;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get all units with optional filters
   */
  async getAllUnits(filters = {}) {
    const query = {};
    
    if (filters.type) query.type = filters.type;
    if (filters.is_active !== undefined) query.is_active = filters.is_active === 'true';
    if (filters.parent_unit) query.parent_unit = filters.parent_unit;
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { code: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const [units, total] = await Promise.all([
      AdminUnit.find(query)
        .populate("parent_unit", "name type")
        .populate("head", "name email")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit),
      AdminUnit.countDocuments(query)
    ]);

    return {
      units,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get a single unit by ID
   */
  async getUnitById(unitId) {
    const unit = await AdminUnit.findById(unitId)
      .populate("parent_unit", "name type code")
      .populate("head", "name email role");
    
    if (!unit) {
      throw new Error("AdminUnit not found");
    }
    
    return unit;
  }

  /**
   * Update a unit
   */
  async updateUnit(unitId, updateData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Prevent circular parent reference
      if (updateData.parent_unit) {
        if (updateData.parent_unit.toString() === unitId) {
          throw new Error("A unit cannot be its own parent");
        }
        
        const parent = await AdminUnit.findById(updateData.parent_unit).session(session);
        if (!parent) {
          throw new Error("Parent unit not found");
        }
      }

      // Check code uniqueness
      if (updateData.code) {
        const existing = await AdminUnit.findOne({
          code: updateData.code,
          _id: { $ne: unitId }
        }).session(session);
        
        if (existing) {
          throw new Error(`Unit with code "${updateData.code}" already exists`);
        }
      }

      const unit = await AdminUnit.findByIdAndUpdate(
        unitId,
        { $set: updateData },
        { new: true, runValidators: true, session }
      );

      if (!unit) {
        throw new Error("AdminUnit not found");
      }

      await session.commitTransaction();
      return unit;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Soft delete (deactivate) a unit
   */
  async deactivateUnit(unitId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check if unit has active children
      const activeChildren = await AdminUnit.countDocuments({
        parent_unit: unitId,
        is_active: true
      }).session(session);

      if (activeChildren > 0) {
        throw new Error(`Cannot deactivate unit with ${activeChildren} active sub-units`);
      }

      const unit = await AdminUnit.findByIdAndUpdate(
        unitId,
        { is_active: false },
        { new: true, session }
      );

      if (!unit) {
        throw new Error("AdminUnit not found");
      }

      // Deactivate all members
      await AdminUnitMember.updateMany(
        { unit: unitId, is_active: true },
        { is_active: false, end_date: new Date() },
        { session }
      );

      await session.commitTransaction();
      return unit;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ============================================
  // MEMBER MANAGEMENT
  // ============================================

  /**
   * Add a member to a unit
   */
  async addMember(unitId, memberData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Verify unit exists and is active
      const unit = await AdminUnit.findById(unitId).session(session);
      if (!unit) {
        throw new Error("AdminUnit not found");
      }
      if (!unit.is_active) {
        throw new Error("Cannot add members to an inactive unit");
      }

      // Check if user already has an active membership in this unit
      const existingMembership = await AdminUnitMember.findOne({
        unit: unitId,
        user: memberData.user,
        is_active: true
      }).session(session);

      if (existingMembership) {
        throw new Error("User is already an active member of this unit");
      }

      const member = new AdminUnitMember({
        unit: unitId,
        ...memberData
      });

      await member.save({ session });
      await session.commitTransaction();
      
      // Populate user details for response
      await member.populate("user", "name email");
      
      return member;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get all members of a unit
   */
  async getUnitMembers(unitId, filters = {}) {
    const query = { unit: unitId };
    
    if (filters.role) query.role = filters.role;
    if (filters.is_active !== undefined) query.is_active = filters.is_active === 'true';

    const members = await AdminUnitMember.find(query)
      .populate("user", "name email role")
      .sort({ role: 1, createdAt: -1 });

    return members;
  }

  /**
   * Update a member's details
   */
  async updateMember(memberId, updateData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const member = await AdminUnitMember.findByIdAndUpdate(
        memberId,
        { $set: updateData },
        { new: true, runValidators: true, session }
      ).populate("user", "name email");

      if (!member) {
        throw new Error("Member not found");
      }

      await session.commitTransaction();
      return member;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Remove a member (soft delete - deactivate)
   */
  async removeMember(memberId, reason = null) {
    const member = await AdminUnitMember.findByIdAndUpdate(
      memberId,
      { 
        is_active: false, 
        end_date: new Date(),
        $push: { 
          responsibilities: `Removed: ${reason || 'No reason provided'} (${new Date().toISOString()})` 
        }
      },
      { new: true }
    );

    if (!member) {
      throw new Error("Member not found");
    }

    return member;
  }

  // ============================================
  // HIERARCHY & STRUCTURE
  // ============================================

  /**
   * Get the full hierarchy of a unit
   */
  async getUnitHierarchy(unitId) {
    const unit = await AdminUnit.findById(unitId)
      .populate("head", "name email");
    
    if (!unit) throw new Error("Unit not found");

    // Get children (sub-units)
    const children = await AdminUnit.find({ 
      parent_unit: unitId,
      is_active: true 
    }).select("name type code");

    // Get parent chain
    const parentChain = await this.getParentChain(unitId);

    // Get members count by role
    const memberStats = await AdminUnitMember.aggregate([
      { $match: { unit: unit._id, is_active: true } },
      { $group: { _id: "$role", count: { $sum: 1 } } }
    ]);

    return {
      unit,
      parent_chain: parentChain,
      children,
      depth: parentChain.length,
      member_stats: memberStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    };
  }

  /**
   * Get the chain of parents from top to bottom
   */
  async getParentChain(unitId, chain = []) {
    const unit = await AdminUnit.findById(unitId).select("name type code parent_unit");
    
    if (!unit) return chain;
    
    if (unit.parent_unit) {
      return await this.getParentChain(unit.parent_unit, [unit, ...chain]);
    }
    
    return [unit, ...chain];
  }

  /**
   * Get the complete tree structure starting from a unit
   */
  async getUnitTree(unitId = null) {
    const query = unitId ? { parent_unit: unitId } : { parent_unit: null };
    const units = await AdminUnit.find(query)
      .select("name type code is_active")
      .sort({ name: 1 });

    const tree = [];
    
    for (const unit of units) {
      const children = await this.getUnitTree(unit._id);
      tree.push({
        ...unit.toObject(),
        children: children.length > 0 ? children : undefined
      });
    }

    return tree;
  }

  // ============================================
  // USER-SPECIFIC QUERIES
  // ============================================

  /**
   * Get all units a user belongs to
   */
  async getUserUnits(userId) {
    const memberships = await AdminUnitMember.find({
      user: userId,
      is_active: true
    }).populate({
      path: "unit",
      select: "name type code is_active",
      populate: {
        path: "parent_unit",
        select: "name type"
      }
    });

    return memberships.map(m => ({
      membership_id: m._id,
      role: m.role,
      title: m.title,
      unit: m.unit
    }));
  }

  /**
   * Check if a user has a specific role in a unit
   */
  async userHasRole(userId, unitId, roles = []) {
    const membership = await AdminUnitMember.findOne({
      user: userId,
      unit: unitId,
      role: { $in: Array.isArray(roles) ? roles : [roles] },
      is_active: true
    });

    return !!membership;
  }
}

export default new AdminUnitService();