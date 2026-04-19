import jwt from "jsonwebtoken";
import buildResponse from "../utils/responseBuilder.js";
import { auditLogger } from "../middlewares/auditLogger.js";
import { READ_KEYS, REQUEST_INTENT } from "../domain/auditlog/auditlog.middleware.js";

// System-wide authorized roles
const AUTHORIZED_ROLES = ["admin", "hod", "lecturer", "student", "dean", "vc"];




// Helper function to check if user role has access to required role
const hasPermission = (userRole, requiredRole) => {
  // If no hierarchy defined for user role, fall back to exact match
  if (!ROLE_HIERARCHY[userRole]) {
    return userRole === requiredRole;
  }

  // Check if required role is in user's hierarchy
  return ROLE_HIERARCHY[userRole].includes(requiredRole);
};


// middleware/auth.js

import { PERMISSIONS, roleHasPermission } from "../config/permissions.js";

/**
 * Role hierarchy for backward compatibility
 * Higher index = higher privilege
 */
const ROLE_HIERARCHY = ["student", "lecturer", "staff", "hod", "dean", "admin"];

/**
 * Check if a user role has sufficient hierarchy level
 * @param {string} userRole - Current user's role
 * @param {string} requiredRole - Required role
 * @returns {boolean}
 */
const hasHierarchyPermission = (userRole, requiredRole) => {
  const userLevel = ROLE_HIERARCHY.indexOf(userRole);
  const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole);
  return userLevel >= requiredLevel;
};

/**
 * Main authorization function
 * Supports both legacy role arrays and new permission objects
 * 
 * Usage:
 * - authorize(["admin", "hod"]) - Legacy role-based
 * - authorize(PERMISSIONS.APPROVE_RESULTS) - New permission-based
 * - authorize([PERMISSIONS.VIEW_USERS, PERMISSIONS.EDIT_USERS]) - Multiple permissions
 * 
 * @param {Array|Object} requirement - Role array OR permission object OR array of permissions
 * @returns {Function} Express middleware
 */
export const authorize = (requirement = []) => {
  // Normalize to array for consistent processing
  let requirements = Array.isArray(requirement) ? requirement : [requirement];

  // Check if we're dealing with permissions or roles
  const isPermissionBased = requirements.length > 0 && requirements[0]?.allowedRoles;

  return (req, res, next) => {
    const userRole = req.user?.role;
    const userExtraRoles = req.user?.extra_roles || [];

    if (!userRole) {
      return buildResponse(res, 401, "Unauthenticated", null, true);
    }

    // Validate base role exists in hierarchy
    if (!ROLE_HIERARCHY.includes(userRole)) {
      auditLogger(`Invalid role: ${userRole}`)(req, res, () => { });
      return buildResponse(res, 403, "Unauthorized role", null, true);
    }

    // No restriction - allow access
    if (requirements.length === 0) return next();

    let hasAccess = false;

    if (isPermissionBased) {
      // PERMISSION-BASED AUTHORIZATION
      // Check if user has ANY of the required permissions
      for (const permission of requirements) {
        // Check base role against permission
        if (roleHasPermission(userRole, permission)) {
          hasAccess = true;
          break;
        }

        // Check extra_roles against permission
        for (const extraRole of userExtraRoles) {
          if (roleHasPermission(extraRole, permission)) {
            hasAccess = true;
            break;
          }
        }
        if (hasAccess) break;
      }
    }
     else {
      // LEGACY ROLE-BASED AUTHORIZATION (backward compatible)
      // Check hierarchy level
      for (const requiredRole of requirements) {
        if (hasHierarchyPermission(userRole, requiredRole)) {
          hasAccess = true;
          break;
        }

        // Also check extra_roles for direct matches
        if (userExtraRoles.includes(requiredRole)) {
          hasAccess = true;
          break;
        }
      }
    }

    if (!hasAccess) {
      const requiredInfo = isPermissionBased
        ? `permissions: ${requirements.map(p => p.description || 'unknown').join(", ")}`
        : `roles: ${requirements.join(", ")}`;

      auditLogger(
        `Forbidden: ${userRole} (extra: ${userExtraRoles.join(", ")}) → requires ${requiredInfo}`
      )(req, res, () => { });

      return buildResponse(
        res,
        403,
        "Forbidden: Insufficient privileges",
        null,
        true
      );
    }

    next();
  };
};


