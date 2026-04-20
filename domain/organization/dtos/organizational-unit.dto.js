// domain/organization/dto/organizational-unit.dto.js
/**
 * DATA TRANSFER OBJECTS FOR ORGANIZATIONAL UNITS
 * ------------------------------------------------
 * Clean separation between database model and API contracts
 */

// ==================== REQUEST DTOs (Incoming Data) ====================

export class CreateUnitDto {
  constructor(data) {
    this.name = data.name?.trim();
    this.code = data.code?.trim().toUpperCase();
    this.type = data.type;
    this.parent_unit = data.parent_unit || null;
    this.description = data.description?.trim() || null;
    this.head_user_id = data.head_user_id || null;
    this.head_title_override = data.head_title_override?.trim() || null;
  }

  validate() {
    const errors = [];
    
    if (!this.name || this.name.length < 2) {
      errors.push('Unit name is required (minimum 2 characters)');
    }
    
    if (!this.code || !/^[A-Z0-9]{2,10}$/.test(this.code)) {
      errors.push('Unit code must be 2-10 uppercase letters/numbers');
    }
    
    const validTypes = [
      "university", "faculty", "department",
      "registry", "bursary", "ict", "admissions", "student_affairs",
      "library", "hostel", "security", "transport", "health", "other"
    ];
    
    if (!this.type || !validTypes.includes(this.type)) {
      errors.push(`Invalid unit type. Must be one of: ${validTypes.join(', ')}`);
    }
    
    if (this.description && this.description.length > 500) {
      errors.push('Description cannot exceed 500 characters');
    }
    
    return errors;
  }

  toModel(createdBy = null) {
    return {
      name: this.name,
      code: this.code,
      type: this.type,
      parent_unit: this.parent_unit,
      description: this.description,
      head_user_id: this.head_user_id,
      head_title_override: this.head_title_override,
      created_by: createdBy,
      is_active: true
    };
  }
}

export class UpdateUnitDto {
  constructor(data) {
    this.name = data.name?.trim();
    this.code = data.code?.trim().toUpperCase();
    this.type = data.type;
    this.parent_unit = data.parent_unit;
    this.description = data.description?.trim();
    this.head_user_id = data.head_user_id;
    this.head_title_override = data.head_title_override?.trim();
    this.is_active = data.is_active;
  }

  validate(existingUnit = null) {
    const errors = [];
    
    if (this.name !== undefined && this.name.length < 2) {
      errors.push('Unit name must be at least 2 characters');
    }
    
    if (this.code !== undefined && !/^[A-Z0-9]{2,10}$/.test(this.code)) {
      errors.push('Unit code must be 2-10 uppercase letters/numbers');
    }
    
    if (this.type !== undefined) {
      const validTypes = [
        "university", "faculty", "department",
        "registry", "bursary", "ict", "admissions", "student_affairs",
        "library", "hostel", "security", "transport", "health", "other"
      ];
      
      if (!validTypes.includes(this.type)) {
        errors.push(`Invalid unit type. Must be one of: ${validTypes.join(', ')}`);
      }
      
      // Prevent type changes for core academic units
      if (existingUnit) {
        const immutableTypes = ["university", "faculty", "department"];
        if (immutableTypes.includes(existingUnit.type) && existingUnit.type !== this.type) {
          errors.push(`Cannot change type of ${existingUnit.type}`);
        }
      }
    }
    
    if (this.description !== undefined && this.description.length > 500) {
      errors.push('Description cannot exceed 500 characters');
    }
    
    return errors;
  }

  toModelUpdates() {
    const updates = {};
    
    if (this.name !== undefined) updates.name = this.name;
    if (this.code !== undefined) updates.code = this.code;
    if (this.type !== undefined) updates.type = this.type;
    if (this.parent_unit !== undefined) updates.parent_unit = this.parent_unit;
    if (this.description !== undefined) updates.description = this.description;
    if (this.head_user_id !== undefined) updates.head_user_id = this.head_user_id;
    if (this.head_title_override !== undefined) updates.head_title_override = this.head_title_override;
    if (this.is_active !== undefined) updates.is_active = this.is_active;
    
    return updates;
  }
}

