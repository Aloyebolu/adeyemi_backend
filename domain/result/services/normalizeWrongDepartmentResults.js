import mongoose from "mongoose";
import Result from "#domain/result/result.model.js";
import Course from "#domain/course/course.model.js";
import connectToDB from "#config/db.js";
import { normalizeCourse } from "#domain/course/course.normallizer.js";
connectToDB();

export async function analyzeWrongCourseDepartments(ourDepartmentId, batchSize = 100, dryRun = true) {
  console.log("Starting department-course mismatch analysis with duplicate detection...");
  
  // Step 1: Get all departments and courses to memory
  console.log("Loading departments and courses into memory...");
  
  const allCourses = await Course.find()
    .populate("department")
    .lean();
  
  const coursesByDepartment = {};
  const courseMap = new Map();
  const departmentMap = new Map();
  
  // Create lookup maps for fast access
  allCourses.forEach(course => {
    const deptId = String(course.department._id);
    
    if (!coursesByDepartment[deptId]) {
      coursesByDepartment[deptId] = [];
      departmentMap.set(deptId, course.department);
    }
    
    coursesByDepartment[deptId].push(course);
    
    if (!courseMap.has(course.courseCode)) {
      courseMap.set(course.courseCode, []);
    }
    courseMap.get(course.courseCode).push(course);
    
    if (course.borrowedId) {
      const borrowedKey = `borrowed_${course.borrowedId}`;
      if (!courseMap.has(borrowedKey)) {
        courseMap.set(borrowedKey, []);
      }
      courseMap.get(borrowedKey).push(course);
    }
  });
  
  console.log(`Loaded ${allCourses.length} courses from ${departmentMap.size} departments`);
  
  // CRITICAL: Load ALL existing results into memory to check for duplicates
  // This gives us full context regardless of batch processing
  console.log("Loading all existing results for duplicate detection context...");
  
  const allExistingResults = await Result.find()
    .select('studentId courseId semester')
    .lean();
  
  // Create a map for quick duplicate checking
  const existingResultMap = new Map();
  allExistingResults.forEach(result => {
    const key = `${result.studentId}_${result.courseId}_${result.semester || 'null'}`;
    existingResultMap.set(key, result);
  });
  
  console.log(`Loaded ${allExistingResults.length} existing results for duplicate context`);
  
  // Step 2: Get total count for batch processing
  const totalResults = await Result.countDocuments();
  const totalBatches = Math.ceil(totalResults / batchSize);
  
  console.log(`Processing ${totalResults} results in ${totalBatches} batches of ${batchSize}...`);
  
  // Trackers that persist across batches
  const mismatchedResults = [];
  const duplicateConflictTracker = new Map(); // Tracks potential duplicate conflicts
  const resolvedCourseTracker = new Map(); // Tracks which courses we're planning to update
  
  // Statistics tracking
  const stats = {
    totalProcessed: 0,
    correctDepartment: 0,
    wrongDepartment: 0,
    noCourse: 0,
    resolved: 0,
    unresolved: 0,
    duplicateConflicts: 0,
    safeToUpdate: 0
  };
  
  // Step 3: Process in batches to find mismatches
  for (let batch = 0; batch < totalBatches; batch++) {
    const skip = batch * batchSize;
    
    console.log(`Processing batch ${batch + 1}/${totalBatches} (${skip} - ${skip + batchSize})...`);
    
    const batchResults = await Result.find()
      .skip(skip)
      .limit(batchSize)
      .populate({
        path: "courseId",
        populate: { path: "department" }
      })
      .lean();
    
    // Step 4: Check each result in the batch
    for (const result of batchResults) {
      stats.totalProcessed++;
      
      const course = result.courseId;
      
      if (!course) {
        stats.noCourse++;
        continue;
      }
      
      // Check if course is for the correct department
      if (String(course.department._id) === String(ourDepartmentId)) {
        stats.correctDepartment++;
        continue;
      }
      
      stats.wrongDepartment++;
      
      // Find the correct course ID for our department
      const borrowedRoot = course.borrowedId || course._id;
      const correctCourse = findCorrectCourse(course, borrowedRoot, ourDepartmentId, courseMap, allCourses);
      
      // Create mismatch record
      const mismatchRecord = {
        studentId: result.studentId,
        resultId: result._id,
        semester: result.semester || null,
        courseId: course._id,
        courseCode: course.courseCode,
        courseName: course.name,
        currentDepartmentId: course.department._id,
        currentDepartmentName: course.department.name,
        realCourseId: correctCourse?._id || null,
        realCourseCode: correctCourse?.courseCode || null,
        realCourseName: correctCourse?.name || null,
        borrowedId: course.borrowedId || null,
        isResolved: !!correctCourse,
        hasDuplicateConflict: false,
        duplicateConflictDetails: null
      };
      
      if (correctCourse) {
        stats.resolved++;
        
        // Check for potential duplicate conflicts
        const potentialKey = `${result.studentId}_${correctCourse._id}_${result.semester || 'null'}`;
        
        // Track this resolution
        if (!resolvedCourseTracker.has(potentialKey)) {
          resolvedCourseTracker.set(potentialKey, []);
        }
        resolvedCourseTracker.get(potentialKey).push({
          resultId: result._id,
          originalCourseId: course._id,
          originalCourseCode: course.courseCode
        });
        
        // Check if this would create a duplicate
        const existingResult = existingResultMap.get(potentialKey);
        const plannedUpdates = resolvedCourseTracker.get(potentialKey) || [];
        
        if (existingResult || plannedUpdates.length > 1) {
          mismatchRecord.hasDuplicateConflict = true;
          mismatchRecord.duplicateConflictDetails = {
            conflictKey: potentialKey,
            existingResultId: existingResult?._id || null,
            conflictingUpdates: plannedUpdates.map(u => u.resultId),
            reason: existingResult 
              ? 'Another result already exists with this course/semester combination'
              : 'Multiple wrong-department results would resolve to the same course/semester'
          };
          
          stats.duplicateConflicts++;
          
          // Track the conflict
          if (!duplicateConflictTracker.has(potentialKey)) {
            duplicateConflictTracker.set(potentialKey, {
              studentId: result.studentId,
              semester: result.semester,
              correctCourseId: correctCourse._id,
              correctCourseCode: correctCourse.courseCode,
              existingResult: existingResult || null,
              conflictingResults: []
            });
          }
          
          duplicateConflictTracker.get(potentialKey).conflictingResults.push({
            resultId: result._id,
            originalCourseId: course._id,
            originalCourseCode: course.courseCode,
            originalDepartmentName: course.department.name
          });
        } else {
          stats.safeToUpdate++;
        }
      } else {
        stats.unresolved++;
      }
      
      mismatchedResults.push(mismatchRecord);
    }
    
    // Clear batch from memory
    batchResults.length = 0;
  }
  
  console.log("\n======== BATCH PROCESSING COMPLETE ========");
  console.log(`Total results processed: ${stats.totalProcessed}`);
  console.log(`Correct department: ${stats.correctDepartment}`);
  console.log(`Wrong department: ${stats.wrongDepartment}`);
  console.log(`No course assigned: ${stats.noCourse}`);
  console.log(`Resolved mismatches: ${stats.resolved}`);
  console.log(`Unresolved mismatches: ${stats.unresolved}`);
  console.log(`Safe to update (no conflicts): ${stats.safeToUpdate}`);
  console.log(`⚠️  Duplicate conflicts detected: ${stats.duplicateConflicts}`);
  
  // Perform analysis on mismatched results with duplicate detection
  const analysis = analyzeMismatchedResults(mismatchedResults, duplicateConflictTracker);
  
  // Display analysis
  displayAnalysis(analysis);
  
  // If not dry run, apply ONLY the safe updates
  if (!dryRun && stats.safeToUpdate > 0) {
    console.log("\n======== APPLYING SAFE UPDATES ========");
    await applySafeUpdates(mismatchedResults, duplicateConflictTracker);
  } else if (!dryRun && stats.safeToUpdate === 0) {
    console.log("\n⚠️  No safe updates to apply - all updates would cause conflicts");
  }
  
  return {
    stats,
    analysis,
    mismatchedResults,
    duplicateConflicts: Array.from(duplicateConflictTracker.values()),
    dryRun
  };
}

