import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { exec } from 'child_process';
import notifier from 'node-notifier';
import path from 'path';
import { fileURLToPath } from 'url';
import AppError from '#shared/errors/AppError.js';
import readline from 'readline';
import { universitySystem } from './processIncomingMessage.js';
import { sendNotificationCore } from '#domain/notification/notification.controller.js';
import mongoose from 'mongoose';
import { useDbAuthState } from './whatsapp.auth.js';
import { WaAuth } from '#domain/notification/models/whatsapp.model.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sock;
let isReady = false;
const DEFAULT_COUNTRY_CODE = '234';

// Store conversation context for replies
const conversationContext = new Map();

// ------------------- Notification Functions -------------------
class NotificationManager {
    static async sendWhatsAppNotification(contactName, message, messageData) {
        const notificationId = Date.now().toString();

        // Store context for reply
        conversationContext.set(notificationId, {
            remoteJid: messageData.key.remoteJid,
            contactName: contactName,
            originalMessage: message,
            timestamp: Date.now()
        });

        // Clean up old contexts (older than 1 hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [id, context] of conversationContext.entries()) {
            if (context.timestamp < oneHourAgo) {
                conversationContext.delete(id);
            }
        }

        // Send notification with actions
        try {
            // Method 1: Using node-notifier (supports actions on Linux)
            notifier.notify({
                title: `WhatsApp - ${contactName}`,
                message: message.length > 100 ? message.substring(0, 100) + '...' : message,
                icon: path.join(__dirname, 'whatsapp-icon.png'), // Optional: add a WhatsApp icon
                timeout: 10, // Wait for user action
                actions: ['Reply', 'Mark as Read', 'Ignore'],
                sound: true,
                // Custom identifier for tracking
                id: notificationId
            });

            // Method 2: Fallback to notify-send (for systems without node-notifier actions)
            this.sendSystemNotification(contactName, message, notificationId);

        } catch (error) {
            console.error('Notification error:', error);
            // Fallback to basic system notification
            this.sendSystemNotification(contactName, message, notificationId);
        }

        // Handle notification interactions
        this.setupNotificationHandlers(notificationId);
    }

    static setupNotificationHandlers(notificationId) {
        // Handle clicks and actions from node-notifier
        notifier.on('click', (notification, options) => {
            if (options.id === notificationId) {
                this.handleNotificationAction('click', notificationId);
            }
        });

        notifier.on('timeout', (notification, options) => {
            if (options.id === notificationId) {
                this.handleNotificationAction('timeout', notificationId);
            }
        });

        // Note: Action handling varies by system. On some Linux systems,
        // you might need to use DBus for proper action handling
    }

    static handleNotificationAction(action, notificationId) {
        const context = conversationContext.get(notificationId);
        if (!context) return;

        console.log(`Notification ${action} for message from ${context.contactName}`);

        if (action === 'Reply') {
            this.promptForReply(context);
        }
    }

    static promptForReply(context) {
        // This is a simplified approach. For a better solution, you might want to:
        // 1. Create a simple GUI input dialog
        // 2. Use a terminal input prompt
        // 3. Integrate with a desktop environment's native reply feature

        console.log(`\n💬 Replying to ${context.contactName}`);
        console.log(`Original: ${context.originalMessage}`);
        console.log('Type your reply (press Ctrl+C to cancel):');

        // Simple terminal-based reply (you can enhance this with readline)
        process.stdin.once('data', (data) => {
            const reply = data.toString().trim();
            if (reply && sock) {
                this.sendReply(context.remoteJid, reply);
            }
        });
    }

    static async sendReply(remoteJid, replyText) {
        try {
            await sock.sendMessage(remoteJid, { text: replyText });
            console.log(`✅ Reply sent to ${remoteJid}`);

            // Send confirmation notification
            notifier.notify({
                title: 'WhatsApp - Reply Sent',
                message: `Reply sent successfully`,
                timeout: 3
            });
        } catch (error) {
            console.error('Failed to send reply:', error);
            notifier.notify({
                title: 'WhatsApp - Error',
                message: `Failed to send reply: ${error.message}`,
                timeout: 5
            });
        }
    }

    static extractContactName(remoteJid) {
        // Extract phone number from JID
        const phoneNumber = remoteJid.split('@')[0];

        // Try to get contact name from WhatsApp
        // You can enhance this by checking sock.contacts
        return `+${phoneNumber}`;
    }
}

import QRCode from 'qrcode';




