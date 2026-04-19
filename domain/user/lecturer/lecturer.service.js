import mongoose from "mongoose";
import Lecturer from "./lecturer.model.js";
import User from "#domain/user/user.model.js";
import Department from "#domain/organization/department/department.model.js";
import departmentService from "#domain/organization/department/department.service.js";
import facultyService from "#domain/organization/faculty/faculty.service.js";
import { hashData } from "#utils/hashData.js";
import { deleteUser } from "#domain/user/user.controller.js";
import AppError from "#shared/errors/AppError.js";
import { validateObjectId } from "#utils/validator.js";

class LecturerService {
  /**
   * Get department filter based on user role
   */
  async getDepartmentFilterForUser(user) {
    if (user.role === "hod") {
      const department = await departmentService.getDepartmentByHod(user._id);
      return department ? { departmentId: department._id } : {};
    }
    return {};
  }

  /**
   * Get faculty filter based on user role
   */
  async getFacultyFilterForUser(user) {
    if (user.role === "dean") {
      const faculty = await facultyService.getFacultyByDean(user._id);
      return faculty ? { facultyId: faculty._id } : {};
    }
    return {};
  }

  /**
   * Create audit context object
   */
  createAuditContext(action, status, reason, metadata = {}) {
    let severity = "MEDIUM";
    if (status === "ERROR" || status === "ERROR_ROLLBACK") {
      severity = status === "ERROR_ROLLBACK" ? "HIGH" : "CRITICAL";
    }

    return {
      action,
      resource: "Lecturer",
      severity,
      entityId: metadata.lecturerId || null,
      status,
      reason,
      metadata,
    };
  }

  /**
   * Resolve department ID for HOD users
   */
  async resolveDepartmentId(userFromMiddleware, department_id) {
    let resolvedDepartmentId = department_id || null;

    if (userFromMiddleware?.role === "hod") {
      const department = await departmentService.getDepartmentByHod(userFromMiddleware._id);
      resolvedDepartmentId = department ? department._id : null;
    }

    return resolvedDepartmentId;
  }

  /**
   * Create a new lecturer with user account
   */
  async createLecturerWithUser(lecturerData, resolvedDepartmentId) {
    const { first_name, last_name, middle_name, email, staffId, rank } = lecturerData;

    // Check for duplicates
    const [existingLecturer, existingUser] = await Promise.all([
      Lecturer.findOne({ staffId }),
      User.findOne({ email }),
    ]);

    if (existingLecturer) {
      throw new AppError("Lecturer with this staff ID already exists");
    }

    if (existingUser) {
      throw new AppError("User with this email already exists");
    }

    // Create user with default password
    const defaultPassword = `AFUED@${staffId}`;
    const hashedPassword = await hashData(defaultPassword);

    const user = await User.create({
      first_name, last_name, middle_name,
      email,
      password: hashedPassword,
      role: "lecturer",
      must_change_password: true,
    });

    try {
      const faculty = await facultyService.getFacultyByDepartment(resolvedDepartmentId);
      const lecturer = await Lecturer.create({
        _id: user._id,
        staffId,
        departmentId: resolvedDepartmentId,
        rank,
        facultyId: faculty?._id || null,
      });

      return { lecturer, user, faculty };
    } catch (error) {
      // Rollback user creation if lecturer creation fails
      await User.findByIdAndDelete(user._id);
      throw error;
    }
  }

  /**
   * Get lecturer by ID with populated data
   */
  async getLecturerById(lecturerId) {
    validateObjectId(lecturerId)
    console.log(lecturerId)
    if (!lecturerId) {
      throw new AppError("Invalid LecturerID provided", 500)
    }
    const lecturer = await Lecturer.findById(lecturerId)
      .populate("departmentId", "name")
      .populate("_id", "name email");

    if (!lecturer) {
      throw new AppError("Lecturer not found", 404);
    }

    return lecturer;
  }

  /**
   * Update lecturer and user information
   */
  async updateLecturer(lecturerId, updateData) {
    const fieldMappings = {
      user: { first_name: "first_name", last_name: "last_name", middle_name: "middle_name", title: "title", email: "email", phone_number: "phoneNumber" },
      lecturer: { department_id: "departmentId", staffId: "staffId" },
    };

    const updates = { user: {}, lecturer: {} };

    // Route fields to appropriate model
    Object.entries(updateData).forEach(([key, value]) => {
      if (fieldMappings.user[key]) updates.user[fieldMappings.user[key]] = value;
      if (fieldMappings.lecturer[key]) updates.lecturer[fieldMappings.lecturer[key]] = value;
    });

    // Execute updates
    const updatePromises = [];
    if (Object.keys(updates.user).length) {
      updatePromises.push(
        User.findByIdAndUpdate(lecturerId, updates.user, { runValidators: true })
      );
    }

    if (Object.keys(updates.lecturer).length) {
      updatePromises.push(
        Lecturer.findByIdAndUpdate(
          lecturerId,
          updates.lecturer,
          { new: true, runValidators: true }
        )
          .populate("departmentId", "name")
          .populate("_id", "title first_name middle_name last_name name")

      );
    }

    const results = await Promise.all(updatePromises);
    let updatedLecturer = results.find((r) => r && r.constructor.modelName === "Lecturer");

    if (!updatedLecturer) {
      updatedLecturer = this.getLecturerById(lecturerId)
    }

    return updatedLecturer;
  }