function findCorrectCourse(wrongCourse, borrowedRoot, targetDepartmentId, courseMap, allCourses) {
  // Strategy 1: Look for course in target department with same borrowedId
  const borrowedKey = `borrowed_${borrowedRoot}`;
  if (courseMap.has(borrowedKey)) {
    const matchingCourses = courseMap.get(borrowedKey);
    const correctCourse = matchingCourses.find(c => 
      String(c.department._id) === String(targetDepartmentId)
    );
    if (correctCourse) return correctCourse;
  }
  
  // Strategy 2: Look for course in target department with same course code
  if (courseMap.has(wrongCourse.courseCode)) {
    const matchingCourses = courseMap.get(wrongCourse.courseCode);
    const correctCourse = matchingCourses.find(c => 
      String(c.department._id) === String(targetDepartmentId)
    );
    if (correctCourse) return correctCourse;
  }
  
  // Strategy 3: Look for course in target department with matching name and code pattern
  const targetDeptCourses = allCourses.filter(c => 
    String(c.department._id) === String(targetDepartmentId)
  );
  
  const similarCourse = targetDeptCourses.find(c => 
    c.courseCode === wrongCourse.courseCode ||
    c.name === wrongCourse.name ||
    (c.borrowedId && String(c.borrowedId) === String(borrowedRoot))
  );
  
  return similarCourse || null;
}

