/**
 * RANKING SNAPSHOT MODEL
 * Immutable weekly snapshot of rankings
 * DO NOT modify existing snapshots - create new ones
 */

import mongoose from 'mongoose';
import AppError from '../../errors/AppError.js';
import { SYSTEM_USER_ID } from '../../../config/system.js';
import { RANKING_CONSTANTS } from '../ranking.constants.js';

const { Schema } = mongoose;

const rankingSnapshotSchema = new Schema(
  {
    // Identification
    snapshotId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true
    },

    // Time period
    period: {
      type: String,
      enum: Object.values(RANKING_CONSTANTS.PERIOD),
      default: RANKING_CONSTANTS.PERIOD.WEEKLY,
      required: true,
      immutable: true
    },

    year: {
      type: Number,
      required: true,
      immutable: true
    },

    week: {
      type: Number, // ISO week number (1-53)
      required: true,
      immutable: true
    },

    semester: {
      type: String,
      default: null,
      immutable: true
    },

    // Snapshot metadata
    generatedAt: {
      type: Date,
      default: Date.now,
      immutable: true
    },

    validFrom: {
      type: Date,
      required: true,
      immutable: true
    },

    validTo: {
      type: Date,
      required: true,
      immutable: true
    },

    // Statistics
    totalStudents: {
      type: Number,
      required: true,
      min: 0,
      immutable: true
    },

    totalDepartments: {
      type: Number,
      required: true,
      min: 0,
      immutable: true
    },

    averageScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      immutable: true
    },

    // Rankings data (embedded for performance)
    globalTop: [
      {
        rank: {
          type: Number,
          required: true,
          min: 1
        },
        studentId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        studentName: {
          type: String,
          required: true
        },
        matricNo: {
          type: String,
          required: true
        },
        departmentId: {
          type: Schema.Types.ObjectId,
          ref: 'Department',
          required: true
        },
        departmentName: {
          type: String,
          required: true
        },
        totalScore: {
          type: Number,
          required: true,
          min: 0,
          max: 100
        },
        gpa: {
          type: Number,
          min: 0,
          max: 5.0
        },
        breakdown: {
          type: Map,
          of: Number
        }
      }
    ],

    departmentRankings: [
      {
        departmentId: {
          type: Schema.Types.ObjectId,
          ref: 'Department',
          required: true
        },
        departmentName: {
          type: String,
          required: true
        },
        topStudents: [
          {
            rank: {
              type: Number,
              required: true,
              min: 1
            },
            studentId: {
              type: Schema.Types.ObjectId,
              ref: 'User',
              required: true
            },
            studentName: String,
            matricNo: String,
            totalScore: {
              type: Number,
              required: true,
              min: 0,
              max: 100
            },
            gpa: Number
          }
        ],
        departmentStats: {
          averageScore: Number,
          totalStudents: Number,
          highestScore: Number,
          lowestScore: Number
        }
      }
    ],

    // System fields
    status: {
      type: String,
      enum: Object.values(RANKING_CONSTANTS.STATUS),
      default: RANKING_CONSTANTS.STATUS.ACTIVE,
      index: true
    },

    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: () => new mongoose.Types.ObjectId(SYSTEM_USER_ID),
      immutable: true
    },

    generationSource: {
      type: String,
      enum: ['cron', 'manual', 'migration', 'api', 'initialization'],
      default: 'cron',
      immutable: true
    },

    notes: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    // Optimize for read performance
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for fast queries
rankingSnapshotSchema.index({ year: 1, week: 1 }, { unique: true });
rankingSnapshotSchema.index({ status: 1, validTo: -1 });
rankingSnapshotSchema.index({ 'globalTop.studentId': 1 });
rankingSnapshotSchema.index({ 'departmentRankings.departmentId': 1 });
rankingSnapshotSchema.index({ generatedAt: -1 });

// Virtual for easy date range queries
rankingSnapshotSchema.virtual('isCurrent').get(function() {
  const now = new Date();
  return now >= this.validFrom && now <= this.validTo;
});

// Prevent updates to immutable snapshots
rankingSnapshotSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function(next) {
  const update = this.getUpdate();
  
  // Block all updates except status and notes
  const allowedUpdates = ['status', 'notes', 'updatedAt'];
  const attemptedUpdates = Object.keys(update);
  
  const illegalUpdates = attemptedUpdates.filter(
    field => !allowedUpdates.includes(field) && !field.startsWith('$')
  );
  
  if (illegalUpdates.length > 0) {
    return next(new AppError(
      `Cannot update immutable snapshot fields: ${illegalUpdates.join(', ')}`,
      400,
      'SNAPSHOT_IMMUTABLE'
    ));
  }
  
  next();
});

// Prevent deletion
rankingSnapshotSchema.pre('deleteOne', function(next) {
  const id = this.getQuery()?._id;
  
  if (id) {
    return next(new AppError(
      'Ranking snapshots cannot be deleted. Use archival instead.',
      400,
      'SNAPSHOT_INDELIBLE'
    ));
  }
  
  next();
});

// Static method to get current snapshot
rankingSnapshotSchema.statics.getCurrentSnapshot = function() {
  const now = new Date();
  return this.findOne({
    status: RANKING_CONSTANTS.STATUS.ACTIVE,
    validFrom: { $lte: now },
    validTo: { $gte: now }
  }).sort({ validFrom: -1 });
};

// Static method to get snapshot by week
rankingSnapshotSchema.statics.findByWeek = function(year, week) {
  return this.findOne({
    year,
    week,
    status: RANKING_CONSTANTS.STATUS.ACTIVE
  });
};

const RankingSnapshot = mongoose.model('RankingSnapshot', rankingSnapshotSchema);

export default RankingSnapshot;