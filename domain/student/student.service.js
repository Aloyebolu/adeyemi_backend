// computation/services/StudentService.js
import mongoose from "mongoose";
import Student from "./student.model.js";
import departmentModel from "../department/department.model.js";
import AppError from "../errors/AppError.js";

class StudentService {
  /**
   * Fetch students with basic info for processing
   * @param {string} departmentId - Department ID
   * @param {number} limit - Batch size
   * @param {number} skip - Offset
   * @returns {Promise<Array>} List of students
   */
  async getStudentsForProcessing(departmentId, limit = 100, skip = 0) {
    try {
      const students = await Student.aggregate([
        {
          $match: {
            departmentId: new mongoose.Types.ObjectId(departmentId),
            terminationStatus: { $in: ["none", "probation", null] }
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "userInfo"
          }
        },
        { $unwind: "$userInfo" },
        {
          $project: {
            _id: 1,
            first_name: "$userInfo.first_name",
            middle_name: "$userInfo.middle_name",
            last_name: "$userInfo.last_name",
            title: "$userInfo.title",
            email: "$userInfo.email",
            matricNumber: 1,
            level: 1,
            probationStatus: 1,
            terminationStatus: 1,
            cgpa: 1,
            totalCarryovers: 1,
            departmentId: 1
          }
        },
        { $skip: skip },
        { $limit: limit }
      ]);

      return students;
    } catch (error) {
      console.error(`Error fetching students for department ${departmentId}:`, error);
      throw new AppError(`Failed to fetch students`);
    }
  }

  /**
   * Get total student count for a department
   * @param {string} departmentId - Department ID
   * @returns {Promise<number>} Total student count
   */
  async getStudentCount(departmentId) {
    try {
      return await Student.countDocuments({
        departmentId: departmentId,
        terminationStatus: { $in: ["none", "probation", null] }
      });
    } catch (error) {
      console.error(`Error counting students for department ${departmentId}:`, error);
      return 0;
    }
  }

  /**
   * Get student IDs in batches
   * @param {string} departmentId - Department ID
   * @returns {Promise<Array>} List of student IDs
   */
  async getStudentIds(departmentId) {
    try {
      const students = await Student.find({
        departmentId: departmentId,
        terminationStatus: { $in: ["none", "probation", null, "terminated"] }
      }, '_id').lean();

      return students.map(s => s._id);
    } catch (error) {
      console.error(`Error fetching student IDs for department ${departmentId}:`, error);
      return [];
    }
  }
  /**
   * Get student IDs for a programme in batches
   * @param {string} programmeId - Programme ID
   * @returns {Promise<Array>} List of student IDs
 */
  async getStudentIdsForProgramme(programmeId) {
    // BYPASS: Temporarily depend on student.payment_completed to determine if the student have paid or not, should be replaced with the actual payment logic after the payment domain must have been completed
    
    try {
      const students = await Student.find({
        programmeId: programmeId,
        terminationStatus: { $in: ["none", "probation", null, "terminated"] }
        , payment_completed: { $ne: false }
      }, '_id')
      // .skip(8000)
      // .limit(1)
      .lean();

      return students.map(s => s._id);
    } catch (error) {
      console.error(`Error fetching student IDs for programme ${programmeId}:`, error);
      return [];
    }
  }


  /**
   * Fetch students with all necessary details in batch
   * @param {Array} studentIds - Array of student IDs
   * @returns {Promise<Array>} Detailed student information
   */
  async getStudentsWithDetails(studentIds) {
    try {
      const students =  await Student.aggregate([
        {
          $match: { _id: { $in: studentIds } }
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "userInfo"
          }
        },
        { $unwind: "$userInfo" },
        {
          $project: {
            _id: 1,
            first_name: "$userInfo.first_name",
            middle_name: "$userInfo.middle_name",
            last_name: "$userInfo.last_name",
            title: "$userInfo.title",
            email: "$userInfo.email",
            matricNumber: 1,
            level: 1,
            probationStatus: 1,
            terminationStatus: 1,
            cgpa: 1,
            gpa: 1,
            totalCarryovers: 1,
            departmentId: 1,
            suspension: 1
          }
        }
      ]);

      return students
    } catch (error) {
      console.error('Error fetching student details:', error);
      throw new AppError("Error Fetching Student Details", 500);
    }
  }

  /**
   * Update student academic records
   * @param {string} studentId - Student ID
   * @param {Object} updates - Update data
   * @param {Object} session - MongoDB session
   * @returns {Promise<Object>} Updated student
   */
  async updateStudentAcademicRecord(studentId, updates, session = null) {
    try {
      const options = session ? { session } : {};
      return await Student.findByIdAndUpdate(
        studentId,
        {
          $set: updates.set || {},
          $inc: updates.increment || {}
        },
        { new: true, ...options }
      );
    } catch (error) {
      console.error(`Error updating student ${studentId}:`, error);
      throw error;
    }
  }

  /**
   * Get department details
   * @param {string} departmentId - Department ID
   * @returns {Promise<Object>} Department information
   */
  async getDepartmentDetails(departmentId) {
    try {
      return await departmentModel.findById(departmentId)
        .select('name code hod status')
        .lean();
    } catch (error) {
      console.error(`Error fetching department ${departmentId}:`, error);
      throw error;
    }
  }

  /**
   * Get student by Id
   * @param {string} studentId - Student ID
   * @param {Object} options - Extra Options
   * @returns {Promise<Object>} Student Information
   */
  async getStudentById(studentId, options = {}) {
    if (!studentId) {
      throw new Error("Student ID is required");
    }

    try {
      const student = await this.findStudent(
        { studentId },
        options
      );

      if (!student) {
        throw new AppError(`Student with id ${studentId} not found`, 404);
      }
      return student;
    } catch (error) {
      throw new AppError("Failed to get student", 500, error);
    }
  }


  /**
 * Find a student by flexible identifier
 * @param {Object} params
 * @param {string} [params.studentId]
 * @param {string} [params.matricNumber]
 * @param {Object} [options]
 * @returns {Promise<Object|null>}
 */
  async findStudent(params = {}, options = {}) {
    let { studentId, matricNumber } = params;
    const { select, populate, lean = true, session } = options;

    if (!studentId && !matricNumber) {
      throw new AppError("Student identifier is required", 400);
    }

    let query;

    if (studentId) {
      query = Student.findById(studentId);
    } else {
      matricNumber = matricNumber?.toUpperCase()
      query = Student.findOne({ matricNumber });
    }

    if (select) query.select(select);
    if (populate) query.populate(populate);
    if (session) query.session(session);
    if (lean) query.lean();

    const student = await query.exec();

    const id = matricNumber ? `Matric Number ${matricNumber}` : `id ${studentId}`
    // if (!student) {
    //   throw new AppError(`Student with ${id} not found`, 404);
    // }

    return student;
  }
  async getStudentByMatricNumber(matricNumber, options = {}) {
    return this.findStudent(
      { matricNumber },
      options
    );
  }


}

export default new StudentService();