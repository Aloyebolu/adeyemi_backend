/**
 * RANKING DOMAIN CONSTANTS
 * All constants and configuration for ranking system
 */

export const RANKING_CONSTANTS = Object.freeze({
  // Ranking periods
  PERIOD: {
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    SEMESTER: 'semester'
  },

  // Scoring weights (can be overridden via config)
  DEFAULT_WEIGHTS: {
    GPA: 0.60,           // 60% weight
    ATTENDANCE: 0.25,    // 25% weight
    PARTICIPATION: 0.10, // 10% weight
    EXTRA_CREDIT: 0.05   // 5% weight
  },

  // Status
  STATUS: {
    ACTIVE: 'active',
    ARCHIVED: 'archived',
    PENDING: 'pending'
  },

  // Scope
  SCOPE: {
    DEPARTMENT: 'department',
    FACULTY: 'faculty',
    UNIVERSITY: 'university'
  },

  // Ranking limits
  LIMITS: {
    GLOBAL_TOP: 3,
    DEPARTMENT_TOP: 10,
    DEFAULT_PAGE_SIZE: 20,
    MAX_WEEKS_HISTORY: 52 // 1 year
  },

  // Snapshot configuration
  SNAPSHOT: {
    RETENTION_DAYS: 365, // Keep snapshots for 1 year
    AUTO_GENERATE: true,
    GENERATION_DAY: 0, // Sunday (0-6 where 0 is Sunday)
    GENERATION_HOUR: 23, // 11 PM
    GENERATION_MINUTE: 59
  }
});

export const RANKING_ERRORS = Object.freeze({
  INVALID_DEPARTMENT: 'INVALID_DEPARTMENT',
  NO_STUDENT_DATA: 'NO_STUDENT_DATA',
  SNAPSHOT_NOT_FOUND: 'SNAPSHOT_NOT_FOUND',
  GENERATION_IN_PROGRESS: 'GENERATION_IN_PROGRESS',
  INVALID_PERIOD: 'INVALID_PERIOD'
});