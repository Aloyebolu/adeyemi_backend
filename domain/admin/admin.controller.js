import buildResponse from "../../utils/responseBuilder.js";
import { fetchDataHelper } from "../../utils/fetchDataHelper.js";
import { dataMaps } from "../../config/dataMap.js";
import studentModel from "../student/student.model.js";
import lecturerModel from "../lecturer/lecturer.model.js";
import courseModel from "../course/course.model.js";
import User from "../user/user.model.js";
import { AcademicSemester } from "../semester/semester.academicModel.js";
import { exportCourseResultsToExcel } from "../result/services/batchExportToExcel.js";
import SemesterService from "../semester/semester.service.js";
import { rebuildStudentRegistrations } from "../result/services/correctReigstrationsByResults.js";

export const getAdminOverview = async (req, res, next) => {
  try {
    // BYPASS : SHOULD NOT BE HERE
    // const semester = await SemesterService.getActiveAcademicSemester()
    // const activeSemester = "699dac0dfdc3939b647669be";
    // await exportCourseResultsToExcel(activeSemester)
    // await normalizeWrongCourseDepartment('692857cfc3c2904e51b75554')
    // await rebuildStudentRegistrations({semesterId: activeSemester, session:'2024/2025'})
    // 118, 172
    // ccs/22u should be removed

    const models = { studentModel, lecturerModel, courseModel, AcademicSemester };
    const [activeSemester, totalStudents, totalLecturers, totalCourses] = await Promise.all([
      SemesterService.getActiveAcademicSemester(),
      studentModel.countDocuments(),
      lecturerModel.countDocuments(),
      courseModel.countDocuments()
    ]);

    const result = {
      activeSemester: activeSemester ? activeSemester.name : "N/A",
      totalStudents,
      totalLecturers,
      totalCourses,
      activeDatabase: process.env.MONGODB_URI2 || "Not set"
    };

    return buildResponse(res, 200, "Admin overview data fetched successfully", [result]);

  } catch (error) {
    next(error)
  }
};
