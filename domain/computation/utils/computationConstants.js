// computation/utils/computationConstants.js

export const ACADEMIC_RULES = {
  PROBATION_THRESHOLD: 1.00,
  TERMINATION_THRESHOLD: 1.00,
  PROBATION_SEMESTER_LIMIT: 2,
  CARRYOVER_LIMIT: 5,
  EXCELLENT_GPA: 4.50,
  GOOD_GPA: 2.00,
  BATCH_SIZE: 100,
  NOTIFICATION_BATCH_SIZE: 50
};

export const GRADE_POINTS = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1, 
  F: 0
};

export const GRADE_BOUNDARIES = {
  A: 70,
  B: 60,
  C: 50,
  D: 45,
  E: 40,
  F: 0
};

export const COMPUTATION_STATUS = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  COMPLETED_WITH_ERRORS: 'completed_with_errors',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

export const STUDENT_STATUS = {
  NONE: 'none',
  PROBATION: 'probation',
  PROBATION_LIFTED: 'probation_lifted',
  WITHDRAWN: 'withdrawn',
  TERMINATED: 'terminated',
  SUSPENDED: 'suspended'
};

export const REMARK_CATEGORIES = {
  EXCELLENT: 'excellent',
  GOOD: 'good',
  PROBATION: 'probation',
  WITHDRAWN: 'withdrawn',
  TERMINATED: 'terminated'
};

export const SUSPENSION_REASONS = {
  NO_REGISTRATION: "NO_REGISTRATION",
  SCHOOL_APPROVED: 'SCHOOL_APPROVED',
  NO_REGISTRATION_LIFTED: "NO_REGISTRATION_LIFTED",

}

export const BATCH_SIZE = 900;
export const NOTIFICATION_BATCH_SIZE = 1000;

// New constants for grade system
export const GRADES = {
  A: 'A',
  B: 'B', 
  C: 'C',
  D: 'D',
  E: 'E',
  F: 'F'
};

export const PASSING_GRADES = ['A', 'B', 'C', 'D', 'E']; 
export const FAILING_GRADE = 'F';

export const DEGREE_CLASS = {
  FIRST_CLASS: {
    label: "First Class",
    min_gpa: 4.5
  },
  SECOND_CLASS_UPPER: {
    label: "Second Class Upper",
    min_gpa: 3.5
  },
  SECOND_CLASS_LOWER: {
    label: "Second Class Lower",
    min_gpa: 2.5
  },
  THIRD_CLASS: {
    label: "Third Class",
    min_gpa: 1.0
  },
  FAIL: {
    label: "Fail",
    min_gpa: 0
  }
};
