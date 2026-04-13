/**
 * SCORE CALCULATOR SERVICE
 * Calculates ranking scores from raw student data
 */

import AppError from '../../errors/AppError.js';
import RankingRules from '../ranking.rules.js';
import RankingScore from '../models/RankingScore.model.js';

class ScoreCalculator {
  constructor(rulesConfig = {}) {
    this.rulesEngine = new RankingRules(rulesConfig);
    this.cache = new Map();
  }

  /**
   * Calculate scores for a batch of students
   * @param {Array} students - Array of student objects
   * @param {Object} context - Calculation context
   * @returns {Promise<Array>} - Array of calculated scores
   */
  async calculateBatch(students, context = {}) {
    try {
      if (!Array.isArray(students) || students.length === 0) {
        throw new AppError('No students provided for scoring', 400, 'NO_STUDENTS');
      }

      const results = [];
      const errors = [];

      for (const student of students) {
        try {
          const score = await this.calculateForStudent(student, context);
          results.push(score);
        } catch (error) {
          errors.push({
            studentId: student._id,
            error: error.message
          });
          // Continue with other students
          console.error(`Failed to calculate score for student ${student._id}:`, error);
        }
      }

      if (errors.length > 0 && results.length === 0) {
        throw new AppError(
          'Failed to calculate scores for all students',
          500,
          'BATCH_CALCULATION_FAILED',
          { errors }
        );
      }

      return {
        scores: results,
        total: results.length,
        errors: errors.length,
        errorDetails: errors
      };
    } catch (error) {
      throw new AppError(
        `Batch calculation failed: ${error.message}`,
        error.statusCode || 500,
        error.code || 'CALCULATION_ERROR',
        error.metadata
      );
    }
  }

  /**
   * Calculate score for a single student
   * @param {Object} student - Student data
   * @param {Object} context - Calculation context
   * @returns {Promise<Object>} - Score object
   */
  async calculateForStudent(student, context = {}) {
    try {
      // Validate student data
      if (!student || !student._id) {
        throw new AppError('Invalid student data', 400, 'INVALID_STUDENT');
      }

      // Check cache first (useful for batch operations)
      const cacheKey = `${student._id}_${JSON.stringify(context)}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // Fetch additional data if needed
      const enrichedStudent = await this.enrichStudentData(student, context);

      // Calculate score using rules engine
      const scoreResult = this.rulesEngine.calculateScore(enrichedStudent, context);

      // Create score document
      const scoreData = {
        studentId: student._id,
        departmentId: student.departmentId || context.departmentId,
        matricNo : student.matricNumber || student.matric_no,
        departmentName: student.departmentName || context.department?.name,
        year: context.year || new Date().getFullYear(),
        week: context.week || this.getCurrentWeek(),
        semester: context.semester,
        totalScore: scoreResult.total,
        gpa: enrichedStudent.gpa || 0,
        attendance: enrichedStudent.attendance || 0,
        breakdown: scoreResult.breakdown,
        calculatedAt: new Date(),
        dataSources: this.getDataSources(enrichedStudent),
        version: '1.0.0'
      };

      // Cache result
      this.cache.set(cacheKey, scoreData);

      return scoreData;
    } catch (error) {
      throw new AppError(
        `Failed to calculate score for student ${student._id}: ${error.message}`,
        error.statusCode || 500,
        error.code || 'STUDENT_CALCULATION_ERROR',
        { studentId: student._id }
      );
    }
  }

  /**
   * Enrich student data with additional information
   */
  async enrichStudentData(student, context) {
    // This is where you'd fetch additional data from other services
    // For now, return the student as-is or with basic enrichment
    
    const enriched = { ...student };

    // Add department information if available
    if (context.department) {
      enriched.departmentName = context.department.name;
      enriched.faculty = context.department.faculty;
    }

    // Add GPA if not present (placeholder)
    if (!enriched.gpa && student.metrics) {
      enriched.gpa = student.metrics.gpa || 0;
    }

    // Add attendance if not present (placeholder)
    if (!enriched.attendance && student.metrics) {
      enriched.attendance = student.metrics.attendancePercentage || 0;
    }

    return enriched;
  }

  /**
   * Get current ISO week number
   */
  getCurrentWeek() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    
    // Thursday in current week decides the year
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    
    // January 4 is always in week 1
    const week1 = new Date(date.getFullYear(), 0, 4);
    
    // Adjust to Thursday in week 1 and count number of weeks
    const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    
    return weekNumber;
  }

  /**
   * Track data sources for audit purposes
   */
  getDataSources(student) {
    const sources = [];
    
    if (student.gpa !== undefined) sources.push('academic_records');
    if (student.attendance !== undefined) sources.push('attendance');
    if (student.extracurricular || student.clubMembership) sources.push('student_activities');
    if (student.publications || student.researchProjects) sources.push('research');
    
    return sources;
  }

  /**
   * Clear the calculation cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Update the rules engine configuration
   */
  updateRules(config) {
    this.rulesEngine = new RankingRules(config);
    this.clearCache();
  }
}

export default ScoreCalculator;