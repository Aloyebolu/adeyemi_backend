import mongoose from "mongoose";

const admissionApplicationSchema = new mongoose.Schema(
  {
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Applicant",
      required: true
    },

    admissionCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdmissionCycle",
      required: true
    },

    programmeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Programme",
      required: true
    },

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true
    },

    status: {
      type: String,
      enum: [
        "draft",
        "submitted",
        "underReview",
        "admitted",
        "rejected",
        "waitlisted"
      ],
      default: "draft"
    },

    score: {
      type: Number
    },

    submittedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

export default mongoose.model(
  "AdmissionApplication",
  admissionApplicationSchema
);
