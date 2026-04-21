import { DB } from "#config/db-contract.js";
import mongoose from "mongoose";

const OrganizationalUnitMemberSchema = new mongoose.Schema(
  {
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: DB.OrganizationalUnit.MODEL,
      required: true,
      index: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    role: {
      type: String,
      required: true,
      enum: ["HEAD", "DEPUTY", "STAFF", "ASSISTANT", "OFFICER"],
      index: true
    },

    title: {
      type: String,
      trim: true
    },

    responsibilities: [{
      type: String,
      trim: true
    }],

    is_active: {
      type: Boolean,
      default: true,
      index: true
    },

    start_date: {
      type: Date,
      default: Date.now
    },

    end_date: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// A user can only be an active member of a specific unit ONCE
OrganizationalUnitMemberSchema.index(
  { unit: 1, user: 1 }, 
  { unique: true, partialFilterExpression: { is_active: true } }
);

// Compound indexes
OrganizationalUnitMemberSchema.index({ unit: 1, role: 1 });
OrganizationalUnitMemberSchema.index({ unit: 1, is_active: 1 });
OrganizationalUnitMemberSchema.index({ user: 1, is_active: 1 });

// Virtual: Check if membership is current
OrganizationalUnitMemberSchema.virtual("is_current").get(function() {
  return this.is_active && (!this.end_date || this.end_date > new Date());
});

// Pre-save hook: Ensure only ONE active HEAD per unit
OrganizationalUnitMemberSchema.pre("save", async function(next) {
  if (this.role === "HEAD" && this.is_active) {
    const existingHead = await this.constructor.findOne({
      unit: this.unit,
      role: "HEAD",
      is_active: true,
      _id: { $ne: this._id }
    });
    
    if (existingHead) {
      throw new Error(`Unit already has an active HEAD: ${existingHead.title || existingHead._id}`);
    }
  }
  next();
});

// Pre-save hook: Sync unit.head reference when HEAD is added/removed
OrganizationalUnitMemberSchema.post("save", async function(doc) {
  const OrganizationalUnit = mongoose.model(DB.OrganizationalUnit.MODEL);
  
  if (doc.role === "HEAD" && doc.is_active) {
    // Set this user as the unit's head
    await OrganizationalUnit.findByIdAndUpdate(doc.unit, { head: doc.user });
  }
});

OrganizationalUnitMemberSchema.post("findOneAndUpdate", async function(doc) {
  if (!doc) return;
  
  const OrganizationalUnit = mongoose.model(DB.OrganizationalUnit.MODEL);
  
  if (doc.role === "HEAD" && doc.is_active) {
    await OrganizationalUnit.findByIdAndUpdate(doc.unit, { head: doc.user });
  } else if (doc.role !== "HEAD" || !doc.is_active) {
    // If this member is no longer HEAD, check if unit.head still points to them
    const unit = await OrganizationalUnit.findById(doc.unit);
    if (unit && unit.head.toString() === doc.user.toString()) {
      // Find another HEAD or set to null
      const otherHead = await this.constructor.findOne({
        unit: doc.unit,
        role: "HEAD",
        is_active: true,
        _id: { $ne: doc._id }
      });
      
      await OrganizationalUnit.findByIdAndUpdate(doc.unit, { 
        head: otherHead ? otherHead.user : null 
      });
    }
  }
});
 const OrganizationalUnitMember = mongoose.model(DB.OrganizationalUnitMember.MODEL, OrganizationalUnitMemberSchema);
 export default OrganizationalUnitMember