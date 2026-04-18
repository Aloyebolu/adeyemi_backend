
import userModel from "#domain/user/user.model.js";
import mongoose from "mongoose";
import { StaffModel } from "../models/staff.model.js";
import AppError from "#shared/errors/AppError.js";
import { hashData } from "#utils/hashData.js";

class StaffService {
  
/**
   * Create a new staff member with user account (TRANSACTION)
   */
  async createStaff(staffData) {
    const { 
      first_name, 
      last_name, 
      middle_name, 
      email, 
      phone,
      address,
      staffId, 
      position, 
      employment_type 
    } = staffData;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check for duplicates
      const [existingStaff, existingUser] = await Promise.all([
        StaffModel.findOne({ staffId }).session(session),
        userModel.findOne({ email }).session(session),
      ]);

      if (existingStaff) {
        throw new AppError("Staff with this staff ID already exists", 409);
      }

      if (existingUser) {
        throw new AppError("User with this email already exists", 409);
      }

      // Generate staffId if not provided
      const finalStaffId = staffId || await this.generateStaffId(session);

      // Create user with default password
      const defaultPassword = `AFUED@${finalStaffId}`;
      const hashedPassword = await hashData(defaultPassword);

      const user = await userModel.create([{
        first_name, 
        last_name, 
        middle_name,
        email,
        phone,
        address,
        password: hashedPassword,
        role: "staff",
        must_change_password: true,
      }], { session });

      const createdUser = user[0];

      // Create staff profile
      const staff = await StaffModel.create([{
        _id: createdUser._id,
        staffId: finalStaffId,
        position: position || "Staff",
        employment_type: employment_type || "full_time",
        is_active: true,
      }], { session });

      const createdStaff = staff[0];

      await session.commitTransaction();
      session.endSession();

      // Populate user data for response
      const populatedStaff = await StaffModel.findById(createdStaff._id)
        .populate({
          path: "_id",
          select: "first_name last_name middle_name email phone address role"
        })
        .lean();

      return {
        staff: populatedStaff,
        user: createdUser,
        defaultPassword, // Return so it can be shown to admin
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }


  /**
   * Generate a unique staff ID
   */
  async generateStaffId(session = null) {
    const currentYear = new Date().getFullYear().toString().slice(-2);
    
    // Find the highest staff ID for this year
    const lastStaff = await StaffModel.findOne({
      staffId: new RegExp(`^STF-${currentYear}-`)
    }).session(session).sort({ staffId: -1 });

    let sequence = 1;
    if (lastStaff) {
      const match = lastStaff.staffId.match(/STF-\d{2}-(\d{4})/);
      if (match) {
        sequence = parseInt(match[1]) + 1;
      }
    }

    return `STF-${currentYear}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Get staff by ID (with populated user data)
   */
  async getStaffById(staffId) {
    const staff = await StaffModel.findById(staffId)
      .populate({
        path: "_id",
        select: "name email role avatar phone address"
      });

    if (!staff) {
      throw new Error("Staff not found");
    }

    return staff;
  }

  /**
   * Get staff by staffId (the custom ID, not MongoDB _id)
   */
  async getStaffByStaffId(staffId) {
    const staff = await StaffModel.findOne({ staffId })
      .populate({
        path: "_id",
        select: "name email role avatar phone address"
      });

    if (!staff) {
      throw new Error("Staff not found");
    }

    return staff;
  }

  /**
   * Update staff record
   */
  async updateStaff(staffId, updateData) {
    // Don't allow updating _id
    delete updateData._id;
    delete updateData.staffId; // Staff ID cannot be changed

    const staff = await StaffModel.findByIdAndUpdate(
      staffId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate({
      path: "_id",
      select: "name email role avatar"
    });

    if (!staff) {
      throw new Error("Staff not found");
    }

    return staff;
  }

  /**
   * Deactivate staff (soft delete)
   */
  async deactivateStaff(staffId) {
    const staff = await StaffModel.findByIdAndUpdate(
      staffId,
      { 
        is_active: false,
        employment_type: "inactive"
      },
      { new: true }
    );

    if (!staff) {
      throw new Error("Staff not found");
    }

    return staff;
  }

  /**
   * Activate staff
   */
  async activateStaff(staffId, employment_type = "full_time") {
    const staff = await StaffModel.findByIdAndUpdate(
      staffId,
      { 
        is_active: true,
        employment_type
      },
      { new: true }
    );

    if (!staff) {
      throw new Error("Staff not found");
    }

    return staff;
  }

  /**
   * Get all staff with filters
   */
  async getAllStaff(filters = {}) {
    const query = {};

    if (filters.is_active !== undefined) {
      query.is_active = filters.is_active === 'true';
    }
    
    if (filters.employment_type) {
      query.employment_type = filters.employment_type;
    }

    if (filters.search) {
      // We'll handle user search in the controller via population
    }

    return query;
  }

  /**
   * Search staff by name, email, or staffId
   */
  async searchStaff(searchTerm, limit = 20) {
    // First find matching users
    const users = await userModel.find({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ]
    }).select("_id").limit(limit);

    const userIds = users.map(u => u._id);

    // Then find staff records matching either user IDs or staffId
    const staff = await StaffModel.find({
      $or: [
        { _id: { $in: userIds } },
        { staffId: { $regex: searchTerm, $options: 'i' } }
      ],
      is_active: true
    })
    .populate({
      path: "_id",
      select: "name email role avatar"
    })
    .limit(limit);

    return staff;
  }

  /**
   * Get staff statistics
   */
  async getStaffStatistics() {
    const [total, active, byEmploymentType] = await Promise.all([
      StaffModel.countDocuments(),
      StaffModel.countDocuments({ is_active: true }),
      StaffModel.aggregate([
        { $group: { _id: "$employment_type", count: { $sum: 1 } } }
      ])
    ]);

    return {
      total,
      active,
      inactive: total - active,
      by_employment_type: byEmploymentType.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {})
    };
  }

  /**
   * Bulk create staff from user IDs
   */
  async bulkCreateStaff(userIds, defaultData = {}, session = null) {
    const localSession = session || await mongoose.startSession();
    const shouldManageSession = !session;
    
    if (shouldManageSession) {
      localSession.startTransaction();
    }

    try {
      const results = {
        successful: [],
        failed: []
      };

      for (const userId of userIds) {
        try {
          const staffData = {
            _id: userId,
            ...defaultData,
            staffId: defaultData.staffId || await this.generateStaffId(localSession)
          };

          const staff = await this.createStaff(staffData, localSession);
          results.successful.push(staff);
        } catch (error) {
          results.failed.push({
            userId,
            error: error.message
          });
        }
      }

      if (shouldManageSession) {
        await localSession.commitTransaction();
      }

      return results;
    } catch (error) {
      if (shouldManageSession) {
        await localSession.abortTransaction();
      }
      throw error;
    } finally {
      if (shouldManageSession) {
        localSession.endSession();
      }
    }
  }
}

export default new StaffService();