// controllers/userProfileController.js
// import User from "../models/User.js";
// import AppError from "../errors/AppError.js";
// import { SYSTEM_USER_ID } from "../config/system.js";

import { SYSTEM_USER_ID } from "../../../config/system.js";
import AppError from "../../errors/AppError.js";
import User from "../user.model.js";

// Allowed fields for different roles
const allowedUpdates = {
  // All roles can update these
  common: [
    "first_name",
    "middle_name", 
    "last_name",
    "bio",
    "chat_availability",
    "phone"
  ],
  
  // Role-specific allowed fields
  student: [
    "matricNo",
    "level",
    "session",
  ],
  
  lecturer: [
    "staffId",
    "department",
  ],
  
  hod: [
    "staffId",
    "department",
  ],
  
  dean: [
    "staffId",
    "faculty",
  ],
  
  admin: [
    "staffId",
    "department",
    "extra_roles",
    "title"
  ],
  
  applicant: [
    "matricNo",
    "level",
    "session",
  ],
  
  vc: [
    "staffId",
  ],
};

// Fields that are completely off-limits for profile updates
const forbiddenFields = [
  "_id",
  "id",
  "password",
  "passwordHistory",
  "lastPasswordChange",
  "passwordExpiryDays",
  "recentDevices",
  "role",
  "created_by",
  "created_by_source",
  "createdAt",
  "updatedAt",
  "__v",
];

// Fields that require admin approval
const adminApprovalFields = [
  "avatar",
  "title", // Title changes for students
  "department", // Department changes might require approval
  "faculty", // Faculty changes might require approval
];

/**
 * Get allowed update fields based on user role
 */
const getAllowedFields = (role) => {
  const roleKey = role.toLowerCase();
  const roleSpecific = allowedUpdates[roleKey] || [];
  
  return [...allowedUpdates.common, ...roleSpecific];
};

/**
 * Validate field values
 */
