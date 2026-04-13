/**
 * RANKING GENERATOR SERVICE
 * Orchestrates the complete ranking generation process
 */

import AppError from '../../errors/AppError.js';
import RankingSnapshot from '../models/RankingSnapshot.model.js';
import ScoreCalculator from './ScoreCalculator.js';
import DepartmentRanker from './DepartmentRanker.js';
import GlobalRanker from './GlobalRanker.js';
import { RANKING_CONSTANTS } from '../ranking.constants.js';
import { SYSTEM_USER_ID } from '../../../config/system.js';
import mongoose from 'mongoose';

class RankingGenerator {
    constructor(config = {}) {
        this.scoreCalculator = new ScoreCalculator(config.rules);
        this.departmentRanker = new DepartmentRanker();
        this.globalRanker = new GlobalRanker();

        this.generationLock = false;
        this.lastGeneration = null;
    }

    /**
     * Generate a complete ranking snapshot
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} - Generated snapshot
     */
    async generateSnapshot(options = {}) {
        // Prevent concurrent generation
        if (this.generationLock) {
            throw new AppError(
                'Ranking generation already in progress',
                409,
                'GENERATION_IN_PROGRESS'
            );
        }

        try {
            this.generationLock = true;

            const generationId = this.generateSnapshotId();
            console.log(`Starting ranking generation: ${generationId}`);

            // Determine period
            const period = options.period || RANKING_CONSTANTS.PERIOD.WEEKLY;
            const { year, week } = this.getCurrentPeriod();

            // Check if snapshot already exists
            const existing = await RankingSnapshot.findByWeek(year, week);
            if (existing && !options.force) {
                throw new AppError(
                    `Snapshot already exists for year ${year}, week ${week}`,
                    409,
                    'SNAPSHOT_EXISTS'
                );
            }

            // Step 1: Fetch and calculate scores
            const scores = await this.fetchAndCalculateScores(options);

            console.log(scores)
            // Step 2: Generate department rankings
            const departmentRankings = await this.generateDepartmentRankings(scores);

            // Step 3: Generate global rankings
            const globalTop = this.globalRanker.rankGlobal(
                departmentRankings.map(dept => dept.topStudents)
            );

            // Step 4: Calculate overall statistics
            const stats = this.calculateOverallStats(departmentRankings, globalTop);

            // Step 5: Create snapshot
            const snapshot = await this.createSnapshot({
                generationId,
                period,
                year,
                week,
                departmentRankings,
                globalTop,
                stats,
                options
            });

            this.lastGeneration = {
                id: generationId,
                timestamp: new Date(),
                snapshotId: snapshot._id,
                stats
            };

            console.log(`Ranking generation completed: ${generationId}`);
            return snapshot;

        } catch (error) {
            console.error('Ranking generation failed:', error);
            throw new AppError(
                `Failed to generate ranking snapshot: ${error.message}`,
                error.statusCode || 500,
                error.code || 'GENERATION_FAILED',
                error.metadata
            );
        } finally {
            this.generationLock = false;
        }
    }

