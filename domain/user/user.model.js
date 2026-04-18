/**
 * USER MODEL — SYSTEM USER NOTE
 *
 * This schema intentionally does NOT include:
 *  - isSystemUser
 *  - "system" role enum
 *
 * Reason:
 *  - The system user is identified exclusively by a reserved ObjectId
 *  - Adding flags or roles could allow impersonation via API calls or developer errors
 *
 * How system actions work:
 *  - Services may assign createdBy = SYSTEM_USER_ID
 *  - The ID is defined in config/system.ts
 *
 * DO NOT:
 *  - Add system to role enums
 *  - Add isSystemUser boolean
 *  - Infer system user from role or permissions
 */

import mongoose from "mongoose";
import AppError from "#shared/errors/AppError.js";
import { SYSTEM_USER_FULL_NAME, SYSTEM_USER_ID } from "#config/system.js";
import { resolveUserName } from "#utils/resolveUserName.js";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    first_name: {
      type: String,
      required: true,
      trim: true
    },

    middle_name: {
      type: String,
      trim: true
    },

    last_name: {
      type: String,
      required: true,
      trim: true
    },

    title: {
      type: String,
      enum: ["mr", "mrs", "miss", "ms", "dr", "prof", "engr", 'barr', 'pastor', 'chief', 'alhaji', 'alhaja', 'chief', 'rev', null],
      default: null
    },
    bio: {
      type: String,
      default: null
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true
    },

    phone: {
      type: String,

    },
    avatar: {
      type: String,
    },
    // Security section - ALL FIELDS BELOW HAVE select: false BY DEFAULT
    password: {
      type: String,
      required: true,
      select: false // 🔒 Hidden by default
    },

    lastPasswordChange: {
      type: Date,
      default: Date.now,
      select: false // 🔒 Hidden by default
    },

    passwordExpiryDays: {
      type: Number,
      default: 90,
      select: false // 🔒 Hidden by default
    },

    passwordHistory: [
      {
        password: {
          type: String,
          select: false // 🔒 Hidden by default
        },
        changedAt: {
          type: Date,
          default: Date.now,
          select: false // 🔒 Hidden by default
        }
      }
    ],
    
    recentDevices: {
      type: [
        {
          ip: String,
          deviceType: String,
          browser: String,
          os: String,
          loginTime: Date,
          sessionToken: String,
        }
      ],
      default: [],
      select: false // 🔒 Hidden by default
    },

    role: {
      type: String,
      enum: [ "lecturer", "student", "staff"],
      required: true
    },
    extra_roles: [
      {
        type: String,
        enum: ["admin", "dean", "hod", "registrar", "bursar" , "vc", 'dvc', "applicant", "customer_service", "moderator", "support_agent"]
      }
    ],

    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null
    },

    staffId: {
      type: String,
      unique: true,
      sparse: true
    },

    matricNo: {
      type: String,
      unique: true,
      sparse: true
    },


    chat_availability: {
      type: Boolean,
      default: false
    },

    last_seen: {
      type: Date,
      default: Date.now
    },
    
    created_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: () => new mongoose.Types.ObjectId(SYSTEM_USER_ID),
      immutable: true,
      select: false // 🔒 Hidden by default (internal tracking)
    },
    
    created_by_source: {
      type: String,
      enum: ["user", "system", "cron", "migration", "webhook"],
      default: "system",
      select: false // 🔒 Hidden by default (internal tracking)
    },

    // Track if this is a soft-deleted user
    is_deleted: {
      type: Boolean,
      default: false,
      select: false // 🔒 Hidden by default
    },

    deleted_at: {
      type: Date,
      select: false // 🔒 Hidden by default
    },

    deleted_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      select: false // 🔒 Hidden by default
    }
  },

  { 
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        // Remove any fields that might have been accidentally included
        delete ret.password;
        delete ret.passwordHistory;
        delete ret.recentDevices;
        delete ret.created_by;
        delete ret.created_by_source;
        delete ret.__v;
        return ret;
      }
    },
    toObject: { 
      virtuals: true,
      transform: function(doc, ret) {
        // Remove any fields that might have been accidentally included
        delete ret.password;
        delete ret.passwordHistory;
        delete ret.recentDevices;
        delete ret.created_by;
        delete ret.created_by_source;
        delete ret.__v;
        return ret;
      }
    }
  }
);