  /**
   * Delete lecturer and associated user
   */
  async deleteLecturer(lecturerId) {
    // await deleteUser({ id: lecturerId, role: "lecturer" });
    throw new AppError("Lecturer deletion is currently disabled. Please contact support.", 403);
  }

  /**
   * Assign or remove HOD status
   */
  async updateHODStatus(departmentId, lecturerId, assign = true) {
    const [lecturer, department] = await Promise.all([
      Lecturer.findById(lecturerId),
      Department.findById(departmentId),
    ]);

    if (!lecturer) throw new AppError("Lecturer not found", 404);
    if (!department) throw new AppError("Department not found", 404);

    if (assign) {
      if (lecturer.departmentId.toString() !== departmentId) {
        throw new AppError("Lecturer must belong to this department before being assigned as HOD");
      }

      // Remove previous HOD if exists
      if (department.hod && department.hod.toString() !== lecturerId) {
        await Lecturer.findByIdAndUpdate(department.hod, { isHOD: false });
      }

      department.hod = lecturer._id;
      lecturer.isHOD = true;
    } else {
      if (department.hod?.toString() !== lecturerId) {
        throw new AppError("This lecturer is not the HOD of this department");
      }
      department.hod = null;
      lecturer.isHOD = false;
    }

    await Promise.all([department.save(), lecturer.save()]);
    return lecturer;
  }

  /**
   * Get all lecturers with filters for user role
   */
  async getAllLecturersWithFilters(user) {
    const additionalFilters = {};

    // Apply role-based filters
    const [deptFilter, facultyFilter] = await Promise.all([
      this.getDepartmentFilterForUser(user),
      this.getFacultyFilterForUser(user),
    ]);

    Object.assign(additionalFilters, deptFilter, facultyFilter);
    return additionalFilters;
  }

  /**
   * Get all deans
   */
  async getAllDeans() {
    const deans = await Lecturer.find({ isDean: true })
      .populate("_id", "first_name last_name middle_name title email")
      .populate("departmentId", "name")
      .populate("facultyId", "name");

    return deans;
  }

  /**
   * Get all HODs with role-based filters
   */
  async getAllHODs(user) {
    const additionalFilters = { isHOD: true };

    // Apply role-based filters
    const [deptFilter, facultyFilter] = await Promise.all([
      this.getDepartmentFilterForUser(user),
      this.getFacultyFilterForUser(user),
    ]);

    Object.assign(additionalFilters, deptFilter, facultyFilter);

    const hods = await Lecturer.find(additionalFilters)
      .populate("_id", "first_name last_name middle_name title email")
      .populate("departmentId", "name")
      .populate("facultyId", "name");

    return hods;
  }


  // domain/user/lecturer/lecturer.service.js

  /**
   * Get all roles and administrative positions for a lecturer
   * This aggregates data from department and faculty services to determine:
   * - Is HOD? (from department)
   * - Is Dean? (from faculty)
   * - Any other special roles
   * 
   * @param {string|ObjectId} lecturerId - Lecturer user ID
   * @param {Object} options - { session, populate }
   * @returns {Promise<{
   *   lecturerId: string,
   *   isHod: boolean,
   *   hodDepartment: Object|null,
   *   isDean: boolean,
   *   deanFaculty: Object|null,
   *   roles: string[],
   *   summary: string
   * }>}
   */
  async getLecturerAdministrativeRoles(lecturerId, options = {}) {
    try {
      const result = {
        lecturerId: lecturerId.toString(),
        isHod: false,
        hodDepartment: null,
        isDean: false,
        deanFaculty: null,
        roles: [],
        summary: ''
      };

      // Check if lecturer is HOD (from department service)
      const hodCheck = await departmentService.isHod(lecturerId, {
        session: options.session,
        populate: options.populate
      });

      if (hodCheck.isHod) {
        result.isHod = true;
        result.hodDepartment = hodCheck.department;
        result.roles.push('hod');
      }

      // Check if lecturer is Dean (from faculty service)
      const deanCheck = await facultyService.isDean(lecturerId, {
        session: options.session,
        populate: options.populate
      });

      if (deanCheck.isDean) {
        result.isDean = true;
        result.deanFaculty = deanCheck.faculty;
        result.roles.push('dean');
      }

      // Generate summary
      if (result.isHod && result.isDean) {
        result.summary = `HOD of ${result.hodDepartment.name} & Dean of ${result.deanFaculty.name}`;
      } else if (result.isHod) {
        result.summary = `HOD of ${result.hodDepartment.name}`;
      } else if (result.isDean) {
        result.summary = `Dean of ${result.deanFaculty.name}`;
      } else {
        result.summary = 'Regular lecturer (no administrative roles)';
      }

      return result;
    } catch (error) {
      logger.error(`LecturerService.getLecturerAdministrativeRoles failed: ${error.message}`, {
        lecturerId,
        options,
        stack: error.stack
      });
      throw error;
    }
  }
}

export default new LecturerService();