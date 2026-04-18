import mongoose from "mongoose";

const staffSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },

    staffId: {
      type: String,
      unique: true,
      required: true,
    },

    employment_type: {
      type: String,
      enum: ["full_time", "part_time", "contract", "temporary"],
      default: "full_time",
      index: true
    },

    is_active: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

staffSchema.index({ is_active: 1 });

export const StaffModel = mongoose.model("Staff", staffSchema);