// ------------------- Enhanced WhatsApp Client -------------------
export const connectToWhatsApp = async () => {
    // const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { state, saveCreds } = await useDbAuthState();

    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Chrome', 'Linux', '4.0.0'],
        version,
        getMessage: async () => undefined,
    });

    // Save credentials automatically
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'open') {
            console.log('✅ Connection opened successfully!');
            isReady = true;

            // Send welcome notification
            notifier.notify({
                title: 'WhatsApp',
                message: 'Connected to WhatsApp successfully!',
                timeout: 3
            });
        } else if (connection === 'close') {
            isReady = false;
            const statusCode = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode
                : 0;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Connection closed, reconnecting:', shouldReconnect);
            console.log(lastDisconnect.error)
            // Notify about disconnection
            notifier.notify({
                title: 'WhatsApp',
                message: 'Connection lost. Reconnecting...',
                timeout: 5
            });

            if (shouldReconnect) {
                connectToWhatsApp()
            };
        }
        // =========================
        // 📸 QR HANDLING (DB SAFE)
        // =========================
        if (qr) {
            console.log('📸 New QR received');

            try {
                const qrImage = await QRCode.toDataURL(qr);

                await WaAuth.updateOne(
                    { _id: "latest_qr" },
                    {
                        $set: {
                            value: qrImage,
                            updatedAt: new Date()
                        }
                    },
                    { upsert: true }
                );

                sendNotificationCore({
                    target: 'admin',
                    userIds: mongoose.Types.ObjectId('690c70aa423136f152398166'),
                    message: `📸 New QR generated`
                });

            } catch (err) {
                console.error("QR DB error:", err.message);
            }
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (m.type === 'notify' && message && !message.key.fromMe) {
            await processIncomingMessage(message);
        }
    });

    // Handle presence updates to get contact names
    sock.ev.on('contacts.update', (updates) => {
        updates.forEach(update => {
            console.log(`Contact updated: ${update.name} (${update.id})`);
        });
    });
};

// ------------------- Process Incoming Messages -------------------
async function processIncomingMessage(message) {
    await universitySystem.processMessage(message, sock, NotificationManager);
}

function extractMessageText(message) {
    const messageTypes = [
        'conversation',
        'extendedTextMessage',
        'imageMessage',
        'videoMessage',
        'audioMessage',
        'documentMessage'
    ];

    for (const type of messageTypes) {
        if (message.message?.[type]) {
            if (type === 'conversation') {
                return message.message[type];
            } else if (type === 'extendedTextMessage') {
                return message.message[type].text;
            } else if (['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'].includes(type)) {
                const caption = message.message[type].caption;
                return caption || `[${type.replace('Message', '')}]`;
            }
        }
    }

    return `[Unsupported message ${type}]`;
}

// ------------------- Send WhatsApp Message -------------------
export const sendWhatsAppMessage = async (to, message, retries = 3) => {
    if (!sock || !sock.user) throw new AppError('WhatsApp service unavailable');

    // Handle full JID conversion
    if (!to.includes('@')) {
        to = to.replace(/\D/g, '');
        if (to.startsWith('0')) to = DEFAULT_COUNTRY_CODE + to.slice(1);
        to += '@s.whatsapp.net';
    }

    if (!isReady) {
        console.log('⏳ Waiting for WhatsApp socket to be ready...');
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new AppError('Socket not ready in time')), 40000);
            const interval = setInterval(() => {
                if (isReady) {
                    clearTimeout(timeout);
                    clearInterval(interval);
                    resolve();
                }
            }, 500);
        });
        await new Promise(r => setTimeout(r, 2000));
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await sock.sendMessage(to, { text: message });
            console.log(`✅ Message sent to ${to}`);

            // Send notification confirmation
            notifier.notify({
                title: 'WhatsApp',
                message: `Message sent to ${to}`,
                timeout: 3
            });

            return;
        } catch (err) {
            console.warn(`⚠️ Attempt ${attempt} failed: ${err.message}`);
            if (attempt < retries) await new Promise(r => setTimeout(r, 2000 * attempt));
        }
    }

    throw new AppError(`🚫 Failed to send message to ${to} after ${retries} attempts`);
};
if (process.env.PROCESS_TYPE === 'worker') {
    console.log('[whatsapp] Worker detected, starting WhatsApp service...');
    connectToWhatsApp();
} else {
    console.log('[whatsapp] Not a worker process, skipping WhatsApp init.');
}