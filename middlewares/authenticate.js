import jwt from "jsonwebtoken";
import buildResponse from "../utils/responseBuilder.js";
import { auditLogger } from "../middlewares/auditLogger.js";
import { detectRequestIntent, REQUEST_INTENT } from "../domain/auditlog/auditlog.middleware.js";

// System-wide authorized roles
const AUTHORIZED_ROLES = ["admin", "hod", "lecturer", "student", "dean", "vc"];


// Define role hierarchy (higher roles inherit access from lower roles)
const ROLE_HIERARCHY = {
  admin: ["admin", "dean", "hod", "lecturer", "pro", "student"], // Admin has all access
  dean: ["dean", "hod", "lecturer", "pro", "student"], // Dean inherits from hod, lecturer, etc.
  hod: ["hod", "lecturer", "student"], // HOD inherits from lecturer
  lecturer: ["lecturer"], // Lecturer only
  pro: ["pro"], // PRO only
  student: ["student"] // Student only
};

// Helper function to check if user role has access to required role
const hasPermission = (userRole, requiredRole) => {
  // If no hierarchy defined for user role, fall back to exact match
  if (!ROLE_HIERARCHY[userRole]) {
    return userRole === requiredRole;
  }

  // Check if required role is in user's hierarchy
  return ROLE_HIERARCHY[userRole].includes(requiredRole);
};


const authenticate = (roles = []) => {
  const allowedRoles = Array.isArray(roles) ? roles : roles ? [roles] : [];

  return async (req, res, next) => {
    try {
      const publicPaths = ["/signin/:role", "/signin/student", "/signin/lecturer", "/signin/admin", "/forgot-password", "/reset-password"];
      const isPublicRoute = publicPaths.some((path) => req.path.endsWith(path));

      // ✅ Allow public routes
      if (isPublicRoute) return next();

      // 🔑 Extract token from Authorization header or cookies
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : req.cookies?.access_token;

      if (!token) {
        auditLogger("Unauthorized access: No token provided")(req, res, () => { });
        return buildResponse(res, 401, "Access denied: No token provided.", null, true);
      }



      let decoded;

      // ✅ Allow a system token override (for admin setup or service calls)
      if (token === process.env.token) {
        decoded = {
          role: "admin",
          _id: "690c70aa423136f152398166",
        };
        // Example test users:
        // decoded = {
        //   role: "lecturer",
        //   _id: "6928c5a475c778f1ee14c6c3"
        // }
        // decoded = {
        //   role: "hod",
        //   _id: "6928c5a475c778f1ee14c6c3"
        // }
      } else {
        decoded = jwt.verify(token, process.env.TOKEN_KEY);

      }

      // ✅ Attach user payload to request
      req.user = decoded;
      req.user.token = token;
      // Inject context for VC shadow mode
      if (decoded.role === "vc" && decoded.view_context) {
        req.context = {
          actor_id: decoded._id,             // real VC
          role: "hod",                        // still VC
          department_id: decoded.view_context.department_id,
          acting_role: "HOD",                // so routes think HOD context
          read_only: req._intent != REQUEST_INTENT.READ// enforce read-only
        };
        req.user._id = decoded.view_context.hod_id;
        req.user.role = 'hod'
      } else {
        req.context = {
          actor_id: decoded._id,
          role: decoded.role,
          department_id: decoded.department_id,
          read_only: false
        };
      }

      // Attach the school_id to the request

      req.school = {
        _id: "SCHOOL_ID_FROM_TOKEN"
      };


      // ✅ Check that the role exists in the authorized roles list
      if (!AUTHORIZED_ROLES.includes(decoded.role)) {
        auditLogger(`Unauthorized role: ${decoded.role}`)(req, res, () => { });
        return buildResponse(res, 403, `Unauthorized role: ${decoded.role}`, null, true);
      }

      // ✅ Check route-level role restriction with hierarchy
      if (allowedRoles.length > 0) {
        let hasAccess = false;

        // Check if user has access to any of the allowed roles via hierarchy
        for (const requiredRole of allowedRoles) {
          if (hasPermission(decoded.role, requiredRole)) {
            hasAccess = true;
            break;
          }
        }

        if (!hasAccess) {
          auditLogger(`Forbidden: ${decoded.role} tried to access route requiring ${allowedRoles.join(', ')}`)(req, res, () => { });
          return buildResponse(res, 403, "Forbidden: Insufficient privileges.", null, true);
        }
      }

      // ✅ Success: attach audit logger for later stages
      req.audit = auditLogger(`Authenticated ${decoded.role} access`);
      next();
    } catch (err) {
      console.error("Auth error:", err.message);
      auditLogger(`Authentication error: ${err.message}`)(req, res, () => { });
      return buildResponse(res, 401, "Invalid or expired token.", null, true, err);
    }
  };
};

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
