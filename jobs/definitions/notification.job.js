import { processNotificationDelivery } from "#domain/notification/services/notification.service.js";
import { sendEmail } from "#utils/sendEmail.js";
import { sendWhatsAppMessage } from "#domain/notification/services/whatsapp/whatsapp.js";
import Notification from "#domain/notification/notification.model.js";
import { getWhatsAppWorker } from "#jobs/worker.js";

/**
 * Define all notification jobs
 * @param {Agenda} agenda - Agenda instance
 */
export function defineNotificationJob(agenda) {
  
  // ============================================
  // LEGACY JOB - Maintains backward compatibility
  // ============================================
  agenda.define(
    "send-notification",
    {
      priority: "normal",
      concurrency: 20
    },
    async (job) => {
      const { target, recipientId, templateId, message, metadata } = job.attrs.data;
      const jobId = job.attrs._id.toString();

      console.log(`[Notification:Legacy] Processing job ${jobId}`);

      try {
        // Route based on target type
        if (target === "email") {
          // Direct email delivery
          await sendEmail({
            to: metadata?.to || metadata?.email,
            subject: metadata?.subject || "Notification",
            html: message
          });
          
          // Update notification if exists
          if (metadata?.notificationId) {
            await Notification.updateOne(
              { _id: metadata.notificationId },
              { 
                $set: { 
                  'delivery.email': 'sent',
                  'delivery.emailSentAt': new Date(),
                  'delivery.emailJobId': jobId
                }
              }
            );
          }
          
        } else if (target === "whatsapp") {
          // Direct WhatsApp delivery
          await whatsAppService.sendMessage(metadata?.phone || metadata?.to,  message);
          
          // Update notification if exists
          if (metadata?.notificationId) {
            await Notification.updateOne(
              { _id: metadata.notificationId },
              { 
                $set: { 
                  'delivery.whatsapp': 'sent',
                  'delivery.whatsappSentAt': new Date(),
                  'delivery.whatsappJobId': jobId
                }
              }
            );
          }
          
        } else {
          // Process as batch notification using the new orchestrator
          const result = await processNotificationDelivery({
            target,
            userIds: recipientId,
            templateId,
            message,
            contextOverride: metadata,
            jobId
          });
          
          console.log(`[Notification:Legacy] Batch processing completed for job ${jobId}:`, result);
        }

        return { success: true };

      } catch (error) {
        console.error(`[Notification:Legacy] Failed job ${jobId}:`, error);
        throw error; // Let Agenda handle retry
      }
    }
  );

  // ============================================
  // PROCESS JOB - Orchestrates batch processing
  // ============================================
  agenda.define(
    "notification:process",
    {
      priority: "normal",
      concurrency: 5,
      lockLifetime: 10 * 60 * 1000 // 10 minutes for large batches
    },
    async (job) => {
      const params = job.attrs.data;
      const jobId = job.attrs._id.toString();
      
      console.log(`[Notification:Process] Starting job ${jobId}`);
      console.log(`[Notification:Process] Params:`, {
        target: params.target,
        userIds: Array.isArray(params.userIds) ? `${params.userIds.length} users` : 'single user',
        templateId: params.templateId,
        hasMessage: !!params.message
      });

      try {
        const result = await processNotificationDelivery({
          ...params,
          jobId
        });
        
        console.log(`[Notification:Process] Completed job ${jobId}:`, result);
        
        return result;
        
      } catch (error) {
        console.error(`[Notification:Process] Failed job ${jobId}:`, error);
        throw error;
      }
    }
  );

  // ============================================
  // DELIVERY JOB - Sends individual messages
  // ============================================
  agenda.define(
    "notification:deliver",
    {
      priority: "high",
      concurrency: 20,
      lockLifetime: 2 * 60 * 1000 // 2 minutes
    },
    async (job) => {
      const { channel, recipientId, templateId, content, metadata } = job.attrs.data;
      const deliveryId = job.attrs._id.toString();
      const failCount = job.attrs.failCount || 0;
      
      console.log(`[Notification:Deliver] Processing ${channel} delivery ${deliveryId} (attempt ${failCount + 1}/4)`);
      
      // Stop after 3 retries (failCount 0,1,2,3 = 4 attempts total)
      if (failCount >= 3) {
        console.error(`[Notification:Deliver] Abandoned after ${failCount} retries: ${deliveryId}`);
        
        await Notification.updateOne(
          { recipient_id: recipientId },
          { 
            $set: { 
              [`delivery.${channel}`]: 'failed',
              [`delivery.${channel}FailedAt`]: new Date(),
              [`delivery.${channel}FailReason`]: 'max_retries_exceeded',
              [`delivery.${channel}JobId`]: deliveryId,
              [`delivery.${channel}Attempts`]: failCount
            }
          }
        );
        
        return { success: false, reason: 'max_retries' };
      }
      
      try {
        // Actually send the message
        if (channel === "email") {
          await sendEmail({
            to: metadata.to,
            subject: metadata.subject || "Notification",
            html: content
          });
          
          console.log(`[Notification:Deliver] Email sent to ${metadata.to}`);
          
        }  else if (channel === "whatsapp") {
          // ✅ Check WhatsApp status using the service
          const whatsAppService = getWhatsAppWorker();
          const workerStatus = await whatsAppService.getStatus();
          const activeWorker = workerStatus?.sessions.find(w => w.isConnected);
          
          if (!activeWorker) {
            throw new Error('No active WhatsApp worker available');
          }
          
          // Check if worker is paused
          if (activeWorker.metadata?.isPaused) {
            throw new Error('WhatsApp worker is paused');
          }

          
          // All good, send the message
          await whatsAppService.sendMessage(metadata.phone, content);
          
          console.log(`[Notification:Deliver] WhatsApp sent to ${metadata.phone}`);
        }
        
        // Update notification status
        const updateResult = await Notification.updateOne(
          { 
            recipient_id: recipientId,
            $or: [
              { [`delivery.${channel}`]: { $ne: 'sent' } },
              { [`delivery.${channel}JobId`]: { $ne: deliveryId } }
            ]
          },
          { 
            $set: { 
              [`delivery.${channel}`]: 'sent',
              [`delivery.${channel}SentAt`]: new Date(),
              [`delivery.${channel}JobId`]: deliveryId,
              [`delivery.${channel}Attempts`]: failCount + 1
            }
          }
        );
        
        return { 
          success: true, 
          channel, 
          recipientId, 
          deliveryId,
          updated: updateResult.modifiedCount > 0 
        };
        
      } catch (error) {
        console.error(`[Notification:Deliver] Failed for ${channel} (attempt ${failCount + 1}/4):`, error);
        
        // Track failure attempt
        await Notification.updateOne(
          { recipient_id: recipientId },
          { 
            $set: { 
              [`delivery.${channel}`]: 'retrying',
              [`delivery.${channel}LastAttempt`]: new Date(),
              [`delivery.${channel}Attempts`]: failCount + 1,
              [`delivery.${channel}LastError`]: error.message
            }
          }
        );
        
        throw error; // Let Agenda retry with backoff
      }
    }
  );

  // ============================================
  // CLEANUP JOB - Remove old notifications
  // ============================================
  agenda.define(
    "notification:cleanup",
    {
      priority: "low",
      concurrency: 1
    },
    async (job) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      console.log(`[Notification:Cleanup] Removing notifications older than ${thirtyDaysAgo.toISOString()}`);
      
      const result = await Notification.deleteMany({
        createdAt: { $lt: thirtyDaysAgo },
        'delivery.email': 'sent',
        'delivery.whatsapp': 'sent'
      });
      
      console.log(`[Notification:Cleanup] Removed ${result.deletedCount} old notifications`);
      
      return { deleted: result.deletedCount };
    }
  );

  // ============================================
  // HEARTBEAT JOB - Monitoring
  // ============================================
  agenda.define(
    "heartbeat",
    {
      priority: "lowest",
      concurrency: 1
    },
    async () => {
      const whatsappWorker = getWhatsAppWorker();
      const whatsappStatus = whatsappWorker ? whatsappWorker.getStatus() : 'not initialized';
      
      // Get queue statistics
      const stats = {
        processing: await agenda._collection.countDocuments({ lockedAt: { $exists: true } }),
        queued: await agenda._collection.countDocuments({ 
          nextRunAt: { $lte: new Date() },
          lockedAt: { $exists: false }
        }),
        failed: await agenda._collection.countDocuments({ failCount: { $gte: 3 } })
      };
      
      console.log(`[Heartbeat] Agenda alive at ${new Date().toISOString()}`);
      console.log(`[Heartbeat] WhatsApp worker status: ${whatsappStatus}`);
      console.log(`[Heartbeat] Queue stats:`, stats);
      
      return {
        timestamp: new Date().toISOString(),
        whatsappStatus,
        queueStats: stats
      };
    }
  );

  console.log("[Job Definition] All notification jobs defined:");
}