import Notification from "./notification.model.js";
import User from "#domain/user/user.model.js";
import Settings from "#domain/system/settings/settings.model.js";
import { sendEmail } from "#utils/sendEmail.js";
import { Template } from "./template.model.js";
import buildResponse from "#utils/responseBuilder.js";
import fetchDataHelper from "#utils/fetchDataHelper.js";
import { dataMaps } from "#config/dataMap.js";
import { resolveUserName } from "#utils/resolveUserName.js";
import DepartmentService from "#domain/organization/department/department.service.js";
import settingsService from "#domain/system/settings/settings.service.js";
import courseModel from "#domain/course/course.model.js";
import mongoose from "mongoose";
import { queueNotification } from "#workers/department.queue.js";
import AppError from "#shared/errors/AppError.js";
import { validateObjectId } from "#utils/validator.js";
import { sendWhatsAppMessage } from "./services/whatsapp/whatsapp.js";

/* 🧠 Dynamic variable resolver */
async function resolveVariable(variable, context) {
  const [scope, ...keys] = variable.split(".");

  // Map available data sources
  const sources = {
    user: context.user,
    settings: context.settings,
    department: context.department,
  };

  let data = sources[scope];
  for (const key of keys) {
    if (!data) break;
    data = data[key];
  }

  // 🧩 Handle computed or custom variables
  if (!data) {
    switch (variable) {
      case "user.age_category":
        if (context.user?.dob) {
          const age = new Date().getFullYear() - new Date(context.user.dob).getFullYear();
          data = age < 18 ? "Underage" : age < 30 ? "Young Adult" : "Mature";
        }
        break;
      case "settings.current_semester_name":
        data = context.settings?.semester ? `Semester ${context.settings.semester}` : "Unknown";
        break;
      case "departments.count":
        data = context.departmentCount ?? 0;
        break;
      case "user.department.course_count":
        if (context.user?.department_id) {
          const count = await courseModel.countDocuments({ department_id: context.user.department_id });
          data = count;
        } else {
          data = 0;
        }
        break;
      case "timeGreeting":
        const now = new Date();
        const hour = now.getHours();

        if (hour >= 5 && hour < 12) {
          data = "Good morning! ☀️";
        } else if (hour >= 12 && hour < 17) {
          data = "Good afternoon! 🌤️";
        } else if (hour >= 17 && hour < 21) {
          data = "Good evening! 🌙";
        } else {
          data = "Good night! 🌃";
        }
        break;
      case "portal_url":
        data = context.settings?.websiteUrl || "";
        break;

      default:
        data = "";
    }
  }

  return data ?? "";
}

/* 🧩 Template renderer */
async function renderTemplate(template, context) {
  const matches = template.match(/{{\s*([\w.]+)\s*}}/g) || [];

  let rendered = template;
  for (const match of matches) {
    const variable = match.replace(/{{\s*|\s*}}/g, "");
    const value = await resolveVariable(variable, context);
    rendered = rendered.replace(match, value);
  }
  return rendered;
}

/* ✨ CREATE Template */
export const createTemplate = async (req, res, next) => {
  try {
    const { name, channel, email_template, whatsapp_template, variables } = req.body;

    if ((channel == "both" || !channel) && (!email_template || !whatsapp_template)) {
      return res.status(400).json({ success: false, message: "Both (email or whatsapp) is required for 'both' channel" });
    } else if (channel == "email" && !email_template) {
      return res.status(400).json({ success: false, message: "Email template is required for 'email' channel" });
    } else if (channel == "whatsapp" && !whatsapp_template) {
      return res.status(400).json({ success: false, message: "WhatsApp template is required for 'whatsapp' channel" });
    }
    if (!name) {
      return res.status(400).json({ success: false, message: "Template name is required" });
    }

    const exists = await Template.findOne({ name });
    if (exists) {
      return res.status(400).json({ success: false, message: "Template already exists" });
    }

    const template = await Template.create({
      name,
      channel,
      email_template,
      whatsapp_template,
      variables,
      created_by: req.user?._id || null,
    });

    buildResponse.success(res, "Success", template);
  } catch (error) {
    next(error)
  }
};

/* 📋 GET All Templates */
export const getTemplates = async (req, res, next) => {
  try {
    const result = await fetchDataHelper(req, res, Template, {
      configMap: dataMaps.Template,
      autoPopulate: true,
      models: {},
      populate: [],
    });
    // const templates = await Template.find().sort({ createdAt: -1 });
    // res.status(200).json({ success: true, data: result });
    return;
  } catch (error) {
    next(error)
  }
};

/* 🔍 GET Single Template */
export const getTemplateById = async (req, res, next) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, message: "Template not found" });
    buildResponse.success(res, "Success", template);
  } catch (error) {
    next(error)
  }
};

/* 🛠️ UPDATE Template */
export const updateTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updated = await Template.findByIdAndUpdate(id, updates, { new: true });
    if (!updated) return buildResponse.error("Template not found");
    buildResponse.success(res, "success", updated);
  } catch (error) {
    next(error)
  }
};

/* ❌ DELETE Template */
export const deleteTemplate = async (req, res, next) => {
  try {
    const deleted = await Template.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Template not found" });
    buildResponse.success(res, "Template deleted successfully");
  } catch (error) {
    next(error)
  }
};