async function applySafeUpdates(mismatchedResults, duplicateConflictTracker) {
  const conflictResultIds = new Set();
  
  // Collect all result IDs that are involved in conflicts
  duplicateConflictTracker.forEach((conflict, key) => {
    conflict.conflictingResults.forEach(result => {
      conflictResultIds.add(String(result.resultId));
    });
  });
  
  // Filter to only safe updates
  const safeUpdates = mismatchedResults.filter(result => 
    result.isResolved && 
    !result.hasDuplicateConflict &&
    !conflictResultIds.has(String(result.resultId))
  );
  
  console.log(`Applying ${safeUpdates.length} safe updates...`);
  
  // Apply in batches to avoid overwhelming the database
  const updateBatchSize = 50;
  for (let i = 0; i < safeUpdates.length; i += updateBatchSize) {
    const batch = safeUpdates.slice(i, i + updateBatchSize);
    
    const bulkOps = batch.map(update => ({
      updateOne: {
        filter: { _id: update.resultId },
        update: { $set: { courseId: update.realCourseId } }
      }
    }));
    
    await Result.bulkWrite(bulkOps);
    console.log(`Updated ${i + batch.length}/${safeUpdates.length} results`);
  }
  
  console.log(`✅ Successfully applied ${safeUpdates.length} updates`);
}

