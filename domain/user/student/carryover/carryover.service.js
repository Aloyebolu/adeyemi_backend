// services/carryover.service.js
import courseModel from "#domain/course/course.model.js";
import AppError from "#shared/errors/AppError.js";
import Result from "#domain/result/result.model.js";
import Student from "#domain/user/student/student.model.js";
import StudentService from "#domain/user/student/student.service.js";
import CarryoverCourse from "./carryover.model.js";

class CarryoverService {
  
  /**
   * Get all carryover courses for a student with proper population
   * Now flattens the courses array into individual carryover objects
   */
  async getStudentCarryovers(studentId, filters = {}) {
    try {
      const { semester, cleared } = filters;
      
      // Build query
      const query = { student: studentId };
      
      if (semester && semester !== 'all') {
        query.semester = semester;
      }
      
      if (cleared && cleared !== 'all') {
        query.cleared = cleared === 'cleared';
      }
      
      // Fetch carryover documents (one per student per semester)
      const carryoverDocs = await CarryoverCourse.find(query)
        .populate({
          path: 'courses.course',
          select: 'courseCode title unit level type scope faculty department borrowedId prerequisites',
          populate: [
            {
              path: 'borrowedId',
              select: 'courseCode title unit level type scope department'
            },
            {
              path: 'department',
              select: 'name code'
            },
            {
              path: 'faculty',
              select: 'name'
            },
            {
              path: 'prerequisites',
              select: 'courseCode title'
            }
          ]
        })
        .populate('semester', 'name session')
        .populate('clearedBy', 'name email role')
        .populate('createdBy', 'name email role')
        .populate('department', 'name code')
        .populate({
          path: 'courses.result',
          model: 'Result',
          select: 'score grade'
        })
        .sort({ createdAt: -1 })
        .lean();
      
      // Flatten the courses array into individual carryover objects
      const flattenedCarryovers = [];
      
      for (const doc of carryoverDocs) {
        for (const courseItem of doc.courses) {
          // Process the course to handle borrowed courses
          let actualCourse = null;
          let isBorrowed = false;
          
          if (courseItem.course) {
            // Check if this is a borrowed course
            if (courseItem.course.borrowedId) {
              actualCourse = {
                ...courseItem.course.borrowedId,
                isBorrowed: true,
                sourceCourse: {
                  _id: courseItem.course._id,
                  department: courseItem.course.department
                }
              };
              isBorrowed = true;
            } else {
              actualCourse = {
                ...courseItem.course,
                isBorrowed: false
              };
            }
          }
          
          flattenedCarryovers.push({
            _id: doc._id,
            student: doc.student,
            course: actualCourse,
            semester: doc.semester,
            department: doc.department,
            result: courseItem.result,
            grade: courseItem.grade,
            score: courseItem.score,
            reason: doc.reason,
            isCoreCourse: courseItem.isCoreCourse,
            cleared: doc.cleared,
            clearedAt: doc.clearedAt,
            clearedBy: doc.clearedBy,
            attempts: courseItem.attempts,
            remark: courseItem.remark,
            createdBy: doc.createdBy,
            computationBatch: doc.computationBatch,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            isBorrowed,
            // Add computed fields for frontend
            courseTitle: actualCourse?.title || 'Course Title Not Available',
            courseCode: actualCourse?.courseCode || 'N/A',
            creditUnits: actualCourse?.unit || 0,
            courseLevel: actualCourse?.level || 0,
            courseType: actualCourse?.type || 'core',
            isCoreCourseFlag: (actualCourse?.type || 'core') === 'core'
          });
        }
      }
      
      return flattenedCarryovers;
      
    } catch (error) {
      throw new AppError(`Failed to fetch carryover courses`, 500, error);
    }
  }
  
