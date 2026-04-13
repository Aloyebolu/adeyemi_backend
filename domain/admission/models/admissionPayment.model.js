import mongoose from "mongoose";

const admissionPaymentSchema = new mongoose.Schema(
  {
    admissionApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdmissionApplication",
      required: true,
      unique: true
    },

    acceptanceFee: {
      amount: {
        type: Number,
        required: true
      },
      currency: {
        type: String,
        default: 'NGN'
      },
      paid: {
        type: Boolean,
        default: false
      },
      paidAt: {
        type: Date
      },
      transactionReference: {
        type: String,
        index: true
      },
      paymentMethod: {
        type: String,
        enum: ['card', 'bankTransfer', 'online']
      }
    },

    processingFee: {
      amount: {
        type: Number,
        required: true
      },
      currency: {
        type: String,
        default: 'NGN'
      },
      paid: {
        type: Boolean,
        default: false
      },
      paidAt: {
        type: Date
      },
      transactionReference: {
        type: String,
        index: true
      }
    },

    // Payment verification
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    verifiedAt: {
      type: Date
    },

    // Payment metadata
    paymentGatewayResponse: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

// Indexes
admissionPaymentSchema.index({ 'acceptanceFee.paid': 1 });
admissionPaymentSchema.index({ 'processingFee.paid': 1 });
admissionPaymentSchema.index({ createdAt: -1 });

export default mongoose.model("AdmissionPayment", admissionPaymentSchema);