const validateFieldValue = (field, value) => {
  if (value === null || value === undefined) return null;
  
  switch (field) {
    case "first_name":
    case "middle_name":
    case "last_name":
      if (typeof value !== "string") return `${field} must be a string`;
      if (value.length < 2) return `${field} must be at least 2 characters`;
      if (value.length > 50) return `${field} must be less than 50 characters`;
      if (!/^[a-zA-Z\s\-']+$/.test(value)) {
        return `${field} can only contain letters, spaces, hyphens and apostrophes`;
      }
      break;
      
    case "bio":
      if (typeof value !== "string") return "Bio must be a string";
      if (value.length > 500) return "Bio must be less than 500 characters";
      break;
      
    case "title":
      const validTitles = ["mr", "mrs", "miss", "ms", "dr", "prof", "engr", "barr", "pastor", "chief", "alhaji", "alhaja", "rev"];
      if (value && !validTitles.includes(value.toLowerCase())) {
        return "Invalid title value";
      }
      break;
      
    case "matricNo":
      if (typeof value !== "string") return "Matric number must be a string";
      if (value && !/^[A-Z0-9\/\-]+$/i.test(value)) {
        return "Invalid matric number format";
      }
      break;
      
    case "staffId":
      if (typeof value !== "string") return "Staff ID must be a string";
      if (value && !/^[A-Z0-9\/\-]+$/i.test(value)) {
        return "Invalid staff ID format";
      }
      break;
      
    case "chat_availability":
      if (typeof value !== "boolean") return "Chat availability must be a boolean";
      break;
      
    case "extra_roles":
      if (!Array.isArray(value)) return "Extra roles must be an array";
      const validExtraRoles = ["customer_service", "moderator", "support_agent"];
      for (const role of value) {
        if (!validExtraRoles.includes(role)) {
          return `Invalid extra role: ${role}`;
        }
      }
      break;
      
    case "level":
    //   if (typeof value !== "string") return "Level must be a string";
      const validLevels = ["100", "200", "300", "400", "500", "600", "Masters", "PhD"];
      if (value && !validLevels.includes(value)) {
        // return "Invalid level value";
      }
      break;
      
    case "session":
    //   if (typeof value !== "string") return "Session must be a string";
      if (value && !/^\d{4}\/\d{4}$/.test(value)) {
        // return "Session must be in format YYYY/YYYY (e.g., 2023/2024)";
      }
      break;
  }
  
  return null;
};

/**
 * Update profile controller
 */
export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user?._id;
    const requestingUser = req.user;
    
    if (!userId) {
      return next(new AppError("User ID is required", 400));
    }
    
    // Check if trying to update system user
    if (userId.toString() === SYSTEM_USER_ID) {
      return next(new AppError("System user cannot be modified", 403));
    }
    
    // Find the user to update
    const userToUpdate = await User.findById(userId);
    
    if (!userToUpdate) {
      return next(new AppError("User not found", 404));
    }
    
    // Permission checks
    const isSelfUpdate = requestingUser?._id.toString() === userId.toString();
    const isAdmin = requestingUser?.role === "admin";
    
    // Only allow users to update themselves unless they're admin
    if (!isSelfUpdate && !isAdmin) {
      return next(new AppError("You can only update your own profile", 403));
    }
    
    // Extract update data
    const updates = req.body;
    delete updates.passwordHistory
    delete updates.department
    
    // Check for empty update
    if (Object.keys(updates).length === 0) {
      return next(new AppError("No update data provided", 400));
    }
    
    // Check for forbidden fields
    const forbiddenAttempts = Object.keys(updates).filter(field => 
      forbiddenFields.includes(field)
    );
    
    if (forbiddenAttempts.length > 0) {
        // Remove forbidden fields from updates
forbiddenFields.forEach(field => {
  if (field in updates) {
    delete updates[field];
  }
});
    //   return next(new AppError(
    //     `Cannot update forbidden fields: ${forbiddenAttempts.join(", ")}`, 
    //     400
    //   ));
    }
    
    // Special case: Students cannot update title
    // if (userToUpdate.role === "student" && updates.title !== undefined) {
    //   return next(new AppError(
    //     "Students cannot update their title. Please contact the administrator.",
    //     403
    //   ));
    // }
    
    // Special case: Avatar updates must go through admin
    // if (updates.avatar !== undefined) {
    //   return next(new AppError(
    //     "Avatar updates must be approved by an administrator. Please contact support.",
    //     403
    //   ));
    // }
    
    // Get allowed fields for this user's role
    const allowedFields = getAllowedFields(userToUpdate.role);
    
    // Filter updates to only allowed fields
    const validUpdates = {};
    const rejectedUpdates = [];
    
    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field)) {
        // Validate field value
        const validationError = validateFieldValue(field, value);
        if (validationError) {
          return next(new AppError(validationError, 400));
        }
        validUpdates[field] = value;
      } else {
        rejectedUpdates.push(field);
      }
    }
    
    // Check if any fields require admin approval
    const needsApproval = Object.keys(validUpdates).filter(field => 
      adminApprovalFields.includes(field)
    );
    
    if (needsApproval.length > 0 && !isAdmin) {
      // In a real app, you might create an approval request here
      return next(new AppError(
        `The following fields require administrator approval: ${needsApproval.join(", ")}. Your request has been submitted for review.`,
        202 // Accepted but not completed
      ));
    }
    
    // Check if there are any valid updates
    if (Object.keys(validUpdates).length === 0) {
      if (rejectedUpdates.length > 0) {
        return next(new AppError(
          `No valid updates provided. Rejected fields: ${rejectedUpdates.join(", ")}`,
          400
        ));
      }
      return next(new AppError("No valid updates provided", 400));
    }
    
    // Check for uniqueness constraints
    if (validUpdates.matricNo && validUpdates.matricNo !== userToUpdate.matricNo) {
      const existingMatric = await User.findOne({ 
        matricNo: validUpdates.matricNo,
        _id: { $ne: userId }
      });
      if (existingMatric) {
        return next(new AppError("Matric number already exists", 409));
      }
    }
    
    if (validUpdates.staffId && validUpdates.staffId !== userToUpdate.staffId) {
      const existingStaffId = await User.findOne({ 
        staffId: validUpdates.staffId,
        _id: { $ne: userId }
      });
      if (existingStaffId) {
        return next(new AppError("Staff ID already exists", 409));
      }
    }
    
    // Perform the update
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: validUpdates },
      { 
        new: true, // Return updated document
        runValidators: true, // Run schema validators
      }
    ).select("-recentDevices "); // Exclude sensitive fields
    
    // Log the update (you might want to create an audit log)
    
    // Prepare response
    const response = {
      status: "success",
      message: "Profile updated successfully",
      data: {
        user: updatedUser,
        updatedFields: Object.keys(validUpdates),
      },
    };
    
    // Add rejected fields if any
    if (rejectedUpdates.length > 0) {
      response.data.rejectedFields = rejectedUpdates;
    }
    
    // If some fields need approval, add that to response
    if (needsApproval.length > 0 && !isAdmin) {
      response.message = "Profile partially updated. Some fields require approval.";
      response.data.pendingApproval = needsApproval;
    }
    
    res.status(200).json(response);
    
  } catch (error) {
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return next(new AppError(`${field} already exists`, 409));
    }
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return next(new AppError(messages.join(", "), 400));
    }
    
    next(error);
  }
};

