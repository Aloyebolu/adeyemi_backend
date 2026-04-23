// computation/services/computation.service.js
// import { countDocuments, find, findById } from '../models/computation.model.js';
// import { getDepartmentByHod } from '../../organization/department/department.service.js';
// import { find as _find } from '../../organization/department/department.model.js';
// import { find as __find } from '../../semester/semesterCourse.model.js';
import ComputationSummary from '../models/computation.model.js';

class ComputationService {
  async getHodDepartment(userId) {
    return await getDepartmentByHod(userId);
  }

  async getAllComputations({
    page,
    limit,
    status,
    purpose,
    semesterId,
    departmentId,
    search,
    sortBy,
    sortOrder,
    userId,
    userRole
  }) {
    // Build query
    const query = this.buildComputationQuery({
      status,
      purpose,
      semesterId,
      departmentId,
      search,
      userId,
      userRole
    });

    // Get computations with pagination
    const skip = (page - 1) * limit;
    const computations = await this.fetchComputations(query, {
      skip,
      limit,
      sortBy,
      sortOrder
    });

    // Get total count
    const total = await ComputationSummary.countDocuments(query);

    // Get filter options (for UI)
    const filters = await this.getAvailableFilters();

    return {
      computations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters
    };
  }

  buildComputationQuery({
    status,
    purpose,
    semesterId,
    departmentId,
    search,
    userId,
    userRole
  }) {
    const query = {};

    // Apply filters
    if (status) query.status = status;
    if (purpose) query.purpose = purpose;
    if (semesterId) query.semester = semesterId;
    
    // Department filtering based on role
    if (departmentId) {
      query.department = departmentId;
    } else if (userRole === 'hod' && userId) {
      // This will be handled by the controller passing departmentId
      // But keeping for role-based logic
    }

    // Search functionality
    if (search) {
      query.$or = [
        { 'department.name': { $regex: search, $options: 'i' } },
        { 'semester.name': { $regex: search, $options: 'i' } }
      ];
    }

    return query;
  }

  async fetchComputations(query, { skip, limit, sortBy, sortOrder }) {
    return await ComputationSummary.find(query)
      .select("department semester computedBy programme status purpose totalStudents studentsProcessed createdAt completedAt")
      .populate('department', 'name code')
      .populate('programme', 'name programmeType')
      .populate('semester', 'name session')
      .populate('computedBy', 'name email')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async getAvailableFilters() {
    const [departments, semesters] = await Promise.all([
      ComputationSummary.find().select('name code').sort('name').lean(),
      ComputationSummary.find()
        .select('name academicYear')
        .sort('-academicYear name')
        .lean()
    ]);

    return {
      departments,
      semesters,
      statuses: ['completed', 'processing', 'failed', 'pending'],
      purposes: ['final', 'preview']
    };
  }

  async getComputationById(id) {
    const computation = await ComputationSummary.findById(id)
      .populate('department', 'name code')
      .populate('programme', 'name programmeType')
      .populate('semester', 'name session')
      .populate('computedBy', 'name email')
      .lean();

    if (!computation) {
      throw new Error('Computation not found');
    }

    return computation;
  }
}

export default new ComputationService();