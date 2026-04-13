// src/modules/ai/config/query.limits.js

export const QUERY_LIMITS = {
  // Document limits
  defaultLimit: 1000,
  maxLimit: 10000,
  analysisLimit: 500,
  exportLimit: 50000,
  
  // Time limits (ms)
  timeout: 30000, // 30 seconds
  analysisTimeout: 60000, // 1 minute
  exportTimeout: 300000, // 5 minutes
  
  // Display thresholds
  tableThreshold: 20,     // Show as table if <= 20 rows
  summaryThreshold: 50,   // Show summary if <= 50 rows
  exportThreshold: 100,   // Auto-export if > 100 rows
  analysisThreshold: 500, // Max rows for analysis
  
  // Performance
  cacheTTL: 300000, // 5 minutes
  maxConcurrentQueries: 10,
  
  // Index hints
  indexHints: {
    users: ['email_1', 'role_1', 'department_1'],
    students: ['matricNo_1', 'programmeId_1', 'level_1'],
    lecturers: ['staffId_1', 'departmentId_1'],
    courses: ['code_1', 'departmentId_1'],
  },
  
  // Expensive operations
  expensiveOperations: {
    $lookup: { warning: 'Joins can be slow on large datasets' },
    $group: { warning: 'Group operations require indexes' },
    $unwind: { warning: 'Unwind can be memory intensive' },
    $regex: { warning: 'Regex without index can be slow' },
  },
  
  // Aggregation stage limits
  maxPipelineStages: 20,
  maxLookupStages: 3,
  maxFacetStages: 5,
};

export default QUERY_LIMITS;