function analyzeMismatchedResults(mismatchedResults, duplicateConflictTracker) {
  const analysis = {
    totalMismatches: mismatchedResults.length,
    studentsAffected: new Set(mismatchedResults.map(r => String(r.studentId))).size,
    resolvedCount: mismatchedResults.filter(r => r.isResolved).length,
    unresolvedCount: mismatchedResults.filter(r => !r.isResolved).length,
    safeUpdateCount: mismatchedResults.filter(r => r.isResolved && !r.hasDuplicateConflict).length,
    duplicateConflictCount: mismatchedResults.filter(r => r.hasDuplicateConflict).length,
    
    studentsWithMultipleMismatches: {},
    problematicCourses: {},
    wrongDepartmentDistribution: {},
    duplicateOriginalCourses: {},
    duplicateConflicts: Array.from(duplicateConflictTracker.values()),
    
    fixRecommendations: []
  };
  
  // Count mismatches per student
  mismatchedResults.forEach(result => {
    const studentId = String(result.studentId);
    if (!analysis.studentsWithMultipleMismatches[studentId]) {
      analysis.studentsWithMultipleMismatches[studentId] = {
        count: 0,
        safeCount: 0,
        conflictCount: 0,
        results: []
      };
    }
    analysis.studentsWithMultipleMismatches[studentId].count++;
    if (result.hasDuplicateConflict) {
      analysis.studentsWithMultipleMismatches[studentId].conflictCount++;
    } else if (result.isResolved) {
      analysis.studentsWithMultipleMismatches[studentId].safeCount++;
    }
    analysis.studentsWithMultipleMismatches[studentId].results.push(result);
    
    // Track problematic courses
    const courseKey = `${result.courseCode}_${result.currentDepartmentId}`;
    if (!analysis.problematicCourses[courseKey]) {
      analysis.problematicCourses[courseKey] = {
        courseCode: result.courseCode,
        courseName: result.courseName,
        currentDepartment: result.currentDepartmentName,
        count: 0,
        resolved: 0,
        safe: 0,
        conflicts: 0
      };
    }
    analysis.problematicCourses[courseKey].count++;
    if (result.isResolved) {
      analysis.problematicCourses[courseKey].resolved++;
      if (result.hasDuplicateConflict) {
        analysis.problematicCourses[courseKey].conflicts++;
      } else {
        analysis.problematicCourses[courseKey].safe++;
      }
    }
    
    // Track department distribution
    if (!analysis.wrongDepartmentDistribution[result.currentDepartmentName]) {
      analysis.wrongDepartmentDistribution[result.currentDepartmentName] = 0;
    }
    analysis.wrongDepartmentDistribution[result.currentDepartmentName]++;
    
    // Check for duplicate original courses per student
    const key = `${studentId}_${result.courseCode}`;
    if (!analysis.duplicateOriginalCourses[key]) {
      analysis.duplicateOriginalCourses[key] = [];
    }
    analysis.duplicateOriginalCourses[key].push(result);
  });
  
  // Find students with > 1 mismatch
  analysis.studentsWithMultipleMismatchesList = Object.entries(analysis.studentsWithMultipleMismatches)
    .filter(([_, data]) => data.count > 1)
    .sort((a, b) => b[1].count - a[1].count);
  
  // Find duplicate original courses
  analysis.duplicateOriginalCoursesList = Object.entries(analysis.duplicateOriginalCourses)
    .filter(([_, results]) => results.length > 1)
    .map(([key, results]) => ({
      studentId: key.split('_')[0],
      courseCode: key.split('_')[1],
      occurrences: results.length,
      results: results
    }));
  
  // Generate fix recommendations with conflict awareness
  mismatchedResults.forEach(result => {
    if (result.isResolved && !result.hasDuplicateConflict) {
      analysis.fixRecommendations.push({
        type: 'SAFE_AUTO_FIX',
        priority: 'HIGH',
        studentId: result.studentId,
        resultId: result.resultId,
        from: `${result.courseCode} (${result.currentDepartmentName})`,
        to: `${result.realCourseCode} (Target Department)`,
        confidence: 'HIGH'
      });
    } else if (result.isResolved && result.hasDuplicateConflict) {
      analysis.fixRecommendations.push({
        type: 'DUPLICATE_CONFLICT',
        priority: 'CRITICAL',
        studentId: result.studentId,
        resultId: result.resultId,
        conflict: result.duplicateConflictDetails,
        recommendation: 'Manual review required - multiple results would map to same course/semester'
      });
    } else {
      analysis.fixRecommendations.push({
        type: 'MANUAL_REVIEW_NEEDED',
        priority: 'MEDIUM',
        studentId: result.studentId,
        resultId: result.resultId,
        course: result.courseCode,
        currentDepartment: result.currentDepartmentName,
        reason: 'No matching course found in target department'
      });
    }
  });
  
  return analysis;
}