userSchema.index({ first_name: 1, last_name: 1, middle_name: 1 })

// Global middleware to exclude sensitive data from ALL queries by default
userSchema.pre(/^find/, function(next) {
  // Get the current query
  const query = this;
  
  // Exclude soft-deleted users by default (unless explicitly asked)
  const shouldIncludeDeleted = query.getOptions().includeDeleted;
  if (!shouldIncludeDeleted) {
    query.where({ is_deleted: { $ne: true } });
  }
  
  next();
});

// Helper method to explicitly include sensitive fields when needed
userSchema.statics.withSensitive = function() {
  return this.find().select('+password +passwordHistory +recentDevices +created_by +created_by_source +is_deleted +deleted_at +deleted_by');
};

// Helper method to find by ID with sensitive fields
userSchema.statics.findByIdWithSensitive = function(id) {
  return this.findById(id).select('+password +passwordHistory +recentDevices +created_by +created_by_source +is_deleted +deleted_at +deleted_by');
};

// Instance method to get user with sensitive data
userSchema.methods.getWithSensitive = function() {
  return this.model('User').findById(this._id).select('+password +passwordHistory +recentDevices +created_by +created_by_source +is_deleted +deleted_at +deleted_by');
};

// Avoid modifications to system user
userSchema.pre(["updateOne", "findOneAndUpdate"], function (next) {
  const id = this.getQuery()?._id;
  if (id && String(id) === SYSTEM_USER_ID) {
    return next(new AppError("System user cannot be modified", 500));
  }
  next();
});

// Also avoid Impersonation of the system user on creation
userSchema.pre("save", function (next) {
  // Block creating a user with system ID
  if (this.isNew && this._id?.toString() === SYSTEM_USER_ID) {
    return next(new AppError("Cannot create the system user via this model", 500));
  }

  // Block creating a user with reserved name
  if (this.name && this.name.toLowerCase() === SYSTEM_USER_FULL_NAME.toLowerCase()) {
    return next(new AppError(`Cannot create a user with reserved name "${SYSTEM_USER_FULL_NAME}"`, 500));
  }

  next();
});

userSchema.virtual("name")
  .get(function () {
    return resolveUserName({first_name: this.first_name, middle_name: this.middle_name, last_name: this.last_name, title: this.title})
  })
  .set(function (value) {
    if (!value) return;

    const parts = value.trim().split(/\s+/);

    this.first_name = parts[0];
    this.last_name = parts.length > 1 ? parts[parts.length - 1] : "";
    this.middle_name =
      parts.length > 2 ? parts.slice(1, -1).join(" ") : undefined;
  });

userSchema.pre(/^find/, function () {
  const query = this.getQuery();

  if (query.name) {
    const parts = query.name.trim().split(/\s+/);

    delete query.name;

    query.first_name = parts[0];
    if (parts.length > 1) {
      query.last_name = parts[parts.length - 1];
    }
  }
});


// The following virtuals are to introduce just one thing to the user model.
//  currently the user model has no direct connection to user profiles like the student model, staff model
// This virtualization now makes sure there is a link directing back to the profile model
// Before User --> Staff(Wrong) 
// Before User <-- Staff(Correct) 
// After User --> Staff(COrrect) 
// After User <-- Staff(Correct) 


userSchema.virtual("staff", {
  ref: "Staff",
  localField: "_id",
  foreignField: "_id",
  justOne: true
});

export default mongoose.model("User", userSchema);