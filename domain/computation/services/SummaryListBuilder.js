/**
 * BulkWriter is a low-level persistence orchestrator.
 * 
 * ⚠️ Intentionally bypasses domain services for performance-critical bulk operations.
 * ⚠️ Do NOT wrap these calls in studentService / carryoverService.
 * This function DOES not perform any CRUD operation, It only buildes the correct/safe structur for computation summaries
 */

import { resolveUserName } from "../../../utils/resolveUserName.js";
import { REMARK_CATEGORIES, GRADES } from "../utils/computationConstants.js";

class SummaryListBuilder {



  /**
   * Build complete summary statistics organized by level
   * @param {Object} counters - Various counters
   * @param {Object} gradeDistribution - Grade distribution
   * @param {Object} levelStats - Statistics by level
   * @returns {Object} Complete summary object organized by level
   */
  buildSummaryStatsByLevel(counters, gradeDistribution, levelStats) {
    const {
      totalStudents,
      studentsWithResults,
      totalGPA,
      highestGPA,
      lowestGPA,
      totalCarryovers,
      affectedStudentsCount
    } = counters;

    // Calculate overall averages
    const averageGPA = studentsWithResults > 0 ? totalGPA / studentsWithResults : 0;

    // Build level-wise summary
    const summaryOfResultsByLevel = new Map();

    if (levelStats && typeof levelStats === 'object') {
      Object.keys(levelStats).forEach(level => {
        const levelData = levelStats[level];
        if (levelData && levelData.totalStudents > 0) {
          levelData.averageGPA = levelData.totalGPA / levelData.totalStudents;

          summaryOfResultsByLevel.set(level, {
            totalStudents: levelData.totalStudents,
            studentsWithResults: levelData.studentsWithResults || levelData.totalStudents,

            gpaStatistics: {
              average: parseFloat(levelData.averageGPA.toFixed(2)),
              highest: parseFloat(levelData.highestGPA.toFixed(2)),
              lowest: parseFloat(levelData.lowestGPA.toFixed(2)),
              standardDeviation: 0 // Can be calculated if needed
            },

            classDistribution: levelData.gradeDistribution || {
              firstClass: 0,
              secondClassUpper: 0,
              secondClassLower: 0,
              thirdClass: 0,
              pass: 0,
              fail: 0
            }
          });
        }
      });
    }

    // Overall grade distribution (convert from old format to new)
    const overallGradeDistribution = {
      firstClass: gradeDistribution?.firstClass || 0,
      secondClassUpper: gradeDistribution?.secondClassUpper || 0,
      secondClassLower: gradeDistribution?.secondClassLower || 0,
      thirdClass: gradeDistribution?.thirdClass || 0,
      pass: Object.values(gradeDistribution || {}).reduce((sum, val) => sum + (val || 0), 0) - (gradeDistribution?.fail || 0),
      fail: gradeDistribution?.fail || 0
    };

    return {
      totalStudents: totalStudents || 0,
      studentsWithResults: studentsWithResults || 0,
      studentsProcessed: studentsWithResults || 0,
      averageGPA: parseFloat((averageGPA || 0).toFixed(2)),
      highestGPA: parseFloat((highestGPA || 0).toFixed(2)),
      lowestGPA: parseFloat((lowestGPA || 5.0).toFixed(2)),
      gradeDistribution: overallGradeDistribution,
      summaryOfResultsByLevel: Object.fromEntries(summaryOfResultsByLevel),
      levelStats: levelStats || {},
      totalCarryovers: totalCarryovers || 0,
      affectedStudentsCount: affectedStudentsCount || 0
    };
  }



