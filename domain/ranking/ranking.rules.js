/**
 * RANKING RULES ENGINE
 * Abstract scoring logic that can be modified without schema changes
 * All scoring rules are configurable and extensible
 */

import AppError from '../errors/AppError.js';
import { RANKING_CONSTANTS } from './ranking.constants.js';

class RankingRules {
  constructor(config = {}) {
    this.weights = {
      ...RANKING_CONSTANTS.DEFAULT_WEIGHTS,
      ...config.weights
    };
    
    this.rules = config.rules || this.getDefaultRules();
    this.validateWeights();
  }

  /**
   * Validate that weights sum to 1 (100%)
   */
  validateWeights() {
    const total = Object.values(this.weights).reduce((sum, weight) => sum + weight, 0);
    
    // Allow slight tolerance for floating point arithmetic
    if (Math.abs(total - 1) > 0.0001) {
      throw new AppError(
        `Scoring weights must sum to 1. Current sum: ${total}`,
        500,
        'RANKING_RULES_INVALID'
      );
    }
  }

  /**
   * Default scoring rules
   */
  getDefaultRules() {
    return {
      gpa: (student) => {
        // Normalize GPA to 0-100 scale (assuming 5.0 scale)
        if (!student.gpa || student.gpa < 0) return 0;
        return (student.gpa / 5.0) * 100;
      },

      attendance: (student) => {
        if (!student.attendance || student.attendance < 0) return 0;
        // attendance should be percentage (0-100)
        return Math.min(Math.max(student.attendance, 0), 100);
      },

      participation: (student) => {
        // Example: participation score from various activities
        let score = 50; // base score
        
        if (student.extracurricular) score += 10;
        if (student.clubMembership) score += 10;
        if (student.volunteerHours > 10) score += 10;
        if (student.awards) score += student.awards.length * 5;
        
        return Math.min(score, 100);
      },

      extraCredit: (student) => {
        // Additional credits (research, publications, etc.)
        let score = 0;
        
        if (student.publications) score += student.publications * 15;
        if (student.researchProjects) score += student.researchProjects * 10;
        if (student.patents) score += student.patents * 20;
        
        return Math.min(score, 100);
      }
    };
  }

  /**
   * Calculate total score for a student
   * @param {Object} student - Student data object
   * @param {Object} context - Additional context (department, semester, etc.)
   * @returns {Object} - Score breakdown and total
   */
  calculateScore(student, context = {}) {
    try {
      const scores = {};
      let total = 0;

      // Calculate each component score
      for (const [component, weight] of Object.entries(this.weights)) {
        if (this.rules[component]) {
          const componentScore = this.rules[component](student, context);
          scores[component] = componentScore;
          total += componentScore * weight;
        }
      }

      // Apply any bonus/penalty rules
      const adjusted = this.applyAdjustments(total, student, context);
      
      return {
        total: Math.min(Math.max(adjusted, 0), 100), // Clamp to 0-100
        breakdown: scores,
        rawTotal: total,
        timestamp: new Date(),
        metadata: {
          weights: this.weights,
          rulesVersion: '1.0.0',
          context
        }
      };
    } catch (error) {
      throw new AppError(
        `Failed to calculate ranking score: ${error.message}`,
        500,
        'SCORE_CALCULATION_ERROR',
        { studentId: student._id, error: error.message }
      );
    }
  }

  /**
   * Apply any bonus or penalty adjustments
   */
  applyAdjustments(baseScore, student, context) {
    let adjusted = baseScore;

    // Academic probation penalty
    if (student.academicProbation) {
      adjusted -= 15;
    }

    // Dean's list bonus
    if (student.deansList) {
      adjusted += 5;
    }

    // Department-specific bonuses
    if (context.department && context.department.bonusRules) {
      adjusted = context.department.bonusRules(adjusted, student);
    }

    return adjusted;
  }

  /**
   * Add or override a scoring rule
   * @param {string} component - Component name (gpa, attendance, etc.)
   * @param {Function} ruleFunction - Scoring function
   */
  addRule(component, ruleFunction) {
    if (typeof ruleFunction !== 'function') {
      throw new AppError(
        'Rule must be a function',
        400,
        'INVALID_RULE_FUNCTION'
      );
    }
    
    this.rules[component] = ruleFunction;
  }

  /**
   * Update component weight
   * @param {string} component - Component name
   * @param {number} weight - New weight (0-1)
   */
  updateWeight(component, weight) {
    if (weight < 0 || weight > 1) {
      throw new AppError(
        'Weight must be between 0 and 1',
        400,
        'INVALID_WEIGHT'
      );
    }

    this.weights[component] = weight;
    this.validateWeights();
  }
}

export default RankingRules;