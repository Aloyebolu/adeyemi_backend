// domain/organization/organizationalUnit.model.js
import mongoose from "mongoose";

/**
 *  ORGANIZATIONAL UNIT - PRODUCTION VERSION
 * -------------------------------------------
 * Pure data container with optional materialized path for performance.
 * All business rules enforced in UnitService.
 * 
 *  NEVER import this model directly in controllers or services outside this domain.
 * Always use UnitService for all operations.
 */
const organizationalUnitSchema = new mongoose.Schema(
  {
    // ==================== IDENTITY ====================
    name: {
      type: String,
      required: true,
      trim: true
    },

    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },

    // ==================== CLASSIFICATION ====================
    type: {
      type: String,
      required: true,
      enum: [
        "university", "faculty", "department",
        "registry", "bursary", "ict", "admissions", "student_affairs",
        "library", "hostel", "security", "transport", "health",
        "other"
      ]
    },

    // ==================== HIERARCHY ====================
    parent_unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrganizationalUnit",
      default: null,
      index: true
    },

    // 🔥 PERFORMANCE: Materialized path for O(1) ancestor queries
    // Format: "/univId/facultyId/deptId"
    path: {
      type: String,
      index: true,
      default: ""
    },

    // 🔥 PERFORMANCE: Depth level in tree (0 = root)
    depth: {
      type: Number,
      default: 0,
      index: true
    },

    // ==================== LEADERSHIP ====================
    head_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    head_title_override: {
      type: String,
      trim: true,
      default: null
    },

    // ==================== METADATA ====================
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },

    is_active: {
      type: Boolean,
      default: true,
      index: true
    },

    // 🔥 Track active memberships count (denormalized for performance)
    active_member_count: {
      type: Number,
      default: 0
    },

    // ==================== MIGRATION TRACKING ====================
    _migrated_from: {
      source_model: {
        type: String,
        enum: ["Faculty", "Department", "AdminUnit", null],
        default: null
      },
      source_id: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
      },
      migrated_at: {
        type: Date,
        default: null
      }
    },

    // ==================== AUDIT ====================
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ==================== INDEXES ====================
organizationalUnitSchema.index({ type: 1, is_active: 1 });
organizationalUnitSchema.index({ parent_unit: 1, type: 1 });
organizationalUnitSchema.index({ path: 1 });  // 🔥 Fast subtree queries
organizationalUnitSchema.index({ depth: 1 });
// Text index for search
organizationalUnitSchema.index(
  { name: "text", code: "text", description: "text" },
  { weights: { name: 10, code: 5, description: 1 } }
);

// ==================== VIRTUALS ====================
organizationalUnitSchema.virtual("derived_category").get(function() {
  const categoryMap = {
    university: "academic", faculty: "academic", department: "academic",
    registry: "administrative", bursary: "administrative", ict: "administrative",
    admissions: "administrative", student_affairs: "administrative",
    library: "support", hostel: "support", security: "support",
    transport: "support", health: "support", other: "support"
  };
  return categoryMap[this.type] || "support";
});

organizationalUnitSchema.virtual("effective_head_title").get(function() {
  if (this.head_title_override) return this.head_title_override;
  
  const titleMap = {
    university: "Vice Chancellor", faculty: "Dean", department: "Head of Department",
    registry: "Registrar", bursary: "Bursar", library: "University Librarian",
    ict: "Director of ICT", admissions: "Admissions Officer",
    student_affairs: "Dean of Student Affairs", security: "Chief Security Officer",
    transport: "Transport Manager", health: "Director of Health Services",
    hostel: "Hall Warden"
  };
  return titleMap[this.type] || "Unit Head";
});

// Legacy compatibility
organizationalUnitSchema.virtual("category").get(function() { return this.derived_category; });
organizationalUnitSchema.virtual("head_title").get(function() { return this.effective_head_title; });

const OrganizationalUnit = mongoose.model("OrganizationalUnit", organizationalUnitSchema);

// 🔥 PREVENT DIRECT MODEL USAGE IN CONTROLLERS
// Export a proxy that warns on direct write attempts
const ModelProxy = new Proxy(OrganizationalUnit, {
  get(target, prop) {
    const writeMethods = ['create', 'insertMany', 'updateOne', 'updateMany', 
                          'findByIdAndUpdate', 'findOneAndUpdate', 'deleteOne', 
                          'deleteMany', 'findByIdAndDelete', 'findOneAndDelete'];
    
    if (writeMethods.includes(prop) && process.env.NODE_ENV === 'production') {
      console.warn(`⚠️ WARNING: Direct ${prop}() on OrganizationalUnit bypasses validation. Use UnitService instead.`);
    }
    
    return target[prop];
  }
});

export default process.env.NODE_ENV === 'production' ? ModelProxy : OrganizationalUnit;