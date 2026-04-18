// models/studentSuspension/studentSuspension.model.js
import mongoose from "mongoose";
import { SUSPENSION_STATUS, SUSPENSION_TYPES } from "./studentSuspension.constants.js";

const studentSuspensionSchema = new mongoose.Schema({
    student_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: Object.values(SUSPENSION_TYPES),
        required: true
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    start_date: {
        type: Date,
        required: true
    },
    end_date: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: Object.values(SUSPENSION_STATUS),
        default: SUSPENSION_STATUS.ACTIVE
    },
    is_active: {
        type: Boolean,
        default: true
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lifted_at: {
        type: Date
    },
    lifted_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Compound index for active suspensions
studentSuspensionSchema.index({ student_id: 1, is_active: 1 });

// Virtual for checking if expired
studentSuspensionSchema.virtual('is_expired').get(function() {
    return this.is_active && this.end_date && new Date(this.end_date) < new Date();
});

// Pre-save middleware to auto-update status
studentSuspensionSchema.pre('save', function(next) {
    if (this.is_expired && this.status === SUSPENSION_STATUS.ACTIVE) {
        this.is_active = false;
        this.status = SUSPENSION_STATUS.EXPIRED;
    }
    next();
});

const StudentSuspension = mongoose.model('StudentSuspension', studentSuspensionSchema);

export default StudentSuspension;