// ==================== RESPONSE DTOs (Outgoing Data) ====================

export class UnitResponseDto {
  constructor(unit) {
    this.id = unit._id?.toString() || unit.id;
    this.name = unit.name;
    this.code = unit.code;
    this.type = unit.type;
    this.category = this.#deriveCategory(unit.type);
    this.parent_unit = unit.parent_unit?._id?.toString() || unit.parent_unit?.toString() || null;
    this.parent_unit_details = unit.parent_unit ? {
      id: unit.parent_unit._id?.toString() || unit.parent_unit.id,
      name: unit.parent_unit.name,
      code: unit.parent_unit.code,
      type: unit.parent_unit.type
    } : null;
    this.path = unit.path;
    this.depth = unit.depth;
    this.head_user_id = unit.head_user_id?._id?.toString() || unit.head_user_id?.toString() || null;
    this.head_details = unit.head_user_id ? {
      id: unit.head_user_id._id?.toString() || unit.head_user_id.id,
      first_name: unit.head_user_id.first_name,
      last_name: unit.head_user_id.last_name,
      email: unit.head_user_id.email,
      title: unit.head_title_override || this.#getDefaultHeadTitle(unit.type)
    } : null;
    this.description = unit.description;
    this.is_active = unit.is_active;
    this.active_member_count = unit.active_member_count || 0;
    this.created_at = unit.createdAt;
    this.updated_at = unit.updatedAt;
    
    // Migration info (only included if present)
    if (unit._migrated_from?.source_model) {
      this._migrated_from = {
        source_model: unit._migrated_from.source_model,
        migrated_at: unit._migrated_from.migrated_at
      };
    }
  }

  #deriveCategory(type) {
    const categoryMap = {
      university: "academic", faculty: "academic", department: "academic",
      registry: "administrative", bursary: "administrative", ict: "administrative",
      admissions: "administrative", student_affairs: "administrative",
      library: "support", hostel: "support", security: "support",
      transport: "support", health: "support", other: "support"
    };
    return categoryMap[type] || "support";
  }

  #getDefaultHeadTitle(type) {
    const titleMap = {
      university: "Vice Chancellor", faculty: "Dean", department: "Head of Department",
      registry: "Registrar", bursary: "Bursar", library: "University Librarian",
      ict: "Director of ICT", admissions: "Admissions Officer",
      student_affairs: "Dean of Student Affairs", security: "Chief Security Officer",
      transport: "Transport Manager", health: "Director of Health Services",
      hostel: "Hall Warden"
    };
    return titleMap[type] || "Unit Head";
  }
}

export class UnitListResponseDto {
  constructor(unit) {
    this.id = unit._id?.toString() || unit.id;
    this.name = unit.name;
    this.code = unit.code;
    this.type = unit.type;
    this.category = this.#deriveCategory(unit.type);
    this.head_name = unit.head_user_id ? 
      `${unit.head_user_id.first_name || ''} ${unit.head_user_id.last_name || ''}`.trim() : 
      null;
    this.is_active = unit.is_active;
    this.active_member_count = unit.active_member_count || 0;
  }

  #deriveCategory(type) {
    const categoryMap = {
      university: "academic", faculty: "academic", department: "academic",
      registry: "administrative", bursary: "administrative", ict: "administrative",
      admissions: "administrative", student_affairs: "administrative",
      library: "support", hostel: "support", security: "support",
      transport: "support", health: "support", other: "support"
    };
    return categoryMap[type] || "support";
  }
}

export class UnitTreeResponseDto {
  constructor(unit) {
    this.id = unit._id?.toString() || unit.id;
    this.name = unit.name;
    this.code = unit.code;
    this.type = unit.type;
    this.depth = unit.depth;
    this.is_active = unit.is_active;
    this.children = (unit.children || []).map(child => new UnitTreeResponseDto(child));
  }
}

