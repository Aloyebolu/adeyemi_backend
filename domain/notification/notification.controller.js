import Notification from "./notification.model.js";
import { Template } from "./template.model.js";
import buildResponse from "#utils/responseBuilder.js";
import fetchDataHelper from "#utils/fetchDataHelper.js";
import { dataMaps } from "#config/dataMap.js";
import mongoose from "mongoose";

// Re-export everything from the service layer for backward compatibility
export { 
  sendNotificationCore,
  getNotificationProgress,
  processNotificationDelivery 
} from "./services/notification.service.js";

// Re-export template renderer functions
export { renderTemplate, resolveVariable } from "./templateRenderer.js";

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

export const sendNotification = async (req, res, next) => {
  try {
    const { target, userIds, templateId, message, whatsappMessage, emailMessage } = req.body;
    
    // Import dynamically to avoid circular dependency
    const { sendNotificationCore } = await import("./services/notification.service.js");
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
    
    const notifications = await fetchDataHelper(req, res, Notification, {
      configMap: dataMaps.Notifications,
      autoPopulate: true,
      models: {},
      additionalFilters: { recipient_id: mongoose.Types.ObjectId(user_id) },
      sort: { created_at: -1 },
      forceFind: false
    });
    
    return;
  } catch (error) {
    next(error)
  }
};

/* 📬 GET Top Unread Notifications */
export const getTopUnread = async (req, res, next) => {
  try {
    const user_id = req.user._id;

    const notifications = await fetchDataHelper(req, res, Notification, {
      configMap: dataMaps.Notifications,
      autoPopulate: true,
      models: {},
      additionalFilters: { recipient_id: new mongoose.Types.ObjectId(user_id), is_read: false },
      maxLimit: 3
    });

    return;
  } catch (error) {
    next(error);
  }
};

export const getUnreadNotificationCount = async (req, res, next) => {
  try {
    const user_id = req.user._id;
    
    const unreadCount = await Notification.countDocuments({
      recipient_id: user_id,
      is_read: false,
    });

    return buildResponse.success(res, "", unreadCount)
  } catch (error) {
    next(error)
  }
};