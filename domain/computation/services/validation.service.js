// validation.service.js
import mongoose from "mongoose";
import Result from "#domain/result/result.model.js";
import CourseRegistration from "#domain/course/courseRegistration.model.js";
import Student from "#domain/user/student/student.model.js";
import Course from "#domain/course/course.model.js";
import Programme from "#domain/programme/programme.model.js";
import connectToDB from "#config/db.js";
import { normalizeCourse } from "#domain/course/course.normallizer.js";
import { buildProgrammeFullName } from "#utils/helpers.js";

class ValidationService {
    /**
     * Main validation function - comprehensive check for a programme
     * @param {string} programmeId - Programme ID to validate
     * @param {Object} options - Validation options
     * @param {number} options.maxIssuesPerType - Maximum number of issues to return per type (default: 20)
     * @param {boolean} options.includeFullStats - Include full statistics even when issues are truncated (default: true)
     * @returns {Object} Validation result with detailed report
     */

    async validateProgrammeBeforeComputation(programmeId, options = {}) {
        const maxIssuesPerType = options.maxIssuesPerType || 20;
        const includeFullStats = options.includeFullStats !== false;

        const report = {
            programmeId,
            timestamp: new Date(),
            canCompute: true,
            issues: {
                unregisteredCourses: [],
                borrowedCourseMismatches: [],
                semesterMismatches: [],
                levelMismatches: [],
                duplicateResults: [],
                missingCourseInfo: [],
                invalidGradeEntries: [],
                missingResults: []
            },
            issueStats: {
                unregisteredCourses: { total: 0, returned: 0, truncated: false },
                borrowedCourseMismatches: { total: 0, returned: 0, truncated: false },
                semesterMismatches: { total: 0, returned: 0, truncated: false },
                levelMismatches: { total: 0, returned: 0, truncated: false },
                duplicateResults: { total: 0, returned: 0, truncated: false },
                missingCourseInfo: { total: 0, returned: 0, truncated: false },
                invalidGradeEntries: { total: 0, returned: 0, truncated: false },
                missingResults: { total: 0, returned: 0, truncated: false }
            },
            summary: {
                totalStudents: 0,
                totalResults: 0,
                totalIssues: 0,
                affectedStudents: new Set(),
                affectedStudentsCount: 0,
                // Additional stats for better reporting
                issuesBySeverity: {
                    HIGH: 0,
                    MEDIUM: 0,
                    LOW: 0,
                    INFO: 0
                },
                issuesByType: {}
            }
        };

        try {
            // Get programme details with department
            const programme = await Programme.findById(programmeId)
                .populate('department')
                .lean();

            if (!programme) {
                throw new Error(`Programme ${programmeId} not found`);
            }

            // Get all active students in this programme
            const students = await Student.find({
                programmeId,
                deletedAt: null,
                isActive: true
            }).lean();

            report.summary.totalStudents = students.length;

            if (students.length === 0) {
                return report;
            }

            // BULK FETCH: Get all student IDs
            const studentIds = students.map(s => s._id);

            // BULK FETCH: Get all results for all students in one query
            const allResults = await Result.find({
                studentId: { $in: studentIds },
                deletedAt: null
            })
                .populate({
                    path: 'courseId',
                    populate: [
                        { path: 'department' },
                        { path: "borrowedId" }
                    ]
                })
                .populate('semester')
                .lean();

            // BULK FETCH: Get all course registrations for all students in one query
            const allRegistrations = await CourseRegistration.find({
                student: { $in: studentIds }
            })
                .populate('courses')
                .populate('semester')
                .lean();

            // BULK FETCH: Get all borrowed courses that might be needed
            const borrowedCourseIds = new Set();
            for (const result of allResults) {
                if (result.courseId?.borrowedId) {
                    borrowedCourseIds.add(result.courseId.borrowedId._id.toString());
                }
            }

            // Pre-fetch all original courses for borrowed courses
            const borrowedCoursesMap = new Map();
            if (borrowedCourseIds.size > 0) {
                const borrowedCourses = await Course.find({
                    _id: { $in: Array.from(borrowedCourseIds) }
                })
                    .populate('department')
                    .lean();

                for (const course of borrowedCourses) {
                    borrowedCoursesMap.set(course._id.toString(), course);
                }
            }

            // Group data by student
            const resultsByStudent = new Map();
            for (const result of allResults) {
                const studentId = result.studentId.toString();
                if (!resultsByStudent.has(studentId)) {
                    resultsByStudent.set(studentId, []);
                }
                resultsByStudent.get(studentId).push(result);
            }

            const registrationsByStudent = new Map();
            for (const reg of allRegistrations) {
                const studentId = reg.student.toString();
                if (!registrationsByStudent.has(studentId)) {
                    registrationsByStudent.set(studentId, []);
                }
                registrationsByStudent.get(studentId).push(reg);
            }

            // Pre-compute department info for level mismatch checks
            const studentDepartmentId = programme.department._id.toString();

            // Process each student with pre-fetched data
            for (const student of students) {
                const studentId = student._id.toString();
                const results = resultsByStudent.get(studentId) || [];
                const registrations = registrationsByStudent.get(studentId) || [];

                await this._validateStudentResults(
                    student,
                    programme,
                    report,
                    results,
                    registrations,
                    borrowedCoursesMap,
                    studentDepartmentId,
                    maxIssuesPerType
                );
            }

            // Update issue stats with totals and truncation info
            for (const [issueType, issues] of Object.entries(report.issues)) {
                const total = issues.length;
                const returned = Math.min(total, maxIssuesPerType);
                const truncated = total > maxIssuesPerType;

                report.issueStats[issueType] = {
                    total,
                    returned,
                    truncated,
                    limit: maxIssuesPerType
                };

                // Truncate the issues array if needed
                if (truncated) {
                    report.issues[issueType] = issues.slice(0, maxIssuesPerType);
                }

                // Update issues by type count in summary
                report.summary.issuesByType[issueType] = total;
            }

            // Calculate final summary
            report.summary.totalIssues = Object.values(report.issueStats).reduce(
                (sum, stat) => sum + stat.total,
                0
            );

            report.summary.affectedStudentsCount = report.summary.affectedStudents.size;
            report.canCompute = report.summary.totalIssues === 0;

            // Add warning if any issues were truncated
            const hasTruncatedIssues = Object.values(report.issueStats).some(stat => stat.truncated);
            if (hasTruncatedIssues && includeFullStats) {
                report.warning = "Some issues have been truncated due to size limits. Use pagination or filters to view all issues.";
            }

            // Convert Set to Array for JSON serialization
            report.summary.affectedStudents = Array.from(report.summary.affectedStudents);

            return report;

        } catch (error) {
            console.error("Validation error:", error);
            return {
                programmeId,
                canCompute: false,
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    /**
     * Helper method to add issue with truncation awareness
     * @private
     */
    _addIssue(report, issueType, issue, maxIssuesPerType) {
        // Always add to the array first (we'll truncate later)
        report.issues[issueType].push(issue);

        // Track severity counts
        if (issue.severity) {
            report.summary.issuesBySeverity[issue.severity] =
                (report.summary.issuesBySeverity[issue.severity] || 0) + 1;
        } else {
            report.summary.issuesBySeverity.INFO =
                (report.summary.issuesBySeverity.INFO || 0) + 1;
        }

        // Track affected students
        if (issue.studentId) {
            report.summary.affectedStudents.add(issue.studentId.toString());
        }
    }

    /**
     * Validate a single student's results
     * @private
     */
    async _validateStudentResults(student, programme, report, results, registrations, borrowedCoursesMap, studentDepartmentId, maxIssuesPerType) {
        const studentId = student._id;

        report.summary.totalResults += results.length;

        // Create maps for quick lookup
        const registeredCoursesMap = new Map();
        const registrationBySemester = new Map();

        for (const reg of registrations) {
            const semesterKey = reg.semester._id.toString();

            if (!registrationBySemester.has(semesterKey)) {
                registrationBySemester.set(semesterKey, new Set());
            }

            for (const course of reg.courses) {
                const courseId = course._id.toString();
                registeredCoursesMap.set(courseId, {
                    registrationId: reg._id,
                    semesterId: reg.semester._id,
                    semesterName: reg.semester.name,
                    session: reg.session,
                    level: reg.level
                });

                registrationBySemester.get(semesterKey).add(courseId);
            }
        }

        // FIRST: Check for duplicate results (call once per student, not per result)
        this._checkDuplicateResults(student, results, report, maxIssuesPerType);

        // Validate each result
        for (const result of results) {
            const courseId = result.courseId._id.toString();
            const resultSemesterId = result.semester?._id?.toString();
            result.courseId = normalizeCourse(result.courseId);

            // Check 1: Unregistered courses
            if (!registeredCoursesMap.has(courseId)) {
                this._addIssue(report, 'unregisteredCourses', {
                    studentId,
                    matricNumber: student.matricNumber,
                    courseId,
                    courseCode: result.courseId.courseCode,
                    courseTitle: result.courseId.title,
                    resultId: result._id,
                    semesterId: resultSemesterId,
                    issue: "Student has result but did not register for this course",
                    severity: "HIGH"
                }, maxIssuesPerType);
            }

            // Check 2: Borrowed course department mismatch
            this._checkBorrowedCourseMismatch(
                student,
                result,
                programme,
                report,
                borrowedCoursesMap,
                studentDepartmentId,
                maxIssuesPerType
            );

            // Check 3: Semester mismatch
            if (resultSemesterId && registeredCoursesMap.has(courseId)) {
                const registration = registeredCoursesMap.get(courseId);
                if (registration.semesterId.toString() !== resultSemesterId) {
                    this._addIssue(report, 'semesterMismatches', {
                        studentId,
                        matricNumber: student.matricNumber,
                        courseId,
                        courseCode: result.courseId.courseCode,
                        resultId: result._id,
                        resultSemester: result.semester?.name,
                        registrationSemester: registration.semesterName,
                        issue: "Result semester does not match registration semester",
                        severity: "MEDIUM"
                    }, maxIssuesPerType);
                }
            }

            // Check 4: Course level vs Student level, currently skip this part because a student could take a course of another level due to carryover,
            // however upgrade and uncomment it after it must have a new logic to make sure the student can only register for another level if they have carryovers for that course
            this._checkLevelMismatch(
                student,
                result,
                registeredCoursesMap.get(courseId),
                report,
                borrowedCoursesMap,
                maxIssuesPerType
            );

            // Check 5: Course info completeness
            this._checkCourseInfoCompleteness(result, report, maxIssuesPerType);
        }

        // Check for missing results (registered but no result)
        this._checkMissingResults(
            student,
            registrations,
            results,
            report,
            maxIssuesPerType
        );
    }

    /**
     * Check if borrowed course belongs to student's department (SYNCHRONOUS)
     * @private
     */
    _checkBorrowedCourseMismatch(student, result, programme, report, borrowedCoursesMap, studentDepartmentId, maxIssuesPerType) {
        const course = result.courseId;

        // Only check borrowed courses
        if (!course.borrowedId) return;

        // Get the original course from pre-fetched map
        const originalCourse = borrowedCoursesMap.get(course.borrowedId.toString());

        if (!originalCourse) return;

        let issue = '';
        const courseDepartmentId = course.department._id.toString();

        // Check if course belongs to student's department or is explicitly allowed for their programme
        let isAllowed = courseDepartmentId === studentDepartmentId;

        // Check programme-specific allowances
        if (!isAllowed && originalCourse.overrides?.allowed_programmes) {
            isAllowed = originalCourse.overrides.allowed_programmes.some(
                progId => progId.toString() === student.programmeId.toString()
            );
        }

        // Check exclusions
        if (originalCourse.overrides?.excluded_programmes) {
            const isExcluded = originalCourse.overrides.excluded_programmes.some(
                progId => progId.toString() === student.programmeId.toString()
            );
            if (isExcluded) {
                isAllowed = false;
                issue = 'has result for a course excluded from his/her programme';
            }
        }

        if (!isAllowed) {
            this._addIssue(report, 'borrowedCourseMismatches', {
                studentId: student._id,
                matricNumber: student.matricNumber,
                courseId: course._id,
                courseCode: originalCourse.courseCode,
                originalCourseId: course.borrowedId,
                originalDepartment: originalCourse.department.name || originalCourse.department._id,
                studentDepartment: programme.department.name || student.departmentId,
                resultId: result._id,
                issue: issue || "Student has result for borrowed course from another department",
                severity: "HIGH"
            }, maxIssuesPerType);
        }
    }

    /**
     * Check if course level matches student level at registration time (SYNCHRONOUS)
     * @private
     */
    _checkLevelMismatch(student, result, registration, report, borrowedCoursesMap, maxIssuesPerType) {
        const course = normalizeCourse(result.courseId);

        // Resolve borrowed course if necessary using pre-fetched map
        let courseLevel = course.level;
        if (course.borrowedId) {
            const originalCourse = borrowedCoursesMap.get(course.borrowedId.toString());
            if (originalCourse && originalCourse.level) {
                courseLevel = originalCourse.level;
            }
        }

        // Check if level mismatch exists
        if (registration && courseLevel && registration.level !== courseLevel) {
            // Allow if course has override for this level
            if (course.overrides?.allowed_levels) {
                if (course.overrides.allowed_levels.includes(registration.level)) {
                    return;
                }
            }

            this._addIssue(report, 'levelMismatches', {
                studentId: student._id,
                matricNumber: student.matricNumber,
                courseId: course._id,
                courseCode: course.courseCode || "Unknown",
                courseLevel,
                studentLevel: registration.level,
                resultId: result._id,
                issue: `Course level (${courseLevel}) does not match student level (${registration.level})`,
                severity: "MEDIUM"
            }, maxIssuesPerType);
        }
    }

    /**
     * Check for missing or incomplete course information (SYNCHRONOUS)
     * @private
     */
    _checkCourseInfoCompleteness(result, report, maxIssuesPerType) {
        const course = normalizeCourse(result.courseId);
        const missingFields = [];

        if (!course.courseCode) missingFields.push('courseCode');
        if (!course.title) missingFields.push('title');
        if (!course.unit && course.unit !== 0) missingFields.push('unit');
        if (!course.level) missingFields.push('level');

        // For non-borrowed courses, check additional fields
        if (!course.borrowedId) {
            if (!course.semester) missingFields.push('semester');
            if (!course.type) missingFields.push('type');
        }

        if (missingFields.length > 0) {
            this._addIssue(report, 'missingCourseInfo', {
                courseId: course._id,
                courseCode: course.courseCode || "Unknown",
                borrowedId: course.borrowedId,
                resultId: result._id,
                missingFields,
                issue: `Course missing required information: ${missingFields.join(", ")}`,
                severity: "LOW"
            }, maxIssuesPerType);
        }
    }

    /**
     * Check for invalid grade entries
     * @private
     */
    _checkInvalidGradeEntries(result, report, maxIssuesPerType) {
        const validGrades = ['A', 'B', 'C', 'D', 'E', 'F', 'P', 'W', 'I', 'AB', 'BC', 'CD'];
        const grade = result.grade?.toUpperCase();

        if (grade && !validGrades.includes(grade) && !/^\d+$/.test(grade)) {
            this._addIssue(report, 'invalidGradeEntries', {
                resultId: result._id,
                studentId: result.studentId,
                courseId: result.courseId._id,
                courseCode: result.courseId.courseCode,
                grade: result.grade,
                issue: `Invalid grade value: ${result.grade}`,
                severity: "HIGH"
            }, maxIssuesPerType);
        }
    }

    /**
     * Check for duplicate results for the same course/semester (SYNCHRONOUS)
     * Called once per student, not per result
     * @private
     */
    _checkDuplicateResults(student, allResults, report, maxIssuesPerType) {
        const resultMap = new Map();

        for (const result of allResults) {
            const key = `${result.courseId._id}_${result.semester?._id || 'nosemester'}`;

            if (resultMap.has(key)) {
                this._addIssue(report, 'duplicateResults', {
                    studentId: student._id,
                    matricNumber: student.matricNumber,
                    courseId: result.courseId._id,
                    courseCode: result.courseId.courseCode,
                    semesterId: result.semester?._id,
                    semesterName: result.semester?.name,
                    resultId1: resultMap.get(key),
                    resultId2: result._id,
                    issue: "Duplicate result entry for same course and semester",
                    severity: "HIGH"
                }, maxIssuesPerType);
            } else {
                resultMap.set(key, result._id);
            }
        }
    }

    /**
     * Check for missing results (registered but no result) (SYNCHRONOUS)
     * @private
     */
    _checkMissingResults(student, registrations, results, report, maxIssuesPerType) {
        const resultCourseIds = new Set(
            results.map(r => r.courseId._id.toString())
        );

        for (const registration of registrations) {
            for (const course of registration.courses) {
                const courseId = course._id.toString();

                if (!resultCourseIds.has(courseId)) {
                    this._addIssue(report, 'missingResults', {
                        studentId: student._id,
                        matricNumber: student.matricNumber,
                        courseId,
                        courseCode: course.courseCode,
                        courseTitle: course.title,
                        registrationId: registration._id,
                        semester: registration.semester.name,
                        semesterId: registration.semester._id,
                        session: registration.session,
                        issue: "Student registered but no result found",
                        severity: "INFO"
                    }, maxIssuesPerType);
                }
            }
        }
    }

    /**
     * Generate a full report for all programmes with pagination support
     * @param {Object} options - Options for generating reports
     * @param {number} options.maxIssuesPerType - Max issues per type (default: 20)
     * @param {Array<string>} options.programmeIds - Specific programme IDs to validate (optional)
     */
    async validateAllProgrammes(options = {}) {
        const {
            maxIssuesPerType = 20,
            programmeIds = null,
            includeProgrammeDetails = true
        } = options;

        let query = { isActive: true };
        if (programmeIds && programmeIds.length > 0) {
            query = { _id: { $in: programmeIds }, isActive: true };
        }

        const programmes = await Programme.find(query).lean();
        const reports = [];

        for (const programme of programmes) {
            const report = await this.validateProgrammeBeforeComputation(programme._id, { maxIssuesPerType });
            if (includeProgrammeDetails) {
                // Add full programme details to the report
                report.programme = {
                    _id: programme._id,
                    name: programme.name,
                    full_name: buildProgrammeFullName(programme.programmeType, programme.name),
                    code: programme.code,
                    department: programme.department ? {
                        _id: programme.department._id,
                        name: programme.department.name
                    } : null,
                    duration: programme.duration,
                    degreeType: programme.degreeType,
                    isActive: programme.isActive
                };
                // Keep programmeId for backward compatibility
                // report.programmeId is already there
            }
            reports.push(report);
        }

        const result = {
            timestamp: new Date(),
            totalProgrammes: programmes.length,
            programmesWithIssues: reports.filter(r => !r.canCompute).length,
            reports,
            metadata: {
                maxIssuesPerType,
                totalIssuesAcrossAllProgrammes: reports.reduce(
                    (sum, r) => sum + (r.summary?.totalIssues || 0),
                    0
                )
            }
        };

        return result;
    }

    /**
     * Get paginated issues for a specific programme
     * @param {string} programmeId - Programme ID
     * @param {string} issueType - Type of issue to fetch
     * @param {number} page - Page number (1-indexed)
     * @param {number} limit - Items per page
     */
    async getPaginatedIssues(programmeId, issueType, page = 1, limit = 50) {
        // First get the full report (but with limit 0 to get only counts)
        const fullReport = await this.validateProgrammeBeforeComputation(programmeId, { maxIssuesPerType: 0 });

        const total = fullReport.issueStats[issueType]?.total || 0;
        const skip = (page - 1) * limit;

        // Now fetch just the issues we need (this would require modifying the validation to support pagination)
        // For now, we'll get the full report with the requested limit and page
        const paginatedReport = await this.validateProgrammeBeforeComputation(programmeId, {
            maxIssuesPerType: skip + limit
        });

        const allIssues = paginatedReport.issues[issueType] || [];
        const paginatedIssues = allIssues.slice(skip, skip + limit);

        return {
            programmeId,
            issueType,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            issues: paginatedIssues,
            hasMore: skip + limit < total
        };
    }

    /**
     * Quick validation function - returns simple canCompute flag with reason
     * @param {string} programmeId - Programme ID to validate
     * @returns {Object} { canCompute: boolean, reason: string }
     */
    async quickValidate(programmeId) {
        const report = await this.validateProgrammeBeforeComputation(programmeId, { maxIssuesPerType: 5 });

        if (report.canCompute) {
            return {
                canCompute: true,
                reason: "All validations passed successfully"
            };
        }

        // Build detailed reason with counts
        const reasons = [];
        const issueStats = report.issueStats;

        if (issueStats.unregisteredCourses.total > 0) {
            reasons.push(`${issueStats.unregisteredCourses.total} unregistered course results found`);
        }

        if (issueStats.borrowedCourseMismatches.total > 0) {
            reasons.push(`${issueStats.borrowedCourseMismatches.total} borrowed course department mismatches`);
        }

        if (issueStats.semesterMismatches.total > 0) {
            reasons.push(`${issueStats.semesterMismatches.total} semester mismatches`);
        }

        if (issueStats.levelMismatches.total > 0) {
            reasons.push(`${issueStats.levelMismatches.total} level mismatches`);
        }

        if (issueStats.duplicateResults.total > 0) {
            reasons.push(`${issueStats.duplicateResults.total} duplicate results`);
        }

        if (issueStats.missingCourseInfo.total > 0) {
            reasons.push(`${issueStats.missingCourseInfo.total} courses with missing information`);
        }

        return {
            canCompute: false,
            reason: `Validation failed: ${reasons.join('; ')}`,
            affectedStudents: report.summary.affectedStudentsCount,
            issueStats: report.issueStats,
            detailedReport: report
        };
    }

    /**
     * Fix common issues automatically where possible
     */
    async autoFixIssues(programmeId, options = {}) {
        const report = await this.validateProgrammeBeforeComputation(programmeId, { maxIssuesPerType: 0 });
        const fixes = {
            applied: [],
            failed: [],
            requiresManual: []
        };

        // Fix duplicate results - keep the latest one
        if (options.fixDuplicates && report.issues.duplicateResults.length > 0) {
            for (const duplicate of report.issues.duplicateResults) {
                try {
                    // Keep the most recent result, soft delete the older one
                    const results = await Result.find({
                        _id: { $in: [duplicate.resultId1, duplicate.resultId2] }
                    }).sort({ createdAt: -1 });

                    if (results.length === 2) {
                        // Soft delete the older result
                        await Result.findByIdAndUpdate(
                            results[1]._id,
                            {
                                deletedAt: new Date(),
                                $push: {
                                    auditLog: {
                                        action: 'auto_fix_duplicate',
                                        timestamp: new Date(),
                                        reason: 'Automatically removed duplicate result'
                                    }
                                }
                            }
                        );

                        fixes.applied.push({
                            type: 'duplicate_result',
                            studentId: duplicate.studentId,
                            courseCode: duplicate.courseCode,
                            kept: results[0]._id,
                            removed: results[1]._id
                        });
                    }
                } catch (error) {
                    fixes.failed.push({
                        type: 'duplicate_result',
                        error: error.message,
                        details: duplicate
                    });
                }
            }
        }

        // Note: Other issues require manual intervention
        if (report.issueStats.unregisteredCourses.total > 0) {
            fixes.requiresManual.push({
                type: 'unregistered_courses',
                count: report.issueStats.unregisteredCourses.total,
                message: 'These must be resolved by admin - either register courses or remove results'
            });
        }

        if (report.issueStats.borrowedCourseMismatches.total > 0) {
            fixes.requiresManual.push({
                type: 'borrowed_course_mismatches',
                count: report.issueStats.borrowedCourseMismatches.total,
                message: 'Department mismatches require admin review and course override configuration'
            });
        }

        return {
            programmeId,
            fixesApplied: fixes.applied.length,
            fixesFailed: fixes.failed.length,
            requiresManualIntervention: fixes.requiresManual.length > 0,
            details: fixes
        };
    }
}

// Export singleton instance
export default new ValidationService();