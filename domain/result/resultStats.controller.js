import courseAssignmentModel from "../course/courseAssignment.model.js";
import CourseAssignment from "../course/courseAssignment.model.js";
import departmentService from "../department/department.service.js";
import AppError from "../errors/AppError.js";
import Result from "../result/result.model.js";
// import User from "../models/user.model.js";
import DepartmentSemester from "../semester/semester.model.js";
// import Department from "../models/department.model.js";
// import Student from "../models/student.model.js";
import mongoose from "mongoose";
import Student from "../student/student.model.js";
import SemesterService from "../semester/semester.service.js";

/**
 * @desc Get result upload statistics for HOD
 * @route GET /api/results/stats
 * @access HOD only
 */
export const getResultStats = async (req, res, next) => {
    try {
        const { semester, department, lecturer, page = 1, limit = 20 } = req.body || req.query;
        const user = req.user;

        // Verify user is HOD
        if (user.role !== "hod" && user.role !== "admin") {
            throw new AppError("Unauthorized: Only HODs can access result statistics", 403);
        }

        // Get HOD's department if not specified
        let departmentId = department;
        if (!departmentId && user.department) {
            const department = await departmentService.getUserDepartment(user._id)
            departmentId = department._id
        }

        if (!departmentId) {
            new AppError("Department ID is required", 400)
        }

        // Get active semester if not specified
        let semesterId = semester;
        if (!semesterId) {
            const activeSemester = await SemesterService.getActiveAcademicSemester();
            if (activeSemester) {
                semesterId = activeSemester._id;
            }
        }

        if (!semesterId) {
            throw new AppError("No active semester found or semester ID required", 400)
        }

        // Build query for course assignments
        const assignmentQuery = {
            department: departmentId,
            semester: semesterId,
            status: "Active"
        };

        if (lecturer) {
            assignmentQuery.lecturer = lecturer;
        }

        // Get total course assignments
        const totalAssignments = await courseAssignmentModel.countDocuments(assignmentQuery);

        // Paginate course assignments
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const assignments = await CourseAssignment.find(assignmentQuery)
            .populate({
                path: 'course',
                select: 'courseCode title unit'
            })
            .populate({
                path: 'lecturer',
                select: 'firstName lastName email'
            })
            .populate({
                path: 'AcademicSemester',
                select: 'name session isActive'
            })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();


        // Get statistics for each assignment
        const assignmentsWithStats = await Promise.all(
            assignments.map(async (assignment) => {
                // Count total students enrolled in the course for this semester
                const totalStudents = await Student.countDocuments({
                    departmentId: departmentId,
                    level: assignment.course?.level,
                    status: 'active'
                });

                // Count results uploaded for this course
                const resultCount = await Result.countDocuments({
                    courseId: assignment.course._id,
                    semester: assignment.semester._id,
                    deletedAt: null
                });

                // Count approved results
                const approvedCount = await Result.countDocuments({
                    courseId: assignment.course._id,
                    semester: assignment.semester._id,
                    approved: true,
                    deletedAt: null
                });

                // Get last upload date
                const lastUpload = await Result.findOne({
                    courseId: assignment.course._id,
                    semester: assignment.semester._id,
                    deletedAt: null
                })
                    .sort({ createdAt: -1 })
                    .select('createdAt')
                    .lean();

                return {
                    ...assignment,
                    totalStudents,
                    resultsUploaded: resultCount,
                    approvedResults: approvedCount,
                    uploadPercentage: totalStudents > 0 ? Math.round((resultCount / totalStudents) * 100) : 0,
                    approvalPercentage: resultCount > 0 ? Math.round((approvedCount / resultCount) * 100) : 0,
                    lastUploadDate: lastUpload?.createdAt || null
                };
            })
        );

        // Get overall statistics
        const overallStats = await getOverallStatistics(departmentId, semesterId);

        // Get lecturers without uploads
        const lecturersWithoutUploads = await getLecturersWithoutUploads(departmentId, semesterId);

        // Get courses with low upload rates (less than 50%)
        const coursesWithLowUploads = await getCoursesWithLowUploads(departmentId, semesterId);

        res.status(200).json({
            success: true,
            data: {
                assignments: assignmentsWithStats,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalAssignments,
                    pages: Math.ceil(totalAssignments / parseInt(limit))
                },
                overall: overallStats,
                warnings: {
                    lecturersWithoutUploads,
                    coursesWithLowUploads
                }
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc Get detailed course statistics
 * @route GET /api/results/stats/:courseId
 * @access HOD only
 */
export const getCourseResultStats = async (req, res, next) => {
    try {
        const { courseId, department } = req.params;
        const { semester } = req.query;
        const user = req.user;

        if (user.role !== "hod" && user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: Only HODs can access result statistics"
            });
        }

        let departmentId = department;
        if (!departmentId && user.department) {
            const department = await departmentService.getUserDepartment(user._id)
            departmentId = department._id
        }

        // Get active semester if not specified
        let semesterId = semester;
        if (!semesterId) {
            const activeSemester = await SemesterService.getActiveAcademicSemester();
            if (activeSemester) {
                semesterId = activeSemester._id;
            }
        }

        if (!semesterId) {
            return res.status(400).json({
                success: false,
                message: "Semester ID is required"
            });
        }

        // Get course assignment details
        const assignment = await CourseAssignment.findOne({
            course: courseId,
            semester: semesterId
        })
            .populate({
                path: 'course',
                select: 'courseCode title unit level'
            })
            .populate({
                path: 'lecturer',
                select: 'firstName lastName email phone'
            })
            // .lean();

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: "Course assignment not found for this semester"
            });
        }

        // Get all results for this course
        const results = await Result.find({
            courseId: courseId,
            semester: semesterId,
            deletedAt: null
        })
            .populate({
                path: 'studentId',
                select: 'firstName lastName matricNo level'
            })
            .populate({
                path: 'lecturerId',
                select: 'firstName lastName'
            })
            .sort({ 'studentId.lastName': 1 })
            .lean();

        // Calculate grade distribution
        const gradeDistribution = {
            A: 0, B: 0, C: 0, D: 0, E: 0, F: 0
        };

        // Calculate score ranges
        const scoreRanges = {
            '90-100': 0,
            '80-89': 0,
            '70-79': 0,
            '60-69': 0,
            '50-59': 0,
            '40-49': 0,
            '0-39': 0
        };

        let totalScore = 0;
        let highestScore = 0;
        let lowestScore = 100;

        results.forEach(result => {
            // Grade distribution
            if (result.grade) {
                gradeDistribution[result.grade] = (gradeDistribution[result.grade] || 0) + 1;
            }

            // Score ranges
            const score = result.score || 0;
            totalScore += score;
            highestScore = Math.max(highestScore, score);
            lowestScore = Math.min(lowestScore, score);

            if (score >= 90) scoreRanges['90-100']++;
            else if (score >= 80) scoreRanges['80-89']++;
            else if (score >= 70) scoreRanges['70-79']++;
            else if (score >= 60) scoreRanges['60-69']++;
            else if (score >= 50) scoreRanges['50-59']++;
            else if (score >= 40) scoreRanges['40-49']++;
            else scoreRanges['0-39']++;
        });

        const averageScore = results.length > 0 ? totalScore / results.length : 0;

        // Get approval status
        const approvedCount = results.filter(r => r.approved).length;
        const pendingCount = results.length - approvedCount;

        res.status(200).json({
            success: true,
            data: {
                assignment,
                summary: {
                    totalStudents: results.length,
                    approvedResults: approvedCount,
                    pendingApproval: pendingCount,
                    uploadDate: assignment.updatedAt,
                    averageScore: averageScore.toFixed(2),
                    highestScore,
                    lowestScore,
                    passRate: results.length > 0 ?
                        ((results.filter(r => (r.score || 0) >= 40).length / results.length) * 100).toFixed(2) : 0
                },
                distribution: {
                    grades: gradeDistribution,
                    scores: scoreRanges
                },
                results: results.map(result => ({
                    student: result.studentId,
                    score: result.score,
                    ca: result.ca,
                    exam: result.exam,
                    grade: result.grade,
                    approved: result.approved,
                    approvedBy: result.approvedBy,
                    uploadedAt: result.createdAt
                }))
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc Get lecturer performance statistics
 * @route GET /api/results/stats/lecturers
 * @access HOD only
 */
export const getLecturerStats = async (req, res, next) => {
    try {
        const { semester, department } = req.query;
        const user = req.user;

        if (user.role !== "hod" && user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: Only HODs can access lecturer statistics"
            });
        }

        let departmentId = department || user.department
        if (!departmentId ) {
            const department = await departmentService.getUserDepartment(user._id)
            departmentId = department._id
        }
        if (!departmentId) {
            return res.status(400).json({
                success: false,
                message: "Department ID is required"
            });
        }

        let semesterId = semester;
        if (!semesterId) {
            const activeSemester = await SemesterService.getActiveAcademicSemester();
            if (activeSemester) {
                semesterId = activeSemester._id;
            }
        }

        if (!semesterId) {
            return res.status(400).json({
                success: false,
                message: "Semester ID is required"
            });
        }

        // Get all lecturers with assignments in this department and semester
        const assignments = await CourseAssignment.find({
            department: departmentId,
            semester: semesterId,
            status: "Active"
        })
            .populate('lecturer', 'firstName lastName email')
            .populate('course', 'courseCode title unit')
            .lean();

        // Group assignments by lecturer
        const lecturerMap = new Map();

        assignments.forEach(assignment => {
            if (!assignment.lecturer) return;

            const lecturerId = assignment.lecturer._id.toString();
            if (!lecturerMap.has(lecturerId)) {
                lecturerMap.set(lecturerId, {
                    lecturer: assignment.lecturer,
                    courses: [],
                    totalCourses: 0,
                    totalStudents: 0,
                    resultsUploaded: 0,
                    approvedResults: 0
                });
            }

            lecturerMap.get(lecturerId).courses.push({
                course: assignment.course,
                assignmentId: assignment._id
            });
            lecturerMap.get(lecturerId).totalCourses++;
        });

        // Get statistics for each lecturer
        const lecturerStats = await Promise.all(
            Array.from(lecturerMap.values()).map(async (lecturerData) => {
                const lecturerId = lecturerData.lecturer._id;

                // Get all course IDs for this lecturer
                const courseIds = lecturerData.courses.map(c => c.course?._id);

                // Count results across all courses
                const resultCount = await Result.countDocuments({
                    courseId: { $in: courseIds },
                    semester: semesterId,
                    deletedAt: null
                });

                const approvedCount = await Result.countDocuments({
                    courseId: { $in: courseIds },
                    semester: semesterId,
                    approved: true,
                    deletedAt: null
                });

                // Get last upload date
                const lastUpload = await Result.findOne({
                    lecturerId: lecturerId,
                    semester: semesterId,
                    deletedAt: null
                })
                    .sort({ createdAt: -1 })
                    .select('createdAt')
                    .lean();

                // Calculate estimated total students (sum of all courses)
                // Note: This is an estimate - actual enrollment might differ
                const estimatedTotalStudents = lecturerData.totalCourses * 50; // Assuming average 50 students per course

                return {
                    ...lecturerData,
                    resultsUploaded: resultCount,
                    approvedResults: approvedCount,
                    uploadPercentage: estimatedTotalStudents > 0 ?
                        Math.round((resultCount / estimatedTotalStudents) * 100) : 0,
                    approvalPercentage: resultCount > 0 ?
                        Math.round((approvedCount / resultCount) * 100) : 0,
                    lastUploadDate: lastUpload?.createdAt || null,
                    performanceScore: calculatePerformanceScore(
                        resultCount,
                        approvedCount,
                        lecturerData.totalCourses,
                        lastUpload?.createdAt
                    )
                };
            })
        );

        // Sort by performance score (descending)
        lecturerStats.sort((a, b) => b.performanceScore - a.performanceScore);

        res.status(200).json({
            success: true,
            data: lecturerStats
        });

    } catch (error) {
        next(error);
    }
};

// Helper functions
async function getOverallStatistics(departmentId, semesterId) {
    const [assignments, results, approvedResults, lecturers] = await Promise.all([
        CourseAssignment.countDocuments({
            department: departmentId,
            semester: semesterId,
            status: "Active"
        }),
        Result.countDocuments({
            semester: semesterId,
            deletedAt: null
        }),
        Result.countDocuments({
            semester: semesterId,
            approved: true,
            deletedAt: null
        }),
        CourseAssignment.distinct('lecturer', {
            department: departmentId,
            semester: semesterId,
            status: "Active"
        })
    ]);

    // Get total estimated students
    const courses = await CourseAssignment.find({
        department: departmentId,
        semester: semesterId,
        status: "Active"
    }).populate('course', 'level').lean();

    const estimatedStudents = courses.reduce((total, course) => {
        // Estimate 50 students per course (adjust based on your system)
        return total + 50;
    }, 0);

    return {
        totalCourses: assignments,
        totalLecturers: lecturers.length,
        totalResultsUploaded: results,
        totalApprovedResults: approvedResults,
        estimatedTotalStudents: estimatedStudents,
        overallUploadRate: estimatedStudents > 0 ?
            Math.round((results / estimatedStudents) * 100) : 0,
        overallApprovalRate: results > 0 ?
            Math.round((approvedResults / results) * 100) : 0
    };
}

async function getLecturersWithoutUploads(departmentId, semesterId) {
    const assignments = await CourseAssignment.find({
        department: departmentId,
        semester: semesterId,
        status: "Active"
    })
        .populate('lecturer', 'firstName lastName email')
        .populate('course', 'courseCode title')
        .lean();

    const lecturersWithoutUploads = [];

    for (const assignment of assignments) {
        const resultCount = await Result.countDocuments({
            courseId: assignment.course._id,
            semester: semesterId,
            deletedAt: null
        });

        if (resultCount === 0) {
            lecturersWithoutUploads.push({
                lecturer: assignment.lecturer,
                course: assignment.course,
                assignmentDate: assignment.createdAt,
                daysSinceAssignment: Math.floor(
                    (Date.now() - new Date(assignment.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                )
            });
        }
    }

    return lecturersWithoutUploads;
}

async function getCoursesWithLowUploads(departmentId, semesterId) {
    const assignments = await CourseAssignment.find({
        department: departmentId,
        semester: semesterId,
        status: "Active"
    })
        .populate('course', 'courseCode title level')
        .populate('lecturer', 'firstName lastName')
        .lean();

    const lowUploadCourses = [];

    for (const assignment of assignments) {
        const resultCount = await Result.countDocuments({
            courseId: assignment.course._id,
            semester: semesterId,
            deletedAt: null
        });

        // Estimate student count (adjust based on your system)
        const estimatedStudents = 50; // Average per course

        const uploadRate = (resultCount / estimatedStudents) * 100;
        if (uploadRate < 50 && uploadRate > 0) {
            lowUploadCourses.push({
                course: assignment.course,
                lecturer: assignment.lecturer,
                resultsUploaded: resultCount,
                uploadRate: Math.round(uploadRate),
                requiredFor50: Math.ceil((estimatedStudents * 0.5) - resultCount)
            });
        }
    }

    return lowUploadCourses;
}

function calculatePerformanceScore(uploaded, approved, courses, lastUploadDate) {
    let score = 0;

    // Base score for having assignments
    score += courses * 10;

    // Upload rate score (max 40 points)
    const estimatedStudents = courses * 50;
    const uploadRate = estimatedStudents > 0 ? uploaded / estimatedStudents : 0;
    score += Math.min(uploadRate * 40, 40);

    // Approval rate score (max 30 points)
    const approvalRate = uploaded > 0 ? approved / uploaded : 0;
    score += approvalRate * 30;

    // Timeliness score (max 20 points)
    if (lastUploadDate) {
        const daysSinceUpload = (Date.now() - new Date(lastUploadDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpload <= 7) {
            score += 20; // Uploaded within a week
        } else if (daysSinceUpload <= 14) {
            score += 10; // Uploaded within two weeks
        } else if (daysSinceUpload <= 30) {
            score += 5; // Uploaded within a month
        }
    }

    return Math.round(score);
}