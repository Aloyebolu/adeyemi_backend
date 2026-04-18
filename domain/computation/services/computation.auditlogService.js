// computation/services/computation.auditlogService.js
import { SYSTEM_USER_ID } from "#config/system.js";
import AuditLogService from "#domain/auditlog/auditlog.service.js";

class ComputationAuditLogService {
    constructor(buffer, computationId) {
        this.eventId = computationId; // Computation ID
        this.buffer = buffer;     // buffer passed from computation
    }

    getEventId() {
        return this.eventId;
    }

    // Push any student update to the buffer
    // computation/services/computation.auditlogService.js
    logStudentUpdate({ studentId, oldData, newData, context, reason = "" }) {
        // Compute the delta: only fields that actually changed
        const changedFields = [];
        const deltaBefore = {};
        const deltaAfter = {};

        const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);

        for (const key of allKeys) {
            const oldVal = oldData?.[key];
            const newVal = newData?.[key];

            // Only capture fields that actually changed
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                changedFields.push(key);
                deltaBefore[key] = oldVal;
                deltaAfter[key] = newVal;
            }
        }

        // If nothing changed, skip logging
        if (changedFields.length === 0) return;

        // Push to buffer
        this.buffer.push({
            userId: context.actorId,
            action: "STUDENT_UPDATE",
            entity: "Student",
            entityId: studentId,
            changes: {
                before: deltaBefore,
                after: deltaAfter,
                changedFields,
                delta: deltaAfter // can be useful for quick reference
            },
            metadata: {
                reason,
                semesterId: context.semesterId,
                level: newData.level || oldData.level,
                cgpa: newData.cgpa || oldData.cgpa,
                eventId: this.eventId
            }
        });
    }

    // Push computation errors
    logComputationError(error, context) {
        this.buffer.push({
            userId: context.actorId,
            action: "COMPUTATION_ERROR",
            entity: "Computation",
            metadata: {
                message: error.message,
                stack: error.stack,
                semesterId: context.semesterId,
                eventId: this.eventId
            }
        });
    }

    // Flush buffer to DB using bulk operation
    async flushBuffer() {
        if (!this.buffer.length) return;

        await AuditLogService.logBulkOperation({
            userId: SYSTEM_USER_ID,
            action: "BULK_COMPUTATION_LOGS",
            entity: "Computation",
            items: this.buffer,
            metadata: {
                eventId: this.eventId,
                totalLogs: this.buffer.length
            }
        });

        // clear buffer
        this.buffer.length = 0;
    }
}

export default ComputationAuditLogService;