    /**
     * Generate snapshot ID
     */
    generateSnapshotId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `snapshot_${timestamp}_${random}`;
    }

    /**
     * Get current year and week
     */
    getCurrentPeriod() {
        const now = new Date();
        const year = now.getFullYear();

        // Simple week calculation (for production, use ISO week)
        const start = new Date(year, 0, 1);
        const diff = now - start;
        const oneDay = 1000 * 60 * 60 * 24;
        const week = Math.ceil((diff / oneDay + start.getDay() + 1) / 7);

        return { year, week };
    }

    /**
     * Fetch student data and calculate scores
     */
    async fetchAndCalculateScores(options) {
        // In a real implementation, this would fetch from:
        // - Student service
        // - Academic records
        // - Attendance service
        // - Other data sources

        // For now, return mock data structure
        // This should be replaced with actual service calls
        const mockStudents = await this.getMockStudents(options);

        // Calculate scores for all students
        const scoreResults = await this.scoreCalculator.calculateBatch(mockStudents, {
            year: options.year,
            week: options.week,
            semester: options.semester
        });
        // console.log(scoreResults.scores)

        return this.groupScoresByDepartment(scoreResults.scores);
    }

    /**
     * Group scores by department
     */
    groupScoresByDepartment(scores) {
        const groups = {};

        scores.forEach(score => {
            const deptId = score.departmentId?.toString();
            if (!deptId) return;

            if (!groups[deptId]) {
                groups[deptId] = [];
            }

            groups[deptId].push({
                ...score,
                studentName: `Student ${score.studentId}` // Mock, replace with real
            });
        });

        return groups;
    }

    /**
     * Generate rankings for each department
     */
    async generateDepartmentRankings(scoresByDepartment) {
        const rankings = [];

        // For each department
        for (const [deptId, scores] of Object.entries(scoresByDepartment)) {
            try {
                const department = {
                    _id: deptId,
                    name: `Department ${deptId}` // Mock, replace with real
                };

                const ranking = this.departmentRanker.rankDepartment(scores, department);
                rankings.push(ranking);
            } catch (error) {
                console.error(`Failed to rank department ${deptId}:`, error);
                // Continue with other departments
            }
        }

        return rankings;
    }

    /**
     * Calculate overall statistics
     */
    calculateOverallStats(departmentRankings, globalTop) {
        const allStudents = departmentRankings.flatMap(dept => dept.topStudents);
        const scores = allStudents.map(s => s.totalScore);

        if (scores.length === 0) {
            return {
                totalStudents: 0,
                totalDepartments: 0,
                averageScore: 0,
                highestScore: 0,
                lowestScore: 0
            };
        }

        const totalScore = scores.reduce((sum, score) => sum + score, 0);

        return {
            totalStudents: allStudents.length,
            totalDepartments: departmentRankings.length,
            averageScore: Number((totalScore / scores.length).toFixed(2)),
            highestScore: Math.max(...scores),
            lowestScore: Math.min(...scores),
            globalTopCount: globalTop.length
        };
    }

    /**
     * Create and save the snapshot
     */
    async createSnapshot(data) {
        const { year, week, validFrom, validTo } = this.getValidityPeriod(data.year, data.week);

        const snapshotData = {
            snapshotId: data.generationId,
            period: data.period,
            year,
            week,
            validFrom,
            validTo,
            totalStudents: data.stats.totalStudents,
            totalDepartments: data.stats.totalDepartments,
            averageScore: data.stats.averageScore,
            globalTop: data.globalTop,
            departmentRankings: data.departmentRankings,
            status: RANKING_CONSTANTS.STATUS.ACTIVE,
            generatedBy: SYSTEM_USER_ID,
            generationSource: data.options.source || 'cron',
            notes: data.options.notes || null
        };

        const snapshot = new RankingSnapshot(snapshotData);
        return await snapshot.save();
        // return snapshot; // Marking 1
    }

    /**
     * Determine validity period for snapshot
     */
    getValidityPeriod(year, week) {
        // Calculate start of week (Monday)
        const date = new Date();
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday

        const monday = new Date(date.setDate(diff));
        monday.setHours(0, 0, 0, 0);

        // Sunday at 23:59:59
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        return {
            year,
            week,
            validFrom: monday,
            validTo: sunday
        };
    }

    /**
     * Mock student data (replace with real service calls)
     */
    async getMockStudents(options) {
        const departments = [
            new mongoose.Types.ObjectId(),
            new mongoose.Types.ObjectId(),
            new mongoose.Types.ObjectId()
        ];

        const students = [];

        for (let i = 1; i <= 100; i++) {
            const deptIndex = i % departments.length;
            const gpa = 2.5 + Math.random() * 2.5;
            const attendance = 70 + Math.random() * 30;

            students.push({
                _id: new mongoose.Types.ObjectId(), //  real ObjectId
                firstName: "Student",
                lastName: `${i}`,
                matricNumber: `MAT${String(i).padStart(6, "0")}`,
                departmentId: departments[deptIndex], //  ObjectId
                departmentName: `Department ${deptIndex + 1}`,
                gpa: Number(gpa.toFixed(2)),
                attendance: Number(attendance.toFixed(1)),
                extracurricular: Math.random() > 0.7,
                clubMembership: Math.random() > 0.5,
                volunteerHours: Math.floor(Math.random() * 20),
                awards: Math.random() > 0.8 ? ["Excellence"] : [],
                academicProbation: Math.random() > 0.9,
                deansList: gpa > 4.0
            });
        }

        return students;
    }

    /**
     * Get generation status
     */
    getStatus() {
        return {
            isLocked: this.generationLock,
            lastGeneration: this.lastGeneration,
            lockDuration: this.generationLock ? Date.now() - this.lockStart : null
        };
    }
}

export default RankingGenerator;