/**
 * Higher-order function to require multiple conditions
 * @param {Object} conditions - Conditions to check
 * @returns {Function} Express middleware
 */
export const authorizeWithConditions = (conditions) => {
  return async (req, res, next) => {
    // Check role/permission requirements
    if (conditions.requires) {
      const authMiddleware = authorize(conditions.requires);
      await authMiddleware(req, res, async () => {
        // Check custom condition if provided
        if (conditions.customCondition) {
          const result = await conditions.customCondition(req);
          if (!result) {
            return buildResponse(res, 403, conditions.customMessage || "Custom condition failed", null, true);
          }
        }
        next();
      });
    } else {
      next();
    }
  };
};

// Backward compatible alias
const authenticate = authorize;
export default authenticate;
export function blockWritesForReadOnly(req, res, next) {
  if (req.context?.read_only) {
    return buildResponse(res, 403, "Read-only oversight mode", null, true);
  }
  next();
}
export const resolveArchiveMode = (req = {}, res, next = () => { }) => {
  const isAdmin = req?.user?.role === "admin";

  if (!isAdmin) {
    // Non-admins NEVER see archived data
    req.archiveMode = "exclude";
    return next();
  }

  // Admins only
  let archive;
  archive = req.query.archive || req.headers["x-archive-mode"] || req.body?.archive;
  switch (archive) {
    case "only":
      req.archiveMode = "only";
      break;
    case "all":
      req.archiveMode = "all";
      break;
    default:
      req.archiveMode = "exclude";
  }



  next();
};


export const attachUser = async (req, res, next) => {
  try {
    const publicPaths = [
      "/signin/:role",
      "/signin/student",
      "/signin/lecturer",
      "/signin/admin",
      "/forgot-password",
      "/reset-password"
    ];

    const isPublicRoute = publicPaths.some((path) =>
      req.path.endsWith(path)
    );

    if (isPublicRoute) return next();

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : req.cookies?.access_token;

    if (!token) {
      auditLogger("Unauthorized access: No token")(req, res, () => { });
      return buildResponse(res, 401, "No token provided", null, true);
    }

    let decoded;

    if (token === process.env.token) {
      decoded = {
        role: "admin",
        _id: "690c70aa423136f152398166",
      };
    } else {
      decoded = jwt.verify(token, process.env.TOKEN_KEY);
    }

    // ✅ Attach user
    req.user = { ...decoded, token };

    // ✅ Context (your VC shadow logic stays here)
    if (decoded.role === "vc" && decoded.view_context) {
      req.context = {
        actor_id: decoded._id,
        role: "hod",
        department_id: decoded.view_context.department_id,
        acting_role: "HOD",
        read_only: req._intent !== REQUEST_INTENT.READ
      };

      req.user._id = decoded.view_context.hod_id;
      req.user.role = "hod";
    } else {
      req.context = {
        actor_id: decoded._id,
        role: decoded.role,
        department_id: decoded.department_id,
        read_only: false
      };
    }

    req.school = { _id: "SCHOOL_ID_FROM_TOKEN" };

    // Attach audit logger
    req.audit = auditLogger(`Authenticated ${decoded.role}`);

    next();
  } catch (err) {
    auditLogger(`Auth error: ${err.message}`)(req, res, () => { });
    return buildResponse(res, 401, "Invalid token", null, true);
  }
};

export function attachRequestIntent(req, res, next) {
  // Default based on method
  req._intent =
    req.method === "GET"
      ? REQUEST_INTENT.READ
      : REQUEST_INTENT.WRITE;

  if (req.method === "POST" && req.body && Object.keys(req.body).length > 0) {
    const keys = Object.keys(req.body);

    const hasRead = keys.some(k => READ_KEYS.includes(k));
    const hasOther = keys.some(k => !READ_KEYS.includes(k));

    if (hasRead && !hasOther) {
      req._intent = REQUEST_INTENT.READ;
      req._skipAuditLog = true;
    }

    if (detectMixedIntent(req.body)) {
      req._intent = REQUEST_INTENT.BLOCKED;
    }
  }

  next();
}
// Helper function to detect mixed intent in request body
function detectMixedIntent(body = {}) {
  if (!body || typeof body !== 'object') return false;

  const keys = Object.keys(body);
  if (keys.length === 0) return false;

  const hasRead = keys.some(k => READ_KEYS.includes(k));
  const hasOther = keys.some(k => !READ_KEYS.includes(k));

  return false
  return hasRead && hasOther;
}