  /**
   * Build key to courses from results, organized by level - FIXED VERSION
   * @param {Array} results - All results in the semester
   * @returns {Promise<Object>} Key to courses organized by level {level: [courses]}
   */
  async buildKeyToCoursesByLevel(results) {
    try {
      console.log(`📊 [KeyToCourses] Building from ${results?.length || 0} results`);

      if (!Array.isArray(results) || results.length === 0) {
        console.warn('buildKeyToCoursesByLevel: No results or not an array');
        return {};
      }

      const coursesByLevel = {};
      const uniqueCourses = new Map(); // Track unique courses by level

      for (const result of results) {
        if (!result || typeof result !== 'object') {
          console.warn('Skipping invalid result:', result);
          continue;
        }

        // Get course data from result
        const course = result.courseId;
        if (!course) {
          console.warn('Result missing courseId:', result);
          continue;
        }

        // Get level from student or course
        let level;
        if (result.studentId && typeof result.studentId === 'object' && result.studentId.level) {
          level = result.studentId.level.toString();
        } else if (result.studentId && typeof result.studentId !== 'object' && result.student) {
          level = result.student?.level?.toString();
        } else if (course.level) {
          level = course.level.toString();
        } else {
          level = "100"; // Default
        }

        // ✅ CRITICAL FIX: Initialize courses array for this level
        if (!coursesByLevel[level]) {
          coursesByLevel[level] = [];  // ✅ Direct array, not nested object
          uniqueCourses.set(level, new Set());
        }

        // Create unique key for this course
        const courseKey = course._id?.toString() || JSON.stringify(course);
        const levelUniqueSet = uniqueCourses.get(level);

        // Skip if we've already added this course for this level
        if (levelUniqueSet.has(courseKey)) {
          continue;
        }
        levelUniqueSet.add(courseKey);

        // Handle borrowed courses
        let finalCourse = {
          courseId: course._id,
          courseCode: course.courseCode || 'N/A',
          title: course.title || 'N/A',
          unit: course.unit || 0,
          level: parseInt(level),
          type: course.type || 'core',
          isCoreCourse: course.type === 'core' || course.isCoreCourse === true,
          isBorrowed: false
        };

        // If course has borrowedId and it's populated, use the original course data
        if (course.borrowedId && typeof course.borrowedId === 'object') {
          const originalCourse = course.borrowedId;
          finalCourse = {
            ...finalCourse,
            courseCode: originalCourse.courseCode || course.courseCode,
            title: originalCourse.title || course.title,
            unit: originalCourse.unit || course.unit,
            level: originalCourse.level || course.level || parseInt(level),
            type: originalCourse.type || course.type,
            isCoreCourse: originalCourse.isCoreCourse || course.isCoreCourse,
            isBorrowed: true
          };
        }

        // ✅ CORRECT: Direct array push
        coursesByLevel[level].push(finalCourse);
      }

      // Sort courses by courseCode within each level
      for (const level in coursesByLevel) {
        if (Array.isArray(coursesByLevel[level])) {
          coursesByLevel[level].sort((a, b) =>
            (a.courseCode || "").localeCompare(b.courseCode || "")
          );

          console.log(`  Level ${level}: ${coursesByLevel[level].length} unique courses`);
          if (coursesByLevel[level].length > 0) {
            console.log(`    Courses: ${coursesByLevel[level].map(c => c.courseCode).join(', ')}`);
          }
        }
      }

      const totalCourses = Object.values(coursesByLevel).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      console.log(`📊 [KeyToCourses] Built ${totalCourses} courses across ${Object.keys(coursesByLevel).length} levels`);

      // ✅ FINAL VALIDATION: Ensure structure is correct
      console.log('🔍 [KeyToCourses] Structure validation:');
      for (const level in coursesByLevel) {
        const value = coursesByLevel[level];
        if (Array.isArray(value)) {
          console.log(`  ✅ Level ${level}: Array with ${value.length} items`);
        } else {
          console.log(`  ❌ Level ${level}: NOT ARRAY (${typeof value})`);
          // Fix it
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            console.log(`    Fixing nested structure for level ${level}...`);
            // If it's nested like {"100": [...]}, extract the array
            if (value[level] && Array.isArray(value[level])) {
              coursesByLevel[level] = value[level];
              console.log(`    Fixed: Extracted ${coursesByLevel[level].length} courses`);
            } else {
              coursesByLevel[level] = [];
            }
          }
        }
      }

      return coursesByLevel;

    } catch (error) {
      console.error('❌ Error in buildKeyToCoursesByLevel:', error);
      return {};
    }
  }



  /** Build department details with dean and HOD information
   * @param {Object} department - Department object
   * @param {Object} faculty - Faculty object (populated with dean)
   * @param {Object} hodLecturer - Lecturer object for HOD
   * @param {Object} deanLecturer - Lecturer object for Dean
   * @param {Object} activeSemester - Current semester
   * @returns {Object} Department details
   */
  buildDepartmentDetails(department, faculty, hodLecturer, deanLecturer, activeSemester) {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    return {
      name: department?.name || '',
      code: department?.code || '',
      faculty: {
        name: faculty?.name || '',
        code: faculty?.code || ''
      },
      dean: {
        name: resolveUserName(deanLecturer?._id || deanLecturer, "SummaryListBuilder"),
        title: 'Dean',
        rank: deanLecturer?.rank || 'Professor',
        staffId: deanLecturer?.staffId || '',
        signature: deanLecturer?.signature || '',
        isDean: deanLecturer?.isDean || true
      },
      hod: {
        name: resolveUserName(hodLecturer?._id || hodLecturer, "SummaryListBuilder"),
        title: 'Head of Department',
        rank: hodLecturer?.rank || 'Professor',
        staffId: hodLecturer?.staffId || '',
        signature: hodLecturer?.signature || '',
        isHOD: hodLecturer?.isHOD || true
      },
      academicYear: activeSemester?.session || `${currentYear}/${nextYear}`,
      semester: activeSemester?.name || '',
      generatedDate: new Date().toISOString()
    };
  }



}

export default new SummaryListBuilder();