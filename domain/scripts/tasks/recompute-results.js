/**
 * Script to recalculate student results
 */
export default {
  name: "recompute-results",
  description: "Recalculate student results for a given semester and course",
  
  /**
   * Execute the script
   * @param {Object} deps - Dependencies
   * @param {Object} deps.models - Database models
   * @param {Object} params - Script parameters
   * @returns {Promise<Object>} Execution result
   */
  run: async (deps, params) => {
    const { models } = deps;
    const { semester, courseId } = params;
    
    if (!semester) {
      throw new Error("Semester parameter is required");
    }
    
    // Build query
    const query = { semester };
    if (courseId) {
      query.course = courseId;
    }
    
    // Find all results to recompute
    const results = await models.Result.find(query);
    
    const updated = [];
    const errors = [];
    
    // Process each result
    for (const result of results) {
      try {
        // Recompute total marks and grade
        const totalMarks = (result.marksObtained || 0) + (result.practicalMarks || 0);
        let grade = 'F';
        
        if (totalMarks >= 80) grade = 'A';
        else if (totalMarks >= 70) grade = 'B';
        else if (totalMarks >= 60) grade = 'C';
        else if (totalMarks >= 50) grade = 'D';
        else if (totalMarks >= 40) grade = 'E';
        
        // Update the result
        result.totalMarks = totalMarks;
        result.grade = grade;
        result.lastComputed = new Date();
        
        await result.save();
        
        updated.push({
          id: result._id,
          student: result.student,
          totalMarks,
          grade
        });
      } catch (error) {
        errors.push({
          id: result._id,
          error: error.message
        });
      }
    }
    
    return {
      summary: {
        totalProcessed: results.length,
        updated: updated.length,
        errors: errors.length
      },
      details: {
        updated,
        errors
      }
    };
  }
};