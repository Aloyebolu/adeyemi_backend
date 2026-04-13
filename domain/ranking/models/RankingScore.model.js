/**
 * RANKING SCORE MODEL
 * Raw scores used for snapshot generation
 * Can be recalculated if needed
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const rankingScoreSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true
    },

    // Time period
    year: {
      type: Number,
      required: true,
      index: true
    },

    week: {
      type: Number,
      required: true,
      index: true
    },

    semester: {
      type: String,
      index: true
    },

    // Scores
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

    attendance: {
      type: Number,
      min: 0,
      max: 100
    },

    // Score breakdown
    breakdown: {
      type: Map,
      of: Number
    },

    // Ranking positions
    globalRank: {
      type: Number,
      min: 1
    },

    departmentRank: {
      type: Number,
      min: 1
    },

    // Metadata
    calculatedAt: {
      type: Date,
      default: Date.now,
      index: true
    },

    dataSources: {
      type: [String],
      default: []
    },

    version: {
      type: String,
      default: '1.0.0'
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for fast queries
rankingScoreSchema.index({ year: 1, week: 1, departmentId: 1 });
rankingScoreSchema.index({ year: 1, week: 1, totalScore: -1 });
rankingScoreSchema.index({ studentId: 1, year: 1, week: 1 }, { unique: true });
rankingScoreSchema.index({ departmentId: 1, year: 1, week: 1, totalScore: -1 });

// Virtuals
rankingScoreSchema.virtual('student', {
  ref: 'User',
  localField: 'studentId',
  foreignField: '_id',
  justOne: true
});

rankingScoreSchema.virtual('department', {
  ref: 'Department',
  localField: 'departmentId',
  foreignField: '_id',
  justOne: true
});

const RankingScore = mongoose.model('RankingScore', rankingScoreSchema);

export default RankingScore;