  /**
   * Get carryover statistics for a student
   */
  async getStudentCarryoverStats(studentId) {
    try {
      const carryovers = await this.getStudentCarryovers(studentId);
      
      // Calculate statistics
      const total = carryovers.length;
      const cleared = carryovers.filter(c => c.cleared).length;
      const pending = total - cleared;
      
      // Group by semester
      const bySemester = {};
      carryovers.forEach(course => {
        const semesterName = course.semester?.name || 'Unknown';
        if (!bySemester[semesterName]) {
          bySemester[semesterName] = { 
            total: 0, 
            cleared: 0,
            semesterInfo: course.semester
          };
        }
        bySemester[semesterName].total++;
        if (course.cleared) bySemester[semesterName].cleared++;
      });
      
      // Group by reason
      const byReason = {};
      carryovers.forEach(course => {
        const reason = course.reason || 'Unknown';
        byReason[reason] = (byReason[reason] || 0) + 1;
      });
      
      // Group by course type (core/elective)
      const coreCourses = carryovers.filter(c => c.isCoreCourseFlag).length;
      const electiveCourses = total - coreCourses;
      
      // Group by course level
      const byLevel = {};
      carryovers.forEach(course => {
        const level = course.courseLevel || 'Unknown';
        byLevel[level] = (byLevel[level] || 0) + 1;
      });
      
      // Group by borrowed status
      const borrowedCourses = carryovers.filter(c => c.isBorrowed).length;
      const normalCourses = total - borrowedCourses;
      
      // Get recent carryovers (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const recentCarryovers = carryovers.filter(c => 
        new Date(c.createdAt) > sixMonthsAgo
      );
      
      // Calculate average score for failed courses
      const failedCourses = carryovers.filter(c => c.reason === 'Failed' && c.score);
      const averageScore = failedCourses.length > 0 
        ? failedCourses.reduce((sum, c) => sum + c.score, 0) / failedCourses.length
        : 0;
      
      return {
        total,
        cleared,
        pending,
        clearanceRate: total > 0 ? (cleared / total) * 100 : 0,
        coreCourses,
        electiveCourses,
        borrowedCourses,
        normalCourses,
        averageScore: Math.round(averageScore),
        bySemester,
        byReason,
        byLevel,
        recentCount: recentCarryovers.length,
        latest: carryovers.slice(0, 5)
      };
      
    } catch (error) {
      throw new AppError(`Failed to fetch statistics`, 500, error);
    }
  }
  
  /**
   * Create a new carryover record (now supports multiple courses per semester)
   */
  async createCarryover(carryoverData, createdBy = null) {
    try {
      const { student, courses, semester, reason, department } = carryoverData;
      
      // Validate required fields
      if (!student || !semester || !reason) {
        throw new AppError('Missing required fields: student, semester, reason');
      }
      
      if (!courses || !courses.length) {
        throw new AppError('At least one course is required');
      }
      
      // Check if carryover document already exists for this student and semester
      let existingCarryover = await CarryoverCourse.findOne({
        student,
        semester
      });
      
      // Prepare course items
      const courseItems = [];
      
      for (const courseData of courses) {
        const { course, score, grade, isCoreCourse, attempts, remark } = courseData;
        
        // Validate course
        if (!course) {
          throw new AppError('Course ID is required for each course');
        }
        
        // Get course details to determine if it's a core course
        const courseDoc = await courseModel.findById(course).populate('borrowedId');
        if (!courseDoc) {
          throw new AppError(`Course ${course} not found`);
        }
        
        // Determine actual course (handle borrowed courses)
        const actualCourse = courseDoc.borrowedId || courseDoc;
        
        // Determine if this is a core course (use provided or derive from course type)
        const isCore = isCoreCourse !== undefined ? isCoreCourse : actualCourse.type === 'core';
        
        // Check if this specific course already exists in the document
        if (existingCarryover) {
          const existingCourse = existingCarryover.courses.find(
            c => c.course.toString() === course.toString()
          );
          if (existingCourse) {
            throw new AppError(`Course ${courseDoc.courseCode} already exists in carryover for this semester`);
          }
        }
        
        courseItems.push({
          course,
          result: courseData.result || null,
          grade: grade || null,
          score: score || null,
          isCoreCourse: isCore,
          attempts: attempts || 0,
          remark: remark || null
        });
      }
      
      // Get student department if not provided
      let studentDepartment = department;
      if (!studentDepartment) {
        const studentDoc = await StudentService.getStudentById(student);
        if (!studentDoc) {
          throw new AppError('Student not found');
        }
        studentDepartment = studentDoc.departmentId || studentDoc.department;
      }
      
      if (existingCarryover) {
        // Add new courses to existing document
        existingCarryover.courses.push(...courseItems);
        existingCarryover.updatedAt = new Date();
        await existingCarryover.save();
        
        // Populate and return
        const populated = await CarryoverCourse.findById(existingCarryover._id)
          .populate({
            path: 'courses.course',
            populate: {
              path: 'borrowedId',
              select: 'courseCode title unit level'
            }
          })
          .populate('semester')
          .populate('student', 'name matric_no')
          .lean();
        
        return this.processCarryoverDocument(populated);
      } else {
        // Create new carryover document
        const carryover = new CarryoverCourse({
          student,
          courses: courseItems,
          semester,
          department: studentDepartment,
          reason,
          createdBy
        });
        
        await carryover.save();
        
        // Populate and return
        const populated = await CarryoverCourse.findById(carryover._id)
          .populate({
            path: 'courses.course',
            populate: {
              path: 'borrowedId',
              select: 'courseCode title unit level'
            }
          })
          .populate('semester')
          .populate('student', 'name matric_no')
          .lean();
        
        return this.processCarryoverDocument(populated);
      }
      
    } catch (error) {
      console.error('Error creating carryover:', error);
      throw error;
    }
  }
  
  /**
   * Update a specific course within a carryover document
   */
  async updateCarryoverCourse(carryoverId, courseId, updateData) {
    try {
      const carryover = await CarryoverCourse.findById(carryoverId);
      
      if (!carryover) {
        throw new AppError('Carryover record not found');
      }
      
      // Find the specific course in the array
      const courseIndex = carryover.courses.findIndex(
        c => c.course.toString() === courseId
      );
      
      if (courseIndex === -1) {
        throw new AppError('Course not found in carryover record');
      }
      
      // Update the course fields
      const allowedUpdates = ['grade', 'score', 'attempts', 'remark', 'result', 'isCoreCourse'];
      allowedUpdates.forEach(field => {
        if (updateData[field] !== undefined) {
          carryover.courses[courseIndex][field] = updateData[field];
        }
      });
      
      await carryover.save();
      
      return await this.getCarryoverById(carryoverId);
      
    } catch (error) {
      console.error('Error updating carryover course:', error);
      throw error;
    }
  }
  
  /**
   * Update carryover clearance status (clears all courses in the document)
   */
  async updateCarryoverClearance(carryoverId, cleared, clearedBy, remark = null) {
    try {
      const carryover = await CarryoverCourse.findById(carryoverId);
      
      if (!carryover) {
        throw new AppError('Carryover record not found');
      }
      
      // Update clearance status for the entire document
      carryover.cleared = cleared;
      if (cleared) {
        carryover.clearedAt = new Date();
        carryover.clearedBy = clearedBy;
      } else {
        carryover.clearedAt = null;
        carryover.clearedBy = null;
      }
      
      if (remark) {
        carryover.remark = remark;
      }
      
      await carryover.save();
      
      return await this.getCarryoverById(carryoverId);
      
    } catch (error) {
      console.error('Error updating carryover clearance:', error);
      throw error;
    }
  }
  
  /**
   * Clear a specific course within a carryover document
   */
  async clearSpecificCourse(carryoverId, courseId, clearedBy) {
    try {
      const carryover = await CarryoverCourse.findById(carryoverId);
      
      if (!carryover) {
        throw new AppError('Carryover record not found');
      }
      
      // Find the specific course in the array
      const courseIndex = carryover.courses.findIndex(
        c => c.course.toString() === courseId
      );
      
      if (courseIndex === -1) {
        throw new AppError('Course not found in carryover record');
      }
      
      // Remove the cleared course from the array
      carryover.courses.splice(courseIndex, 1);
      
      // If no courses left, mark the entire document as cleared
      if (carryover.courses.length === 0) {
        carryover.cleared = true;
        carryover.clearedAt = new Date();
        carryover.clearedBy = clearedBy;
      }
      
      await carryover.save();
      
      return await this.getCarryoverById(carryoverId);
      
    } catch (error) {
      console.error('Error clearing specific course:', error);
      throw error;
    }
  }
  
  /**
   * Get single carryover by ID with full population (returns flattened structure)
   */
  async getCarryoverById(carryoverId) {
    try {
      const carryover = await CarryoverCourse.findById(carryoverId)
        .populate({
          path: 'courses.course',
          select: 'courseCode title unit level type scope faculty department borrowedId prerequisites',
          populate: [
            {
              path: 'borrowedId',
              select: 'courseCode title unit level type scope department'
            },
            {
              path: 'department',
              select: 'name code'
            },
            {
              path: 'faculty',
              select: 'name'
            },
            {
              path: 'prerequisites',
              select: 'courseCode title'
            }
          ]
        })
        .populate('semester', 'name session')
        .populate('student', 'name matric_no program level departmentId')
        .populate('clearedBy', 'name email role')
        .populate('createdBy', 'name email role')
        .populate('department', 'name code')
        .populate({
          path: 'courses.result',
          model: 'Result',
          select: 'score grade'
        })
        .lean();
      
      if (!carryover) {
        return null;
      }
      
      return this.processCarryoverDocument(carryover);
      
    } catch (error) {
      console.error('Error fetching carryover by ID:', error);
      throw error;
    }
  }
  
  /**
   * Process carryover document to handle flattened structure
   * Returns an object with courses array intact (not flattened)
   */
  processCarryoverDocument(carryover) {
    if (!carryover) return null;
    
    // Process each course in the array
    const processedCourses = carryover.courses.map(courseItem => {
      let actualCourse = null;
      let isBorrowed = false;
      let sourceDepartment = null;
      
      if (courseItem.course) {
        // Check if this is a borrowed course
        if (courseItem.course.borrowedId) {
          actualCourse = {
            ...courseItem.course.borrowedId,
            isBorrowed: true,
            sourceCourse: {
              _id: courseItem.course._id,
              department: courseItem.course.department
            }
          };
          isBorrowed = true;
          sourceDepartment = courseItem.course.department;
        } else {
          actualCourse = {
            ...courseItem.course,
            isBorrowed: false
          };
        }
      }
      
      // Determine department for display
      const displayDepartment = sourceDepartment || actualCourse?.department || carryover.department;
      
      return {
        ...courseItem,
        course: actualCourse,
        isBorrowed,
        displayDepartment,
        courseTitle: actualCourse?.title || 'Course Title Not Available',
        courseCode: actualCourse?.courseCode || 'N/A',
        creditUnits: actualCourse?.unit || 0,
        courseLevel: actualCourse?.level || 0,
        courseType: actualCourse?.type || 'core',
        isCoreCourse: courseItem.isCoreCourse || (actualCourse?.type === 'core'),
        scope: actualCourse?.scope || 'department'
      };
    });
    
    return {
      ...carryover,
      courses: processedCourses,
      totalCourses: processedCourses.length,
      clearedCourses: processedCourses.filter(c => c.cleared).length
    };
  }
  
  /**
   * Get carryover courses by department (for admin view)
   * Returns flattened structure for easier frontend consumption
   */
  async getCarryoversByDepartment(departmentId, filters = {}) {
    try {
      const { semester, cleared, level } = filters;
      
      const query = { department: departmentId };
      
      if (semester && semester !== 'all') {
        query.semester = semester;
      }
      
      if (cleared && cleared !== 'all') {
        query.cleared = cleared === 'cleared';
      }
      
      // Get carryover documents
      const carryoverDocs = await CarryoverCourse.find(query)
        .populate({
          path: 'courses.course',
          select: 'courseCode title unit level type borrowedId',
          populate: {
            path: 'borrowedId',
            select: 'courseCode title unit level'
          }
        })
        .populate('semester', 'name session')
        .populate('student', 'name matric_no program level')
        .populate('department', 'name code')
        .populate({
          path: 'courses.result',
          model: 'Result',
          select: 'score grade'
        })
        .sort({ createdAt: -1 })
        .lean();
      
      // Flatten the results (one entry per course)
      const flattenedResults = [];
      
      for (const doc of carryoverDocs) {
        for (const courseItem of doc.courses) {
          // Filter by level if specified
          if (level && level !== 'all') {
            const courseLevel = courseItem.course?.borrowedId?.level || courseItem.course?.level;
            if (courseLevel != level) continue;
          }
          
          let actualCourse = null;
          let isBorrowed = false;
          
          if (courseItem.course) {
            if (courseItem.course.borrowedId) {
              actualCourse = {
                ...courseItem.course.borrowedId,
                isBorrowed: true
              };
              isBorrowed = true;
            } else {
              actualCourse = {
                ...courseItem.course,
                isBorrowed: false
              };
            }
          }
          
          flattenedResults.push({
            _id: doc._id,
            student: doc.student,
            course: actualCourse,
            semester: doc.semester,
            department: doc.department,
            grade: courseItem.grade,
            score: courseItem.score,
            reason: doc.reason,
            isCoreCourse: courseItem.isCoreCourse,
            cleared: doc.cleared,
            clearedAt: doc.clearedAt,
            clearedBy: doc.clearedBy,
            attempts: courseItem.attempts,
            remark: courseItem.remark,
            createdBy: doc.createdBy,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            isBorrowed,
            courseCode: actualCourse?.courseCode || 'N/A',
            courseTitle: actualCourse?.title || 'N/A',
            creditUnits: actualCourse?.unit || 0,
            courseLevel: actualCourse?.level || 0
          });
        }
      }
      
      return flattenedResults;
      
    } catch (error) {
      console.error('Error fetching department carryovers:', error);
      throw error;
    }
  }
  
  /**
   * Get carryover summary for dashboard
   */
  async getDashboardSummary(studentId) {
    try {
      const [stats, recentCarryovers, upcomingDeadlines] = await Promise.all([
        this.getStudentCarryoverStats(studentId),
        this.getStudentCarryovers(studentId, { cleared: 'pending' }).then(courses => courses.slice(0, 3)),
        this.getUpcomingCarryoverDeadlines(studentId)
      ]);
      
      return {
        stats,
        recentCarryovers,
        upcomingDeadlines,
        recommendations: this.generateRecommendations(stats)
      };
      
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
      throw error;
    }
  }
  
  /**
   * Get upcoming carryover deadlines
   */
  async getUpcomingCarryoverDeadlines(studentId) {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    return [
      {
        title: 'Next Semester Registration',
        description: 'Register for pending carryover courses',
        deadline: nextMonth,
        priority: 'high'
      },
      {
        title: 'Carryover Clearance Deadline',
        description: 'Submit clearance forms for pending courses',
        deadline: new Date(now.getFullYear(), now.getMonth() + 2, 15),
        priority: 'medium'
      }
    ];
  }
  
  /**
   * Generate recommendations based on carryover statistics
   */
  generateRecommendations(stats) {
    const recommendations = [];
    
    if (stats.pending > 0) {
      recommendations.push({
        type: 'warning',
        message: `You have ${stats.pending} pending carryover course(s).`,
        action: 'Register for these courses in the next semester.'
      });
    }
    
    if (stats.averageScore > 0 && stats.averageScore < 40) {
      recommendations.push({
        type: 'danger',
        message: `Your average score in failed courses is low (${stats.averageScore}%).`,
        action: 'Consider seeking academic advising or tutoring.'
      });
    }
    
    if (stats.coreCourses > 2) {
      recommendations.push({
        type: 'warning',
        message: `You have ${stats.coreCourses} core course carryovers.`,
        action: 'Core courses are critical for progression. Prioritize clearing them.'
      });
    }
    
    if (stats.clearanceRate > 50) {
      recommendations.push({
        type: 'success',
        message: `You've cleared ${Math.round(stats.clearanceRate)}% of your carryovers. Keep it up!`,
        action: 'Continue with your current study habits.'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Delete a carryover document (entire semester's carryovers)
   */
  async deleteCarryover(carryoverId) {
    try {
      const carryover = await CarryoverCourse.findByIdAndDelete(carryoverId);
      return carryover;
    } catch (error) {
      console.error('Error deleting carryover:', error);
      throw error;
    }
  }
  
  /**
   * Delete a specific course from a carryover document
   */
  async deleteCarryoverCourse(carryoverId, courseId) {
    try {
      const carryover = await CarryoverCourse.findById(carryoverId);
      
      if (!carryover) {
        throw new AppError('Carryover record not found');
      }
      
      // Remove the specific course
      carryover.courses = carryover.courses.filter(
        c => c.course.toString() !== courseId
      );
      
      // If no courses left, delete the entire document
      if (carryover.courses.length === 0) {
        await CarryoverCourse.findByIdAndDelete(carryoverId);
        return { deleted: true, message: 'Entire carryover document deleted (no courses left)' };
      }
      
      await carryover.save();
      return { deleted: true, message: 'Course removed from carryover' };
      
    } catch (error) {
      console.error('Error deleting carryover course:', error);
      throw error;
    }
  }
  
  /**
   * Get carryovers by students (for bulk operations)
   * Returns flattened structure grouped by student
   */
  async getCarryoversByStudents(studentIds) {
    const carryovers = await CarryoverCourse.find({
      student: { $in: studentIds },
      cleared: false
    })
    .populate("student", "name matricNumber")
    .populate({
      path: "courses.course",
      model: "Course",
      select: "courseCode title credits type level",
      populate: {
        path: "borrowedId",
        select: "courseCode title credits type level"
      }
    })
    .lean();

    const result = {};
    
    for (const carryover of carryovers) {
      const studentId = carryover.student._id.toString();
      if (!result[studentId]) result[studentId] = [];
      
      for (const courseItem of carryover.courses) {
        result[studentId].push({
          ...carryover,
        });
      }
    }

    return result;
  }
}

export default new CarryoverService();