/**
 * Get profile update options (what can be updated)
 */
export const getUpdateOptions = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user?._id;
    
    if (!userId) {
      return next(new AppError("User ID is required", 400));
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return next(new AppError("User not found", 404));
    }
    
    const allowedFields = getAllowedFields(user.role);
    
    // Build field metadata
    const fields = allowedFields.map(field => {
      const metadata = {
        name: field,
        type: getFieldType(field),
        currentValue: user[field],
        description: getFieldDescription(field),
        validation: getFieldValidation(field),
      };
      
      // Add enum values for specific fields
      if (field === "title") {
        metadata.enum = ["mr", "mrs", "miss", "ms", "dr", "prof", "engr", "barr", "pastor", "chief", "alhaji", "alhaja", "rev"];
        if (user.role === "student") {
          metadata.updatable = false;
          metadata.reason = "Students cannot update title. Contact administrator.";
        }
      }
      
      if (field === "extra_roles") {
        metadata.enum = ["customer_service", "moderator", "support_agent"];
      }
      
      if (field === "level") {
        metadata.enum = ["100", "200", "300", "400", "500", "600", "Masters", "PhD"];
      }
      
      return metadata;
    });
    
    res.status(200).json({
      status: "success",
      data: {
        role: user.role,
        updatableFields: fields,
        requiresAdminApproval: adminApprovalFields,
        forbiddenFields,
      },
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to get field type
 */
const getFieldType = (field) => {
  const typeMap = {
    first_name: "string",
    middle_name: "string",
    last_name: "string",
    title: "enum",
    bio: "text",
    chat_availability: "boolean",
    matricNo: "string",
    staffId: "string",
    department: "objectId",
    faculty: "objectId",
    extra_roles: "array",
    level: "string",
    session: "string",
  };
  
  return typeMap[field] || "string";
};

/**
 * Helper to get field description
 */
const getFieldDescription = (field) => {
  const descMap = {
    first_name: "Your first/given name",
    middle_name: "Your middle name (optional)",
    last_name: "Your last/family name",
    title: "Your professional or personal title",
    bio: "A brief description about yourself",
    chat_availability: "Whether you're available for chat",
    matricNo: "Your student matriculation number",
    staffId: "Your staff identification number",
    department: "Your department",
    faculty: "Your faculty",
    extra_roles: "Additional roles or permissions",
    level: "Your current academic level",
    session: "Current academic session",
  };
  
  return descMap[field] || field;
};

/**
 * Helper to get field validation rules
 */
const getFieldValidation = (field) => {
  const validationMap = {
    first_name: { minLength: 2, maxLength: 50, pattern: "^[a-zA-Z\\s\\-']+$" },
    last_name: { minLength: 2, maxLength: 50, pattern: "^[a-zA-Z\\s\\-']+$" },
    bio: { maxLength: 500 },
    matricNo: { pattern: "^[A-Z0-9\\/\\-]+$", example: "CS2023/001" },
    staffId: { pattern: "^[A-Z0-9\\/\\-]+$", example: "STAFF/2023/001" },
    chat_availability: { type: "boolean" },
    session: { pattern: "^\\d{4}\\/\\d{4}$", example: "2023/2024" },
    level: { example: "200", enum: ["100", "200", "300", "400", "500", "600", "Masters", "PhD"] },
  };
  
  return validationMap[field] || {};
};

/**
 * Request admin approval for field updates
 */
export const requestFieldUpdate = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user?._id;
    const { field, value, reason } = req.body;
    
    if (!userId) {
      return next(new AppError("User ID is required", 400));
    }
    
    if (!field) {
      return next(new AppError("Field name is required", 400));
    }
    
    // Check if field requires admin approval
    if (!adminApprovalFields.includes(field)) {
      return next(new AppError("This field does not require admin approval", 400));
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return next(new AppError("User not found", 404));
    }
    
    // Validate the requested value
    const validationError = validateFieldValue(field, value);
    if (validationError) {
      return next(new AppError(validationError, 400));
    }
    
    // Special case: Students requesting title change
    if (user.role === "student" && field === "title") {
      // Here you would create an approval request in your database
      // For now, we'll just log it
      
      return res.status(202).json({
        status: "success",
        message: "Title change request submitted for review",
        data: {
          field,
          requestedValue: value,
          reason,
          estimatedResponseTime: "24-48 hours",
          requestId: generateRequestId(),
        },
      });
    }
    
    // Handle other approval requests
    console.log(`User ${userId} requested ${field} change to ${value}. Reason: ${reason}`);
    
    res.status(202).json({
      status: "success",
      message: "Update request submitted for admin review",
      data: {
        field,
        requestedValue: value,
        reason,
        estimatedResponseTime: "24-48 hours",
        requestId: generateRequestId(),
      },
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * Generate a simple request ID (in production, use a proper ID generator)
 */
const generateRequestId = () => {
  return 'REQ_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * Batch update multiple users (admin only)
 */
export const batchUpdateUsers = async (req, res, next) => {
  try {
    const { userIds, updates } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return next(new AppError("User IDs array is required", 400));
    }
    
    if (!updates || Object.keys(updates).length === 0) {
      return next(new AppError("Update data is required", 400));
    }
    
    // Check for forbidden fields in batch update
    const forbiddenAttempts = Object.keys(updates).filter(field => 
      forbiddenFields.includes(field)
    );
    
    if (forbiddenAttempts.length > 0) {
      return next(new AppError(
        `Cannot update forbidden fields in batch: ${forbiddenAttempts.join(", ")}`, 
        400
      ));
    }
    
    // Validate each field value
    for (const [field, value] of Object.entries(updates)) {
      const validationError = validateFieldValue(field, value);
      if (validationError) {
        return next(new AppError(validationError, 400));
      }
    }
    
    // Prevent batch update of system user
    if (userIds.includes(SYSTEM_USER_ID)) {
      return next(new AppError("System user cannot be modified in batch update", 403));
    }
    
    // Perform batch update
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: updates },
      { runValidators: true }
    );
    
    res.status(200).json({
      status: "success",
      message: "Batch update completed",
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
    });
    
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError("Duplicate key error in batch update", 409));
    }
    next(error);
  }
};