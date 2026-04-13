export default {
  name: "rebuild-master-sheets",
  description: "Rebuild master result sheets for all departments",
  
  run: async (deps, params) => {
    const { models } = deps;
    const { academicYear, department } = params;
    
    const query = {};
    if (academicYear) query.academicYear = academicYear;
    if (department) query.department = department;
    
    // Get all results grouped by department and semester
    const results = await models.Result.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            department: "$department",
            semester: "$semester",
            course: "$course"
          },
          results: { $push: "$$ROOT" },
          totalStudents: { $sum: 1 },
          averageMarks: { $avg: "$totalMarks" }
        }
      },
      {
        $group: {
          _id: {
            department: "$_id.department",
            semester: "$_id.semester"
          },
          courses: { $push: "$$ROOT" },
          totalCourses: { $sum: 1 }
        }
      }
    ]);
    
    // Create master sheet entries
    const masterSheets = [];
    for (const group of results) {
      const masterSheet = await models.MasterSheet.findOneAndUpdate(
        {
          department: group._id.department,
          semester: group._id.semester,
          academicYear: academicYear || new Date().getFullYear()
        },
        {
          $set: {
            courses: group.courses,
            totalCourses: group.totalCourses,
            lastRebuilt: new Date()
          }
        },
        { upsert: true, new: true }
      );
      
      masterSheets.push(masterSheet);
    }
    
    return {
      masterSheetsCreated: masterSheets.length,
      details: masterSheets.map(ms => ({
        id: ms._id,
        department: ms.department,
        semester: ms.semester,
        totalCourses: ms.totalCourses
      }))
    };
  }
};