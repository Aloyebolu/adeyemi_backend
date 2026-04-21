import createToken from '#utils/createToken.js';
import { resolveUserName } from '#utils/resolveUserName.js';
// import { getUserPositions } from '#modules/unit/unit.service.js'; // 👈 create this

class TokenBuilder {
  async buildUserToken(user, { student, lecturer } = {}) {
    let departmentName = null;

    try {
      const departmentId =
        lecturer?.departmentId || student?.departmentId;

      if (departmentId) {
        const department = await departmentService.getDepartmentById(
          departmentId,
          { lean: true }
        );
        departmentName = department?.name || null;
      }
    } catch (error) {
      console.error(`[AuthService] Failed to fetch department`);
    }

    // 🔥 GET POSITIONS (this is the new power)
    const positions = await (user._id);

    // 🔥 BUILD ROLES ARRAY
    const roles = [user.role, ...(user.extra_roles || [])];

    return {
      _id: user._id,
      email: user.email,
      name: resolveUserName(user),

      role: user.role,                 // base role
      roles,                           // ALL roles
      extra_roles: user.extra_roles || [],

      positions,                       // 👈 admin + academic heads

      meta: {
        department: departmentName,
        level: student?.level || null,
        faculty: student?.faculty || null,
      }
    };
  }

  async createToken(tokenData) {
    return await createToken(tokenData);
  }
}

export default TokenBuilder;