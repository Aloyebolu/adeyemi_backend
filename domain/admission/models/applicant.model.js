import mongoose from "mongoose";

const applicantSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true
    },

    lastName: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      index: true
    },

    phone: {
      type: String,
      required: true
    },

    dateOfBirth: {
      type: Date,
      required: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("Applicant", applicantSchema);