function displayAnalysis(analysis) {
  console.log("\n======== DETAILED ANALYSIS ========");
  console.log(`Total mismatches found: ${analysis.totalMismatches}`);
  console.log(`Students affected: ${analysis.studentsAffected}`);
  console.log(`✅ Safe to auto-fix: ${analysis.safeUpdateCount} (${(analysis.safeUpdateCount/analysis.totalMismatches*100).toFixed(1)}%)`);
  console.log(`⚠️  Conflicts detected: ${analysis.duplicateConflictCount}`);
  console.log(`❌ Unresolved: ${analysis.unresolvedCount}`);
  
  if (analysis.duplicateConflicts.length > 0) {
    console.log("\n======== ⚠️  DUPLICATE CONFLICTS DETAILED ========");
    analysis.duplicateConflicts.forEach((conflict, index) => {
      console.log(`\nConflict #${index + 1}:`);
      console.log(`Student ID: ${conflict.studentId}`);
      console.log(`Semester: ${conflict.semester || 'Not specified'}`);
      console.log(`Would resolve to: ${conflict.correctCourseCode} (ID: ${conflict.correctCourseId})`);
      
      if (conflict.existingResult) {
        console.log(`⚠️  Already exists: Result ID ${conflict.existingResult._id}`);
      }
      
      console.log(`Conflicting results that would map here:`);
      conflict.conflictingResults.forEach((result, i) => {
        console.log(`  ${i + 1}. Result ID: ${result.resultId}`);
        console.log(`     Original course: ${result.originalCourseCode} (${result.originalDepartmentName})`);
      });
      
      console.log(`💡 Resolution suggestions:`);
      console.log(`   - Keep only one result and delete/archive the others`);
      console.log(`   - Check if semesters are different and update accordingly`);
      console.log(`   - Verify if these are duplicate entries in the system`);
    });
  }
  
  console.log("\n======== TOP PROBLEMATIC COURSES ========");
  const topCourses = Object.values(analysis.problematicCourses)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  topCourses.forEach((course, index) => {
    console.log(`${index + 1}. ${course.courseCode} (${course.courseName})`);
    console.log(`   Department: ${course.currentDepartment}`);
    console.log(`   Total: ${course.count} | Safe: ${course.safe} | Conflicts: ${course.conflicts}`);
  });
  
  console.log("\n======== FIX RECOMMENDATIONS SUMMARY ========");
  const safeFixes = analysis.fixRecommendations.filter(r => r.type === 'SAFE_AUTO_FIX').length;
  const conflicts = analysis.fixRecommendations.filter(r => r.type === 'DUPLICATE_CONFLICT').length;
  const manual = analysis.fixRecommendations.filter(r => r.type === 'MANUAL_REVIEW_NEEDED').length;
  
  console.log(`✅ SAFE_AUTO_FIX: ${safeFixes} - Can be applied immediately`);
  console.log(`⚠️  DUPLICATE_CONFLICT: ${conflicts} - Require manual resolution`);
  console.log(`❌ MANUAL_REVIEW_NEEDED: ${manual} - No matching course found`);
  
  if (conflicts > 0) {
    console.log("\n⚠️  CONFLICT RESOLUTION STRATEGIES:");
    console.log("1. For multiple same-semester results: Keep the most recent/best grade, delete others");
    console.log("2. For different semesters: Update semester field if incorrectly set");
    console.log("3. For true duplicates: Archive or delete duplicate entries");
    console.log("4. Consider creating a manual resolution interface for these cases");
  }
}

// Helper function to generate a detailed conflict resolution report
export async function generateConflictResolutionReport(ourDepartmentId) {
  const result = await analyzeWrongCourseDepartments(ourDepartmentId, 100, true);
  
  // Group conflicts by student for easier resolution
  const conflictsByStudent = {};
  
  result.duplicateConflicts.forEach(conflict => {
    const studentId = String(conflict.studentId);
    if (!conflictsByStudent[studentId]) {
      conflictsByStudent[studentId] = [];
    }
    conflictsByStudent[studentId].push(conflict);
  });
  
  console.log("\n======== CONFLICT RESOLUTION REPORT ========");
  console.log(`Total students with conflicts: ${Object.keys(conflictsByStudent).length}`);
  
  // Generate suggested resolution actions
  const resolutionActions = [];
  
  Object.entries(conflictsByStudent).forEach(([studentId, conflicts]) => {
    conflicts.forEach(conflict => {
      if (conflict.conflictingResults.length > 1) {
        // Suggest keeping the first one and deleting others
        const [keep, ...remove] = conflict.conflictingResults;
        
        resolutionActions.push({
          type: 'KEEP_ONE_DELETE_OTHERS',
          studentId,
          courseCode: conflict.correctCourseCode,
          semester: conflict.semester,
          keep: keep.resultId,
          remove: remove.map(r => r.resultId),
          reason: 'Multiple results resolve to same course/semester'
        });
      }
    });
  });
  
  console.log(`\nSuggested automatic resolutions: ${resolutionActions.length}`);
  resolutionActions.slice(0, 5).forEach((action, i) => {
    console.log(`\n${i + 1}. Student ${action.studentId} - ${action.courseCode}`);
    console.log(`   Keep: ${action.keep}`);
    console.log(`   Remove: ${action.remove.join(', ')}`);
  });
  
  return {
    summary: result.stats,
    conflictsByStudent,
    resolutionActions,
    fullAnalysis: result.analysis
  };
}

// Usage example
analyzeWrongCourseDepartments("692857cfc3c2904e51b75554", 100, false).then((result) => {
  console.log("\n======== ANALYSIS COMPLETE ========");
  console.log(`Mode: ${result.dryRun ? 'DRY RUN (No changes made)' : 'LIVE RUN (Safe changes applied)'}`);
  
  if (result.stats.duplicateConflicts > 0) {
    console.log("\n⚠️  WARNING: Duplicate conflicts detected!");
    console.log("Run generateConflictResolutionReport() for detailed resolution suggestions");
  }
  
  mongoose.connection.close();
}).catch((err) => {
  console.error("Error during analysis:", err);
  mongoose.connection.close();
});