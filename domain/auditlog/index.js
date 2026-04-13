// Main export file
import AuditLog from "./auditlog.model.js";
import AuditLogService from "./auditlog.service.js";
import AuditUtil from "./auditlog.util.js";
import auditMiddleware, { authAuditMiddleware, dbAuditMiddleware } from "./auditlog.middleware.js";
import * as auditController from "./auditlog.controller.js";

export {
  AuditLog,
  AuditLogService,
  AuditUtil,
  auditMiddleware,
  authAuditMiddleware,
  dbAuditMiddleware,
  auditController
};

export default {
  AuditLog,
  AuditLogService,
  AuditUtil,
  auditMiddleware,
  authAuditMiddleware,
  dbAuditMiddleware,
  ...auditController
};