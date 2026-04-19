import buildResponse from "#utils/responseBuilder.js";
import CarryoverCourse from "#domain/user/student/carryover/carryover.model.js";
import ComputationSummary from "#domain/computation/models/computation.model.js";
import studentModel from "#domain/user/student/student.model.js";
// IMPORTANT: Import Faculty model to register it
import "#domain/organization/faculty/faculty.model.js";
import mongoose from "mongoose";
import SemesterService from "#domain/semester/semester.service.js";
import { resolveUserName } from "#utils/resolveUserName.js";
import AppError from "#shared/errors/AppError.js";
import programmeService from "#domain/programme/programme.service.js";
import facultyModel from "../../organization/faculty/faculty.model.js";
import lecturerModel from "#domain/user/lecturer/lecturer.model.js";
import userModel from "#domain/user/user.model.js";
import departmentService from "#domain/organization/department/department.service.js";

/**
 * Get department leadership details (Dean and HOD)
 */
export async function getDepartmentLeadershipDetails(department, activeSemester, programme) {
  try {

    if (mongoose.Types.ObjectId.isValid(department)) {
      department = await departmentService.getDepartmentById(department);
    }

    if (mongoose.Types.ObjectId.isValid(activeSemester)) {
      activeSemester = await SemesterService.getAcademicSemesterById(activeSemester);
    }

    if (mongoose.Types.ObjectId.isValid(programme)) {
      programme = await programmeService.getProgrammeById(programme);
    }


    // 2. Get active semester with active department Semester
    const activeDepartmentSemester = await SemesterService.getDepartmentSemester(department._id)

    // 3. Get faculty using raw query
    let faculty = null;
    if (department.faculty) {
      faculty = await facultyModel.findOne({
        _id: new mongoose.Types.ObjectId(department.faculty)
      });

    }

    // 4. Get HOD details using raw queries
    let hodDetails = null;
    if (department.hod) {
      const hodLecturer = await lecturerModel.findOne({
        _id: new mongoose.Types.ObjectId(department.hod)
      });

      if (hodLecturer) {
        // Get user details for HOD
        const hodUser = await userModel.findOne({
          _id: new mongoose.Types.ObjectId(hodLecturer._id)
        });
        hodDetails = {
          name: resolveUserName(hodUser, "getDepartmentLeadershipDetails.hod") || resolveUserName(hodLecturer, "getDepartmentLeadershipDetails.hod") || 'Undefined',
          first_name: hodUser.first_name,
          middle_name: hodUser.middle_name,
          last_name: hodUser.last_name,
          title: hodUser.title,
          rank: hodLecturer.rank || 'Professor',
          staffId: hodLecturer.staffId || '',
          signature: hodLecturer.signature || '',
          isHOD: hodLecturer.isHOD || true
        };
      }
    }

    // 5. Get Dean details using raw queries
    let deanDetails = null;
    if (faculty && faculty.dean) {
      const deanLecturer = await lecturerModel.findOne({
        _id: new mongoose.Types.ObjectId(faculty.dean)
      });

      if (deanLecturer) {
        // Get user details for Dean
        const deanUser = await userModel.findOne({
          _id: new mongoose.Types.ObjectId(deanLecturer._id)
        });

        deanDetails = {
          name: resolveUserName(deanUser, "getDepartmentLeadershipDetails.dean") || resolveUserName(deanLecturer, "getDepartmentLeadershipDetails.dean") || 'Undefined',
          first_name: deanUser.first_name,
          middle_name: deanUser.middle_name,
          last_name: deanUser.last_name,
          title: deanUser.title,
          rank: deanLecturer.rank || 'Professor',
          staffId: deanLecturer.staffId || '',
          signature: deanLecturer.signature || '',
          isDean: deanLecturer.isDean || true
        };
      }
    }

    // 6. Build department details
    const departmentDetails = buildDepartmentDetails(
      department,
      programme,
      faculty,
      hodDetails,
      deanDetails,
      activeSemester,
      activeDepartmentSemester
    );

    return departmentDetails;

  } catch (error) {
    console.error('❌ Error in getDepartmentLeadershipDetails:', error.message);
    console.error('Stack:', error.stack);

    return getDefaultDepartmentDetails();
  }
}

/**
 * Build department details with dean and HOD information
 * @param {Object} department - Department object
 * @param {Object} faculty - Faculty object
 * @param {Object} hodDetails - HOD details object
 * @param {Object} deanDetails - Dean details object
 * @param {Object} activeSemester - Current semester
 * @returns {Object} Department details
 */
function buildDepartmentDetails(department, programme, faculty, hodDetails, deanDetails, activeSemester, activeDepartmentSemester) {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  return {
    name: department?.name || '',
    code: department?.code || '',
    programme: programme,
    faculty: {
      name: faculty?.name || '',
      code: faculty?.code || ''
    },
    dean: deanDetails || getDefaultDean(),
    hod: hodDetails || getDefaultHOD(),
    academicYear: activeSemester?.session || `${currentYear}/${nextYear}`,
    semester: activeSemester?.name || '',
    generatedDate: new Date().toISOString(),
    levelSettings: activeDepartmentSemester?.levelSettings
  };
}

/**
 * Get default department details
 */
function getDefaultDepartmentDetails() {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  return {
    name: '',
    code: '',
    faculty: {
      name: '',
      code: ''
    },
    dean: getDefaultDean(),
    hod: getDefaultHOD(),
    academicYear: `${currentYear}/${nextYear}`,
    semester: '',
    generatedDate: new Date().toISOString()
  };
}

/**
 * Get default Dean details
 */
function getDefaultDean() {
  return {
    name: 'Unknown',
    title: 'Dean',
    rank: 'Professor',
    staffId: '',
    signature: '',
    isDean: true
  };
}

/**
 * Get default HOD details
 */
function getDefaultHOD() {
  return {
    name: 'Unknown',
    title: 'Head of Department',
    rank: 'Professor',
    staffId: '',
    signature: '',
    isHOD: true
  };
}
