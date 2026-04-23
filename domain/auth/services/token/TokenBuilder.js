// import createToken from '#utils/createToken.js';
// import { resolveUserName } from '#utils/resolveUserName.js';
// // import { getUserPositions } from '#modules/unit/unit.service.js'; // 👈 create this

// class TokenBuilder {
//   async buildUserToken(user, { student, lecturer } = {}) {
//     let departmentName = null;

//     try {
//       const departmentId =
//         lecturer?.departmentId || student?.departmentId;

//       if (departmentId) {
//         const department = await departmentService.getDepartmentById(
//           departmentId,
//           { lean: true }
//         );
//         departmentName = department?.name || null;
//       }
//     } catch (error) {
//       console.error(`[AuthService] Failed to fetch department`);
//     }

//     // 🔥 GET POSITIONS (this is the new power)
//     const positions = await (user._id);

//     // 🔥 BUILD ROLES ARRAY
//     const roles = [user.role, ...(user.extra_roles || [])];

//     return {
//       _id: user._id,
//       email: user.email,
//       name: resolveUserName(user),

//       role: user.role,                 // base role
//       roles,                           // ALL roles
//       extra_roles: user.extra_roles || [],

//       positions,                       // 👈 admin + academic heads

//       meta: {
//         department: departmentName,
//         level: student?.level || null,
//         faculty: student?.faculty || null,
//       }
//     };
//   }

//   async createToken(tokenData) {
//     return await createToken(tokenData);
//   }
// }

// export default TokenBuilder;

import createToken from '../../../../utils/createToken.js';
import { resolveUserName } from '../../../../utils/resolveUserName.js';

// SECURITY NOTE: In production, import departmentService properly
// This is a placeholder to avoid breaking existing code
// TODO: Replace with actual import after verification
const departmentService = {
  getDepartmentById: async () => ({ name: null })
};

class TokenBuilder {
  /**
   * Helper methods for building token data
   */
  buildAdminTokenData(admin) {
    // SECURITY: Include minimal necessary data in token
    return {
      _id: admin._id,
      admin_id: admin.admin_id,
      email: admin.email,
      role: 'admin',
    };
  }

  async buildLecturerTokenData(lecturer, user) {
    // SECURITY: Department name fetch is async - handle failures gracefully
    let departmentName = null;
    try {
      const department = await departmentService.getDepartmentById(
        lecturer.departmentId,
        { lean: true }
      );
      departmentName = department?.name || null;
    } catch (error) {
      // SECURITY: Don't fail authentication if department fetch fails
      console.error(`[AuthService] Failed to fetch department for lecturer: ${lecturer._id}`);
    }

    return {
      _id: lecturer._id,
      staff_id: lecturer.staffId,
      email: lecturer.email,
      role: user.role, // SECURITY: Use role from User document
      name: resolveUserName(user),
      department: departmentName,
    };
  }

  async buildStudentTokenData(student) {
    let departmentName = null;
    try {
      const department = await departmentService.getDepartmentById(
        student.departmentId,
        { lean: true }
      );
      departmentName = department?.name || null;
    } catch (error) {
      console.error(`[AuthService] Failed to fetch department for student: ${student._id}`);
    }

    return {
      _id: student._id,
      matric_no: student.matricNumber,
      email: student.email,
      role: 'student',
      department: departmentName,
      level: student.level,
      faculty: student.faculty,
    };
  }

  /**
   * Create JWT token
   */
  async createToken(tokenData) {
    return await createToken(tokenData);
  }
}

export default TokenBuilder;