/**
 * 
 * @param {string} target The target for the operation
 * NOTE:::::Never forget to call this function using the async keyword to avoid crashing the server
 */

export const sendNotificationCore = async ({
  target,
  userIds,
  templateId,
  message,
  whatsappMessage,
  emailMessage,
  contextOverride = {},
}) => {
  if(!Array.isArray(userIds) && userIds) userIds= [userIds]
  
  if(!message && !whatsappMessage && !emailMessage && !templateId){
    throw new AppError("Provide at least one message", 400)
  }
  // Global context (still fine)
  const settings =
    contextOverride.settings || (await settingsService.getSettings());
  const departmentCount =
    contextOverride.departmentCount ||
    (await DepartmentService.getDepartmentsCount());

  // Resolve template
  let template = null;
  let channel = "both";
  let notificationTitle = "Notification";

  if (templateId) {
    template = await Template.findById(templateId);
    if (!template)
      return { success: false, message: "Template not found" };

    channel = template.channel || channel;
    notificationTitle = template.name;
  }

  // Build base query instead of fetching everything at once
  let query = {};
  if (target === "students") query.role = "student";
  else if (target === "lecturers") query.role = "lecturer";
  else if (target === "hods") query.role = "hod";
  else if (target === "deans") query.role = "dean";

  if (userIds) {
    console.log(userIds)
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
      await processBatch(batch);
      totalProcessed += batch.length;
      batch = [];
    }
  }

  // Process remaining
  if (batch.length > 0) {
    await processBatch(batch);
    totalProcessed += batch.length;
  }

  return {
    success: true,
    message: `Notification queued for ${totalProcessed} users via ${channel}`,
  };

  //  Batch processor (core magic)
  async function processBatch(users) {
    const notifications = [];
    const agendaJobs = [];

    for (const user of users) {
      const context = {
        user,
        settings,
        departmentCount,
        ...contextOverride,
      };

      const whatsappTpl =
        template?.whatsapp_template || whatsappMessage || message || "";
      const emailTpl =
        template?.email_template ||
        emailMessage ||
        message ||
        whatsappTpl ||
        "";

      const emailContent = await renderTemplate(emailTpl, context);
      const whatsappContent = await renderTemplate(whatsappTpl, context);

      // ✅ Collect notifications for bulk insert
      notifications.push({
        recipient_id: user._id,
        title: notificationTitle,
        message: whatsappContent || emailContent || message,
        type: channel,
      });

      // ✅ Queue EMAIL
      if ((channel === "email" || channel === "both") && user.email) {
        agendaJobs.push(
          queueNotification("email", user._id, templateId, emailContent, {
            to: user.email,
            subject: notificationTitle,
          })
        );
      }

      // ✅ Queue WHATSAPP
      if (
        (channel === "whatsapp" || channel === "both") &&
        whatsappContent
      ) {
        agendaJobs.push(
          queueNotification("whatsapp", user._id, templateId, whatsappContent, {
            phone: user.phone,
          })
        );
      }
    }

    // ⚡ Bulk insert notifications
    if (notifications.length) {
      await Notification.insertMany(notifications);
    }

    // ⚡ Queue jobs in parallel (non-blocking)
    await Promise.allSettled(agendaJobs);
  }
};

export const sendNotification = async (req, res, next) => {
  try {
    const { target, userIds, templateId, message, whatsappMessage, emailMessage } = req.body;

    const result = await sendNotificationCore({ target, userIds, templateId, message, whatsappMessage, emailMessage });

    return buildResponse.success(res, 'Success', result)
  } catch (error) {
    next(error)
  }
};



/* 📬 GET User Notifications */
export const getNotifications = async (req, res, next) => {
  try {
    const user_id = req.user._id;

    await Notification.updateMany(
      { recipient_id: user_id, is_read: false },
      { $set: { is_read: true } }
    );
    // 1️⃣ Fetch all notifications for this user
    const notifications = await fetchDataHelper(req, res, Notification, {
      configMap: dataMaps.Notifications,
      autoPopulate: true,
      models: {},
      additionalFilters: { recipient_id: mongoose.Types.ObjectId(user_id) },
      // custom_fields: ["is_read"],
      sort: { created_at: -1 },
      forceFind: false
    });
    // 2️⃣ Mark all as read

    return;
  } catch (error) {
    next(error)
  }
};
/* 📬 GET User Notifications */
export const getTopUnread = async (req, res, next) => {
  try {
    const user_id = req.user._id;

    // 1️⃣ Fetch all notifications for this user
    const notifications = await fetchDataHelper(req, res, Notification, {
      configMap: dataMaps.Notifications,
      autoPopulate: true,
      models: {},
      additionalFilters: { recipient_id: new mongoose.Types.ObjectId(user_id), is_read: false },
      maxLimit: 3
    });


    return;
    // 3️⃣ Return notifications
    // res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
};

export const getUnreadNotificationCount = async (req, res, next) => {
  try {
    const user_id = req.user._id;
    // Count unread notifications for this user
    const unreadCount = await Notification.countDocuments({
      recipient_id: user_id,
      is_read: false,
    });


    return buildResponse.success(res, "", unreadCount)
    // Return count
    // res.status(200).json({ success: true, unreadCount });
  } catch (error) {
    next(error)
  }
};
