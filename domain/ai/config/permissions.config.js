// src/modules/ai/config/permissions.config.js

export const PERMISSIONS_CONFIG = {
  // Role hierarchy
  roles: {
    admin: {
      level: 100,
      canReadAll: true,
      canWriteAll: true,
      canExport: true,
      canAnalyze: true,
    },
    dean: {
      level: 80,
      canReadAll: true,
      canWriteAll: false,
      canExport: true,
      canAnalyze: true,
      restrictions: ['faculty_only'],
    },
    hod: {
      level: 70,
      canReadAll: false,
      canWriteAll: false,
      canExport: true,
      canAnalyze: true,
      restrictions: ['department_only'],
    },
    lecturer: {
      level: 50,
      canReadAll: false,
      canWriteAll: false,
      canExport: false,
      canAnalyze: true,
      restrictions: ['own_courses_only'],
    },
    student: {
      level: 10,
      canReadAll: false,
      canWriteAll: false,
      canExport: false,
      canAnalyze: false,
      restrictions: ['self_only'],
    },
  },
  
  // Field-level permissions
  fieldPermissions: {
    public: ['name', 'email', 'role', 'department'],
    staff: ['staffId', 'office', 'extension'],
    admin: ['salary', 'address', 'phone', 'dateOfBirth'],
    private: ['password', 'token', 'secret'],
  },
  
  // Action permissions
  actionPermissions: {
    terminate_student: ['admin'],
    update_student: ['admin', 'lecturer'],
    suspend_student: ['admin', 'dean', 'hod'],
    promote_lecturer: ['admin'],
    reset_password: ['admin'],
    export_data: ['admin', 'dean', 'hod'],
    view_sensitive: ['admin'],
  },
  
  // Data restrictions
  restrictions: {
    faculty_only: {
      description: 'Can only access data within their faculty',
      filterField: 'faculty',
    },
    department_only: {
      description: 'Can only access data within their department',
      filterField: 'department',
    },
    own_courses_only: {
      description: 'Can only access data for courses they teach',
      filterField: 'course_id',
    },
    self_only: {
      description: 'Can only access their own data',
      filterField: '_id',
    },
  },
  
  // Export permissions
  exportPermissions: {
    maxRows: {
      admin: 50000,
      dean: 10000,
      hod: 5000,
      lecturer: 1000,
      student: 0,
    },
    allowedFormats: {
      admin: ['excel', 'csv', 'json'],
      dean: ['excel', 'csv'],
      hod: ['excel', 'csv'],
      lecturer: ['csv'],
      student: [],
    },
  },
  
  // Rate limits per role
  rateLimits: {
    admin: { window: 60, max: 100 },
    dean: { window: 60, max: 50 },
    hod: { window: 60, max: 50 },
    lecturer: { window: 60, max: 30 },
    student: { window: 60, max: 10 },
  },
  
  // Audit requirements
  auditRequirements: {
    always: ['write', 'export', 'delete'],
    sensitive: ['view_sensitive', 'reset_password'],
    adminOnly: ['modify_permissions', 'delete_user'],
  },
};

export default PERMISSIONS_CONFIG;