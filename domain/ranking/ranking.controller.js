/**
 * RANKING CONTROLLER
 * Handles HTTP requests for ranking domain
 */

import AppError from '../errors/AppError.js';
import rankingService from './ranking.service.js';
import { RANKING_CONSTANTS, RANKING_ERRORS } from './ranking.constants.js';
import departmentService from '../department/department.service.js';

/**
 * @desc    Get current ranking for authenticated student's department
 * @route   GET /api/v1/ranking/current
 * @access  Private (Student)
 */
export const getCurrentDepartmentRanking = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const department = await departmentService.getUserDepartment(studentId);
    // const departmentId = department._id
    const departmentId = "69846eb04489dfb654290af7"

    if (!departmentId) {
      throw new AppError(
        'Student must be assigned to a department',
        400,
        RANKING_ERRORS.INVALID_DEPARTMENT
      );
    }

    const ranking = await rankingService.getCurrentDepartmentRanking(departmentId);
    
    res.status(200).json({
      success: true,
      data: ranking,
      meta: {
        generatedAt: new Date(),
        isCurrent: true
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get global top 3 students
 * @route   GET /api/v1/ranking/global-top
 * @access  Private (Student, Lecturer, Admin)
 */
export const getGlobalTop = async (req, res, next) => {
  try {
    const topStudents = await rankingService.getGlobalTopRankings();
    
    res.status(200).json({
      success: true,
      data: topStudents,
      meta: {
        limit: RANKING_CONSTANTS.LIMITS.GLOBAL_TOP,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get ranking history for a department
 * @route   GET /api/v1/ranking/department/:departmentId/history
 * @access  Private (Student within department, Lecturer, Admin)
 */
export const getDepartmentHistory = async (req, res, next) => {
  try {
    const { departmentId } = req.params;
    const { 
      limit = 10, 
      offset = 0,
      startDate,
      endDate 
    } = req.query;

    // Authorization check (simplified)
    if (req.user.role === 'student' && req.user.department.toString() !== departmentId) {
      throw new AppError(
        'Students can only view their own department history',
        403,
        'UNAUTHORIZED_DEPARTMENT_ACCESS'
      );
    }

    const history = await rankingService.getDepartmentRankingHistory(departmentId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      startDate,
      endDate
    });

    res.status(200).json({
      success: true,
      data: history,
      meta: {
        departmentId,
        total: history.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get ranking history for authenticated student
 * @route   GET /api/v1/ranking/student/history
 * @access  Private (Student)
 */
export const getStudentHistory = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const { 
      limit = 20, 
      offset = 0,
      startDate,
      endDate 
    } = req.query;

    const history = await rankingService.getStudentRankingHistory(studentId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      startDate,
      endDate
    });

    res.status(200).json({
      success: true,
      data: history,
      meta: {
        studentId,
        total: history.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get ranking by specific week
 * @route   GET /api/v1/ranking/week/:year/:week
 * @access  Private (Student, Lecturer, Admin)
 */
export const getWeeklyRanking = async (req, res, next) => {
  try {
    const { year, week } = req.params;
    const { departmentId } = req.query;

    // Validate parameters
    const yearNum = parseInt(year);
    const weekNum = parseInt(week);
    
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > new Date().getFullYear()) {
      throw new AppError(
        'Invalid year parameter',
        400,
        RANKING_ERRORS.INVALID_PERIOD
      );
    }
    
    if (isNaN(weekNum) || weekNum < 1 || weekNum > 53) {
      throw new AppError(
        'Invalid week parameter (must be 1-53)',
        400,
        RANKING_ERRORS.INVALID_PERIOD
      );
    }

    // Authorization check for department-specific view
    if (departmentId && req.user.role === 'student') {
      if (req.user.department.toString() !== departmentId) {
        throw new AppError(
          'Students can only view their own department rankings',
          403,
          'UNAUTHORIZED_DEPARTMENT_ACCESS'
        );
      }
    }

    const ranking = await rankingService.getWeeklyRanking(yearNum, weekNum, departmentId);

    res.status(200).json({
      success: true,
      data: ranking,
      meta: {
        year: yearNum,
        week: weekNum,
        departmentId: departmentId || 'all',
        isCurrent: ranking.metadata?.isCurrent || false
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get department trend analysis
 * @route   GET /api/v1/ranking/department/:departmentId/trends
 * @access  Private (Lecturer, Admin, HOD)
 */
export const getDepartmentTrends = async (req, res, next) => {
  try {
    const { departmentId } = req.params;
    const { weeks = 12 } = req.query;

    // Authorization - only department members and admin
    const allowedRoles = ['admin', 'dean', 'hod', 'lecturer'];
    if (!allowedRoles.includes(req.user.role)) {
      if (req.user.role === 'student' && req.user.department.toString() !== departmentId) {
        throw new AppError(
          'Not authorized to view department trends',
          403,
          'UNAUTHORIZED_TREND_ACCESS'
        );
      }
    }

    const trends = await rankingService.getDepartmentTrendAnalysis(
      departmentId, 
      parseInt(weeks)
    );

    res.status(200).json({
      success: true,
      data: trends,
      meta: {
        departmentId,
        period: `${weeks} weeks`,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Trigger manual ranking generation (Admin only)
 * @route   POST /api/v1/ranking/generate
 * @access  Private (Admin)
 */
export const triggerGeneration = async (req, res, next) => {
  try {
    // Only admin can trigger manual generation
    if (req.user.role !== 'admin') {
      throw new AppError(
        'Only administrators can trigger ranking generation',
        403,
        'ADMIN_ONLY'
      );
    }

    const { force = false, notes } = req.body;
    
    const snapshot = await rankingService.generateRankingSnapshot({
      force,
      notes,
      source: 'manual',
      triggeredBy: req.user._id
    });

    res.status(202).json({
      success: true,
      message: 'Ranking generation started',
      data: {
        snapshotId: snapshot._id,
        generationId: snapshot.snapshotId,
        status: 'processing'
      },
      meta: {
        estimatedCompletion: '2-5 minutes',
        queuePosition: 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get generation status
 * @route   GET /api/v1/ranking/generation-status
 * @access  Private (Admin)
 */
export const getGenerationStatus = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      throw new AppError(
        'Only administrators can view generation status',
        403,
        'ADMIN_ONLY'
      );
    }

    const status = await rankingService.getGenerationStatus();

    res.status(200).json({
      success: true,
      data: status,
      meta: {
        checkedAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get ranking statistics
 * @route   GET /api/v1/ranking/stats
 * @access  Private (Admin, Dean, HOD)
 */
export const getRankingStats = async (req, res, next) => {
  try {
    const allowedRoles = ['admin', 'dean', 'hod'];
    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(
        'Not authorized to view ranking statistics',
        403,
        'UNAUTHORIZED_STATS_ACCESS'
      );
    }

    const stats = await rankingService.getRankingStatistics();

    res.status(200).json({
      success: true,
      data: stats,
      meta: {
        generatedAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};