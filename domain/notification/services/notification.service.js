import Notification from "../notification.model.js";
import User from "#domain/user/user.model.js";
import { Template } from "../template.model.js";
import DepartmentService from "#domain/organization/department/department.service.js";
import settingsService from "#domain/system/settings/settings.service.js";
import AppError from "#shared/errors/AppError.js";
import { renderTemplate } from "../templateRenderer.js";
// FIXED: Correct import path
import { queueNotificationProcess, queueDeliveryJob } from "#jobs/queues/notification.queue.js";

/**
 * Core notification processing logic
 * @private - Should only be called by queue workers
 */
export const processNotificationDelivery = async ({
  target,
  userIds,
  templateId,
  message,
  whatsappMessage,
  emailMessage,
  contextOverride = {},
  jobId,
}) => {
  if (!Array.isArray(userIds) && userIds) userIds = [userIds];
  
  if (!message && !whatsappMessage && !emailMessage && !templateId) {
    throw new AppError("Provide at least one message", 400);
  }
  
  // Global context
  const settings = contextOverride.settings || await settingsService.getSettings();
  const departmentCount = contextOverride.departmentCount || 
    await DepartmentService.getDepartmentsCount();

  // Resolve template
  let template = null;
  let channel = "both";
  let notificationTitle = "Notification";

  if (templateId) {
    template = await Template.findById(templateId);
    if (!template) {
      return { success: false, message: "Template not found" };
    }
    channel = template.channel || channel;
    notificationTitle = template.name;
  }

  // Build base query
  let query = {};
  if (target === "students") query.role = "student";
  else if (target === "lecturers") query.role = "lecturer";
  else if (target === "hods") query.role = "hod";
  else if (target === "deans") query.role = "dean";

  if (userIds) {
    console.log(userIds);
    if (Array.isArray(userIds)) query._id = { $in: userIds };
    else query._id = userIds;
  }

  const cursor = User.find(query).cursor();

  let batch = [];
  const batchSize = 500;
  let totalProcessed = 0;

  for await (const user of cursor) {
    batch.push(user);

    if (batch.length === batchSize) {
      await processBatch(batch, {
        template,
        channel,
        notificationTitle,
        settings,
        departmentCount,
        contextOverride,
        message,
        whatsappMessage,
        emailMessage,
        jobId
      });
      totalProcessed += batch.length;
      batch = [];
    }
  }

  // Process remaining
  if (batch.length > 0) {
    await processBatch(batch, {
      template,
      channel,
      notificationTitle,
      settings,
      departmentCount,
      contextOverride,
      message,
        whatsappMessage,
      emailMessage,
      jobId
    });
    totalProcessed += batch.length;
  }

  return {
    success: true,
    totalProcessed,
    message: `Notification queued for ${totalProcessed} users via ${channel}`,
  };
};

/**
 * Process a batch of users
 * @private
 */
async function processBatch(users, config) {
  const {
    template,
    channel,
    notificationTitle,
    settings,
    departmentCount,
    contextOverride,
    message,
    whatsappMessage,
    emailMessage,
    jobId
  } = config;

  const notifications = [];
  const deliveryPromises = [];

  for (const user of users) {
    const context = {
      user,
      settings,
      departmentCount,
      ...contextOverride,
    };

    const whatsappTpl = template?.whatsapp_template || whatsappMessage || message || "";
    const emailTpl = template?.email_template || emailMessage || message || whatsappTpl || "";

    // Parallel template rendering
    const [emailContent, whatsappContent] = await Promise.all([
      renderTemplate(emailTpl, context),
      renderTemplate(whatsappTpl, context)
    ]);

    // Collect notifications for bulk insert
    notifications.push({
      recipient_id: user._id,
      title: notificationTitle,
      message: whatsappContent || emailContent || message,
      type: channel,
      'metadata.processJobId': jobId,
      'delivery.email': 'pending',
      'delivery.whatsapp': 'pending',
    });

    // Queue email delivery
    if ((channel === "email" || channel === "both") && user.email) {
      deliveryPromises.push(
        queueDeliveryJob({
          channel: "email",
          recipientId: user._id,
          templateId: template?._id,
          content: emailContent,
          metadata: {
            to: user.email,
            subject: notificationTitle,
            processJobId: jobId
          }
        })
      );
    }

    // Queue WhatsApp delivery
    if ((channel === "whatsapp" || channel === "both") && whatsappContent) {
      deliveryPromises.push(
        queueDeliveryJob({
          channel: "whatsapp",
          recipientId: user._id,
          templateId: template?._id,
          content: whatsappContent,
          metadata: {
            phone: user.phone,
            processJobId: jobId
          }
        })
      );
    }
  }

  // Bulk insert notifications
  if (notifications.length) {
    await Notification.insertMany(notifications);
  }

  // Queue delivery jobs in parallel
  await Promise.allSettled(deliveryPromises);
}

/**
 * Public API - Queue notification processing
 * Returns immediately, actual processing happens async
 */
export const queueNotificationCore = async (params) => {
  // Queue the orchestration job
  const job = await queueNotificationProcess(params);
  
  return {
    success: true,
    jobId: job.id || job._id,
    message: "Notification processing queued",
  };
};

/**
 * Legacy function - Maintains backward compatibility
 * This is the OLD sendNotificationCore that processes synchronously
 */
export const sendNotificationCore = async (params) => {
  // Route to queue-based system
  return queueNotificationCore(params);
};

/**
 * Get notification progress
 */
export const getNotificationProgress = async (jobId) => {
  const totalCount = await Notification.countDocuments({
    'metadata.processJobId': jobId
  });
  
  const sentCount = await Notification.countDocuments({
    'metadata.processJobId': jobId,
    $or: [
      { 'delivery.email': 'sent' },
      { 'delivery.whatsapp': 'sent' }
    ]
  });
  
  const failedCount = await Notification.countDocuments({
    'metadata.processJobId': jobId,
    $or: [
      { 'delivery.email': 'failed' },
      { 'delivery.whatsapp': 'failed' }
    ]
  });
  
  return {
    jobId,
    total: totalCount,
    processed: sentCount + failedCount,
    sent: sentCount,
    failed: failedCount,
    percentage: totalCount ? Math.round(((sentCount + failedCount) / totalCount) * 100) : 0,
    status: (sentCount + failedCount) === totalCount ? 'completed' : 'processing'
  };
};