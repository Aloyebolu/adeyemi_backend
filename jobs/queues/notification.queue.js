import mongoose from "mongoose";
import { getAgenda } from "../agenda.config.js";
import { delay } from "@whiskeysockets/baileys";

/**
 * Queue a notification job (LEGACY - maintained for backward compatibility)
 * @param {string} target - "specific", "group", "broadcast", "email", "whatsapp"
 * @param {string} recipientId - Recipient ID
 * @param {string} templateId - Template ID
 * @param {string} message - Notification message
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<boolean>} Success status
 */
export async function queueNotification(
    target,
    recipientId,
    templateId,
    message,
    metadata = {}
) {
    try {
        const agenda = await getAgenda();

        // Route to the new queue system
        if (target === "email" || target === "whatsapp") {
            // This is actually a delivery job - use new system
            await agenda.now("notification:deliver", {
                channel: target,
                recipientId,
                templateId,
                content: message,
                metadata,
                timestamp: new Date().toISOString()
            });
        } else {
            // This is a notification processing job
            await agenda.now("notification:process", {
                target,
                userIds: recipientId,
                templateId,
                message,
                contextOverride: metadata,
                timestamp: new Date().toISOString()
            });
        }

        await delay(100);
        return true;
    } catch (error) {
        console.error("Failed to queue notification:", error);
        return false;
    }
}

/**
 * Queue notification processing (NEW - main entry point)
 * @param {Object} params - Processing parameters
 * @returns {Promise<Object>} Created job
 */
export async function queueNotificationProcess(params) {
    try {
        const agenda = await getAgenda();
        
        const job = await agenda.now("notification:process", {
            ...params,
            timestamp: new Date().toISOString()
        });
        
        return job;
    } catch (error) {
        console.error("Failed to queue notification process:", error);
        throw error;
    }
}

/**
 * Queue individual delivery job (NEW - for email/whatsapp)
 * @param {Object} params - Delivery parameters
 * @returns {Promise<Object>} Created job
 */
export async function queueDeliveryJob({ 
    channel, 
    recipientId, 
    templateId, 
    content, 
    metadata = {}, 
    delayMs = 0 
}) {
    try {
        const agenda = await getAgenda();
        
        const jobData = {
            channel,
            recipientId,
            templateId,
            content,
            metadata,
            timestamp: new Date().toISOString()
        };
        
        if (delayMs > 0) {
            return agenda.schedule(new Date(Date.now() + delayMs), "notification:deliver", jobData);
        } else {
            return agenda.now("notification:deliver", jobData);
        }
    } catch (error) {
        console.error("Failed to queue delivery job:", error);
        throw error;
    }
}

/**
 * Schedule a notification for later delivery (LEGACY - maintained)
 * @param {Date|string} scheduledAt - When to send
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} Created job
 */
export async function scheduleNotification(...args) {
    return queueNotification(...args);
}

/**
 * Get notification job status
 * @param {string} jobId - Job ID
 * @returns {Promise<Object|null>} Job status
 */
export async function getNotificationStatus(jobId) {
    const agenda = await getAgenda();

    try {
        const jobs = await agenda.jobs({
            _id: new mongoose.Types.ObjectId(jobId)
        });

        if (jobs.length === 0) return null;

        const job = jobs[0];
        return {
            id: job.attrs._id.toString(),
            name: job.attrs.name,
            status: job.attrs.failedAt ? "failed"
                : job.attrs.lastFinishedAt ? "completed"
                    : job.attrs.lockedAt ? "processing"
                        : "queued",
            scheduledFor: job.attrs.nextRunAt,
            lastRunAt: job.attrs.lastRunAt,
            completedAt: job.attrs.lastFinishedAt,
            failedAt: job.attrs.failedAt,
            failCount: job.attrs.failCount,
            failReason: job.attrs.failReason,
            data: job.attrs.data
        };
    } catch (error) {
        console.error("[Notification Queue] Error fetching status:", error);
        return null;
    }
}

/**
 * Cancel a notification job
 * @param {string} jobId - Job ID
 * @returns {Promise<boolean>} Success status
 */
export async function cancelNotification(jobId) {
    const agenda = await getAgenda();

    try {
        const result = await agenda.cancel({ _id: new mongoose.Types.ObjectId(jobId) });
        console.log(`[Notification Queue] Notification cancelled: ${jobId}`);
        return result > 0;
    } catch (error) {
        console.error(`[Notification Queue] Failed to cancel ${jobId}:`, error);
        return false;
    }
}

/**
 * Get queue statistics
 * @returns {Promise<Object>} Queue statistics
 */
export async function getQueueStats() {
    const agenda = await getAgenda();
    
    const stats = {
        processing: await agenda._collection.countDocuments({ lockedAt: { $exists: true } }),
        queued: await agenda._collection.countDocuments({ 
            nextRunAt: { $lte: new Date() },
            lockedAt: { $exists: false }
        }),
        failed: await agenda._collection.countDocuments({ failCount: { $gte: 3 } }),
        total: await agenda._collection.countDocuments()
    };
    
    return stats;
}