import mongoose from "mongoose";

const admissionAcceptanceSchema = new mongoose.Schema(
  {
    admissionApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdmissionApplication",
      required: true,
      unique: true
    },

    accepted: {
      type: Boolean,
      required: true
    },

    acceptedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

export default mongoose.model(
  "AdmissionAcceptance",
  admissionAcceptanceSchema
);
