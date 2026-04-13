// computation/services/ReportService.js
import { resolveUserName } from "../../../utils/resolveUserName.js";
import { capitalizeFirstLetter } from "../../../utils/StringUtils.js";
import { queueNotification } from "../../../workers/department.queue.js";
import AppError from "../../errors/AppError.js";
import ComputationSummary from "../models/computation.model.js";

class ReportService {
    /**
     * Send HOD notification about computation completion with level-based details
     * @param {Object} department - Department object
     * @param {Object} semester - Semester object
     * @param {Object} summary - Computation summary (with level-based data)
     */
    async sendHODNotification(department, semester, summary, programme) {
        if (!department.hod) return;

        // Convert Map fields if necessary
        const studentListsByLevel = this.convertMapToObject(summary.studentListsByLevel);
        const summaryOfResultsByLevel = this.convertMapToObject(summary.summaryOfResultsByLevel);
        const carryoverStatsByLevel = this.convertMapToObject(summary.carryoverStatsByLevel);

        // Build level-wise statistics
        const levelStats = [];
        for (const [level, levelData] of Object.entries(summaryOfResultsByLevel || {})) {
            if (levelData) {
                levelStats.push({
                    level,
                    students: levelData.totalStudents || 0,
                    averageGPA: levelData.gpaStatistics?.average || 0,
                    passCount: studentListsByLevel[level]?.passList?.length || 0,
                    probationCount: studentListsByLevel[level]?.probationList?.length || 0,
                    carryoverCount: carryoverStatsByLevel[level]?.totalCarryovers || 0
                });
            }
        }

        // Sort levels numerically
        levelStats.sort((a, b) => parseInt(a.level) - parseInt(b.level));

        // Build level-wise summary message
        let levelSummaryMessage = "";
        if (levelStats.length > 0) {
            levelSummaryMessage = "\n\n📊 LEVEL-WISE BREAKDOWN:\n";
            levelStats.forEach(stat => {
                levelSummaryMessage += `Level ${stat.level}: ${stat.students} students | Avg GPA: ${stat.averageGPA.toFixed(2)} | Pass: ${stat.passCount} | Probation: ${stat.probationCount} | Carryovers: ${stat.carryoverCount}\n`;
            });
        }

        const message = `📊 RESULTS COMPUTATION COMPLETE - Department: ${department.name}, Programme: ${programme.name}
      
${capitalizeFirstLetter(semester.name)} Semester
Processed: ${summary.studentsWithResults}/${summary.totalStudents} students
Overall Average GPA: ${summary.averageGPA?.toFixed(2) || '0.00'}
Highest GPA: ${summary.highestGPA?.toFixed(2) || '0.00'}
Lowest GPA: ${summary.lowestGPA?.toFixed(2) || '0.00'}
${levelSummaryMessage}
🎓 OVERALL STUDENT LISTS:
Passed: ${summary.passList?.length || 0} students
Probation: ${summary.probationList?.length || 0} students
Withdrawal: ${summary.withdrawalList?.length || 0} students
Termination: ${summary.terminationList?.length || 0} students

📚 CARRYOVER ANALYSIS:
Total Carryovers: ${summary.carryoverStats?.totalCarryovers || 0}
Affected Students: ${summary.carryoverStats?.affectedStudentsCount || 0}

⚠️ FAILED PROCESSING: ${summary.failedStudents?.length || 0}
${summary.failedStudents?.length > 0 ? 'Check dashboard for details' : 'All students processed successfully'}

View detailed report in the dashboard.`;

        await queueNotification(
            "hod",
            department.hod,
            "department_results_computed",
            message,
            {
                department: department.name,
                semester: semester.name,
                summaryId: summary._id,
                passListCount: summary.passList?.length || 0,
                probationListCount: summary.probationList?.length || 0,
                withdrawalListCount: summary.withdrawalList?.length || 0,
                terminationListCount: summary.terminationList?.length || 0,
                totalCarryovers: summary.carryoverStats?.totalCarryovers || 0,
                affectedStudentsCount: summary.carryoverStats?.affectedStudentsCount || 0,
                averageGPA: summary.averageGPA?.toFixed(2) || '0.00',
                levelStats: JSON.stringify(levelStats),
                isPreview: summary.isPreview || false,
                purpose: summary.purpose || 'final'
            }
        );

        console.log(`✅ HOD notification sent for ${department.name} - ${semester.name}`);
    }






    /**
     * Helper function to convert Map to object
     * @param {Map|Object} mapField - Field that might be a Map or already an object
     * @returns {Object} Regular JavaScript object
     */
    convertMapToObject(mapField) {
        if (!mapField) return {};

        // If it's already an object, return it
        if (typeof mapField === 'object' && !(mapField instanceof Map)) {
            return mapField;
        }

        // If it's a Map, convert to object
        if (mapField instanceof Map) {
            const obj = {};
            mapField.forEach((value, key) => {
                obj[key] = value;
            });
            return obj;
        }

        return {};
    }

    /**
     * Send batch notifications to multiple HODs about computation completion
     * @param {Array} departmentSummaries - Array of {department, semester, summary}
     */
    async sendBatchHODNotifications(departmentSummaries) {
        const notificationPromises = departmentSummaries.map(async ({ department, semester, summary }) => {
            try {
                await this.sendHODNotification(department, semester, summary);
            } catch (error) {
                console.error(`Failed to send HOD notification for ${department.name}:`, error);
                return { success: false, department: department.name, error: error.message };
            }
            return { success: true, department: department.name };
        });

        const results = await Promise.allSettled(notificationPromises);

        const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.success)).length;

        console.log(`✅ Sent ${successful} HOD notifications, ${failed} failed`);

        return {
            total: departmentSummaries.length,
            successful,
            failed,
            details: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message || 'Unknown error' })
        };
    }


    /**
     * Build admin summary message
     * @param {Object} masterComputation - Master computation
     * @param {Array} departmentSummaries - Department summaries
     * @returns {string} Admin message
     */
    buildAdminSummaryMessage(masterComputation, departmentSummaries) {
        const semesterName = masterComputation.semester?.name || 'Unknown Semester';
        const academicYear = masterComputation.semester?.session || 'Unknown Year';

        let message = `🏫 UNIVERSITY-WIDE RESULTS COMPUTATION SUMMARY
      
${semesterName} ${academicYear}
Total Departments: ${masterComputation.totalDepartments}
Processed Departments: ${masterComputation.departmentsProcessed}
Overall Average GPA: ${masterComputation.overallAverageGPA?.toFixed(2) || '0.00'}
Total Students: ${masterComputation.totalStudents || 0}
Total Carryovers: ${masterComputation.totalCarryovers || 0}
Failed Students: ${masterComputation.totalFailedStudents || 0}

📋 DEPARTMENT SUMMARY:\n`;

        // Add department breakdown
        departmentSummaries.forEach((summary, index) => {
            const deptName = summary.department?.name || `Department ${index + 1}`;
            const status = summary.status === 'completed_with_errors' ? '⚠️ With Errors' : '✅ Completed';

            message += `${index + 1}. ${deptName}: ${status}
   Students: ${summary.studentsWithResults || 0}/${summary.totalStudents || 0}
   Avg GPA: ${summary.averageGPA?.toFixed(2) || '0.00'}
   Carryovers: ${summary.carryoverStats?.totalCarryovers || 0}
   Failed: ${summary.failedStudents?.length || 0}\n`;
        });

        message += "\nView detailed reports in the administration dashboard.";

        return message;
    }
}

export default new ReportService();