export class UnitWithStatsResponseDto extends UnitResponseDto {
  constructor(unit, stats = {}) {
    super(unit);
    this.statistics = {
      total_children: stats.totalChildren || 0,
      total_members: stats.totalMembers || unit.active_member_count || 0,
      departments: stats.departments || 0,
      programmes: stats.programmes || 0,
      students: stats.students || 0,
      lecturers: stats.lecturers || 0
    };
  }
}

// ==================== SPECIALIZED DTOs ====================

export class DepartmentResponseDto extends UnitResponseDto {
  constructor(department, faculty = null) {
    super(department);
    this.faculty = faculty ? {
      id: faculty._id?.toString() || faculty.id,
      name: faculty.name,
      code: faculty.code
    } : null;
    this.hod = this.head_details;
  }
}

export class FacultyResponseDto extends UnitResponseDto {
  constructor(faculty, departments = []) {
    super(faculty);
    this.dean = this.head_details;
    this.departments = departments.map(dept => ({
      id: dept._id?.toString() || dept.id,
      name: dept.name,
      code: dept.code,
      hod_name: dept.head_user_id ? 
        `${dept.head_user_id.first_name || ''} ${dept.head_user_id.last_name || ''}`.trim() : 
        null
    }));
  }
}

// ==================== QUERY DTOs ====================

export class UnitQueryDto {
  constructor(query = {}) {
    this.search = query.search?.trim() || null;
    this.type = query.type || null;
    this.category = query.category || null;
    this.parent_unit = query.parent_unit || null;
    this.is_active = query.is_active !== undefined ? query.is_active === 'true' : null;
    this.page = Math.max(1, parseInt(query.page) || 1);
    this.limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
    this.sort_by = query.sort_by || 'name';
    this.sort_order = query.sort_order === 'desc' ? -1 : 1;
  }

  toMongoQuery() {
    const query = {};
    
    if (this.type) {
      query.type = this.type;
    }
    
    if (this.category) {
      const typeMap = {
        academic: ["university", "faculty", "department"],
        administrative: ["registry", "bursary", "ict", "admissions", "student_affairs"],
        support: ["library", "hostel", "security", "transport", "health", "other"]
      };
      query.type = { $in: typeMap[this.category] || [] };
    }
    
    if (this.parent_unit) {
      query.parent_unit = this.parent_unit;
    }
    
    if (this.is_active !== null) {
      query.is_active = this.is_active;
    }
    
    if (this.search) {
      query.$text = { $search: this.search };
    }
    
    return query;
  }

  getPagination() {
    return {
      skip: (this.page - 1) * this.limit,
      limit: this.limit
    };
  }

  getSort() {
    const sort = {};
    sort[this.sort_by] = this.sort_order;
    return sort;
  }
}

// ==================== ASSIGNMENT DTOs ====================

export class AssignHeadDto {
  constructor(data) {
    this.user_id = data.user_id;
    this.title_override = data.title_override?.trim() || null;
  }

  validate() {
    const errors = [];
    
    if (!this.user_id) {
      errors.push('User ID is required');
    }
    
    if (this.title_override && this.title_override.length > 50) {
      errors.push('Title override cannot exceed 50 characters');
    }
    
    return errors;
  }
}

export class AssignHeadResponseDto {
  constructor(unit, user, oldHeadId = null) {
    this.success = true;
    this.unit = {
      id: unit._id?.toString() || unit.id,
      name: unit.name,
      type: unit.type
    };
    this.head = {
      id: user._id?.toString() || user.id,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      email: user.email,
      title: unit.head_title_override || unit.effective_head_title
    };
    this.previous_head_id = oldHeadId?.toString() || null;
  }
}

// ==================== PAGINATION DTO ====================

export class PaginatedUnitsResponseDto {
  constructor(data, total, page, limit) {
    this.data = data.map(unit => new UnitListResponseDto(unit));
    this.pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      has_next: page * limit < total,
      has_previous: page > 1
    };
  }
}