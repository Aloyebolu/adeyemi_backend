import mongoose from "mongoose";

const admissionDecisionSchema = new mongoose.Schema(
  {
    admissionApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdmissionApplication",
      required: true
    },

    decision: {
      type: String,
      enum: ["admitted", "rejected", "waitlisted"],
      required: true
    },

    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    notes: {
      type: String
    },

    decisionDate: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export default mongoose.model(
  "AdmissionDecision",
  admissionDecisionSchema
);
