import makeWASocket, {
    fetchLatestBaileysVersion,
    DisconnectReason,
    makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import notifier from 'node-notifier';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import AppError from '#shared/errors/AppError.js';
import { universitySystem } from './processIncomingMessage.js';
import { sendNotificationCore } from '#domain/notification/notification.controller.js';
import mongoose from 'mongoose';
import { useDbAuthState, WhatsAppSessionManager } from './whatsapp.auth.js';
import {
    WaAuth,
    SessionStatus,
    LoginHistory,
    WorkerHeartbeat,
    WorkerCommand
} from '#domain/notification/models/whatsapp.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_COUNTRY_CODE = '234';
const HEARTBEAT_INTERVAL = 10000; // 10 seconds
const HEARTBEAT_TIMEOUT = 30000; // 30 seconds

// Store conversation context for replies (worker only)
const conversationContext = new Map();

// =========================
// 📱 NOTIFICATION MANAGER (Worker Only)
// =========================
class NotificationManager {
    static async sendWhatsAppNotification(contactName, message, messageData, sock) {
        const notificationId = Date.now().toString();

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

        try {
            notifier.notify({
                title: `WhatsApp - ${contactName}`,
                message: message.length > 100 ? message.substring(0, 100) + '...' : message,
                icon: path.join(__dirname, 'whatsapp-icon.png'),
                timeout: 10,
                actions: ['Reply', 'Mark as Read', 'Ignore'],
                sound: true,
                id: notificationId
            });

            this.sendSystemNotification(contactName, message, notificationId);
        } catch (error) {
            console.error('Notification error:', error);
            this.sendSystemNotification(contactName, message, notificationId);
        }

        this.setupNotificationHandlers(notificationId, sock);
    }

    static sendSystemNotification(contactName, message, notificationId) {
        try {
            exec(`notify-send "WhatsApp - ${contactName}" "${message}" -i whatsapp -t 10000`);
        } catch (error) {
            console.error('System notification failed:', error);
        }
    }

    static setupNotificationHandlers(notificationId, sock) {
        notifier.on('click', (notification, options) => {
            if (options.id === notificationId) {
                this.handleNotificationAction('click', notificationId, sock);
            }
        });

        notifier.on('timeout', (notification, options) => {
            if (options.id === notificationId) {
                this.handleNotificationAction('timeout', notificationId, sock);
            }
        });
    }

    static handleNotificationAction(action, notificationId, sock) {
        const context = conversationContext.get(notificationId);
        if (!context) return;

        console.log(`Notification ${action} for message from ${context.contactName}`);

        if (action === 'Reply') {
            this.promptForReply(context, sock);
        }
    }

    static promptForReply(context, sock) {
        console.log(`\n💬 Replying to ${context.contactName}`);
        console.log(`Original: ${context.originalMessage}`);
        console.log('Type your reply (press Ctrl+C to cancel):');

        process.stdin.once('data', async (data) => {
            const reply = data.toString().trim();
            if (reply && sock) {
                await this.sendReply(context.remoteJid, reply, sock);
            }
        });
    }

    static async sendReply(remoteJid, replyText, sock) {
        try {
            await sock.sendMessage(remoteJid, { text: replyText });
            console.log(`✅ Reply sent to ${remoteJid}`);

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

// =========================
// 🔧 WORKER SERVICE (Runs only in worker process)
// =========================
export class WhatsAppWorkerService {
    constructor(workerId) {
        this.workerId = workerId;
        this.sockets = new Map();
        this.sessionManagers = new Map();
        this.heartbeatInterval = null;
        this.commandCheckInterval = null;
        this.isPaused = false;
    }

    async start() {
        console.log(`[WhatsApp Worker] Starting worker ${this.workerId}`);

        // Register worker
        await WorkerHeartbeat.findOneAndUpdate(
            { workerId: this.workerId },
            {
                $set: {
                    status: 'online',
                    lastHeartbeat: new Date(),
                    sessionId: 'default'
                }
            },
            { upsert: true }
        );

        // Start heartbeat
        this.startHeartbeat();

        // Start command listener
        this.startCommandListener();

        // Initialize default session
        await this.initializeSession('default');
    }


    startHeartbeat() {
        this.heartbeatInterval = setInterval(async () => {
            try {
                const sessionStatus = await SessionStatus.findOne({ sessionId: 'default' });

                // Get detailed status for heartbeat metadata
                const detailedStatus = await this.getStatus();

                await WorkerHeartbeat.findOneAndUpdate(
                    { workerId: this.workerId },
                    {
                        $set: {
                            lastHeartbeat: new Date(),
                            status: this.isPaused ? 'paused' : 'online',
                            metadata: {
                                isPaused: this.isPaused,
                                connectionStatus: sessionStatus?.connectionStatus,
                                phoneNumber: sessionStatus?.phoneNumber,
                                totalSessions: detailedStatus.totalSessions,
                                connectedSessions: detailedStatus.connectedSessions,
                                memory: detailedStatus.memory,
                                uptime: detailedStatus.uptime
                            }
                        }
                    },
                    { upsert: true }
                );
            } catch (error) {
                console.error('[WhatsApp Worker] Heartbeat error:', error);
            }
        }, HEARTBEAT_INTERVAL);
    }

    startCommandListener() {
        this.commandCheckInterval = setInterval(async () => {
            try {
                const commands = await WorkerCommand.find({
                    workerId: this.workerId,
                    status: 'pending'
                }).sort({ requestedAt: 1 });

                for (const command of commands) {
                    await this.processCommand(command);
                }
            } catch (error) {
                console.error('[WhatsApp Worker] Command check error:', error);
            }
        }, 5000);
    }

    async processCommand(command) {
        console.log(`[WhatsApp Worker] Processing command: ${command.command}`);

        try {
            await WorkerCommand.updateOne(
                { _id: command._id },
                { $set: { status: 'processing', processedAt: new Date() } }
            );

            let result;
            switch (command.command) {
                case 'pause':
                    result = await this.pause();
                    break;
                case 'resume':
                    result = await this.resume();
                    break;
                case 'restart':
                    result = await this.restart();
                    break;
                case 'logout':
                    result = await this.logout(command.sessionId);
                    break;
                case 'reconnect':
                    result = await this.reconnect(command.sessionId);
                    break;
            }

            await WorkerCommand.updateOne(
                { _id: command._id },
                { $set: { status: 'completed', result } }
            );

            // Log the command execution
            const sessionManager = new WhatsAppSessionManager(command.sessionId);
            await sessionManager.logEvent(command.command, { result });

        } catch (error) {
            console.error(`[WhatsApp Worker] Command failed:`, error);
            await WorkerCommand.updateOne(
                { _id: command._id },
                { $set: { status: 'failed', error: error.message } }
            );
        }
    }

    async pause() {
        console.log('[WhatsApp Worker] Pausing operations');
        this.isPaused = true;

        const sessionManager = new WhatsAppSessionManager('default');
        await sessionManager.updateConnectionStatus('paused');

        return { paused: true };
    }

    async resume() {
        console.log('[WhatsApp Worker] Resuming operations');
        this.isPaused = false;

        const sessionManager = new WhatsAppSessionManager('default');
        await sessionManager.updateConnectionStatus('connected');

        return { resumed: true };
    }

    async restart() {
        console.log('[WhatsApp Worker] Restarting');
        await this.cleanup();
        await this.start();
        return { restarted: true };
    }

    async initializeSession(sessionId) {
        const sessionManager = new WhatsAppSessionManager(sessionId);
        this.sessionManagers.set(sessionId, sessionManager);

        try {
            const { state, saveCreds } = await useDbAuthState(sessionId);
            const { version } = await fetchLatestBaileysVersion();

            const socket = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                browser: ['Chrome', 'Linux', '4.0.0'],
                syncFullHistory: false
            });

            this.sockets.set(sessionId, socket);
            await sessionManager.updateConnectionStatus('connecting');

            this.setupSocketHandlers(socket, sessionId, saveCreds, sessionManager);

            console.log(`[WhatsApp Worker] Session ${sessionId} initialized`);
            return socket;
        } catch (error) {
            await sessionManager.updateConnectionStatus('error', { error: error.message });
            console.error(`[WhatsApp Worker] Failed to initialize session ${sessionId}:`, error);
            throw error;
        }
    }

    setupSocketHandlers(socket, sessionId, saveCreds, sessionManager) {
        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Check if paused
            if (this.isPaused && connection !== 'close') {
                return;
            }

            if (qr) {
                try {
                    const qrBase64 = await QRCode.toDataURL(qr);

                    await WaAuth.updateOne(
                        { _id: `qr:${sessionId}` },
                        { $set: { value: qrBase64, updatedAt: new Date() } },
                        { upsert: true }
                    );

                    await sessionManager.updateConnectionStatus('qr_pending');
                    await sessionManager.logEvent('qr_generated');

                    console.log(`[WhatsApp Worker] New QR generated for session ${sessionId}`);

                    sendNotificationCore({
                        target: 'admin',
                        userIds: mongoose.Types.ObjectId('690c70aa423136f152398166'),
                        message: `📸 New QR generated for session: ${sessionId}`
                    });
                } catch (err) {
                    console.error(`[WhatsApp Worker] QR DB error:`, err.message);
                }
            }

            if (connection === 'open') {
                const user = socket.user;
                await sessionManager.updateConnectionStatus('connected', {
                    phoneNumber: user?.id?.split(':')[0],
                    deviceInfo: user
                });
                await sessionManager.logEvent('login', {
                    phoneNumber: user?.id?.split(':')[0]
                });

                await WaAuth.deleteOne({ _id: `qr:${sessionId}` });

                console.log(`[WhatsApp Worker] Session ${sessionId} connected!`);

                sendNotificationCore({
                    target: 'admin',
                    userIds: mongoose.Types.ObjectId('690c70aa423136f152398166'),
                    message: `✅ WhatsApp session ${sessionId} connected!`
                });
            }

            if (connection === 'close') {
                const shouldReconnect = this.shouldReconnect(lastDisconnect);
                const statusCode = lastDisconnect?.error?.output?.statusCode;

                await sessionManager.updateConnectionStatus('disconnected');
                console.log(`[WhatsApp Worker] Session ${sessionId} disconnected`, lastDisconnect?.error || '');

                notifier.notify({
                    title: 'WhatsApp',
                    message: 'Connection lost. Reconnecting...',
                    timeout: 5
                });

                if (statusCode === DisconnectReason.loggedOut) {
                    await sessionManager.logEvent('logout');
                    await sessionManager.clearSession();
                    this.sockets.delete(sessionId);
                    console.log(`[WhatsApp Worker] Session ${sessionId} logged out`);

                    sendNotificationCore({
                        target: 'admin',
                        userIds: mongoose.Types.ObjectId('690c70aa423136f152398166'),
                        message: `⚠️ WhatsApp session ${sessionId} logged out`
                    });
                } else if (shouldReconnect && !this.isPaused) {
                    await sessionManager.logEvent('reconnected');
                    console.log(`[WhatsApp Worker] Reconnecting session ${sessionId}...`);
                    setTimeout(() => this.initializeSession(sessionId), 10000);
                }
            }
        });

        socket.ev.on('creds.update', saveCreds);

        socket.ev.on('messages.upsert', async (m) => {
            if (this.isPaused) return;

            const message = m.messages[0];
            if (m.type === 'notify' && message && !message.key.fromMe) {
                await this.processIncomingMessage(message, sessionId, socket);
            }
        });

        socket.ev.on('contacts.update', (updates) => {
            updates.forEach(update => {
                console.log(`Contact updated: ${update.name} (${update.id})`);
            });
        });
    }

    shouldReconnect(lastDisconnect) {
        if (!lastDisconnect) return true;
        const statusCode = lastDisconnect.error?.output?.statusCode;
        return statusCode !== DisconnectReason.loggedOut;
    }

    async processIncomingMessage(message, sessionId, socket) {
        try {
            await universitySystem.processMessage(message, socket, {
                ...NotificationManager,
                sendWhatsAppNotification: (contactName, msg, msgData) =>
                    NotificationManager.sendWhatsAppNotification(contactName, msg, msgData, socket)
            });
        } catch (error) {
            console.error(`[WhatsApp Worker] Error processing message:`, error);
        }
    }

    async sendMessage(to, message) {
        if(!to || !message) {
            throw new AppError('Recipient and message are required', 400);
        }
        
        const socket = this.sockets.get('default');
        if (!socket || !socket.user) {
            throw new AppError('WhatsApp not connected');
        }

        if (!to?.includes('@')) {
            to = to.replace(/\D/g, '');
            if (to.startsWith('0')) to = DEFAULT_COUNTRY_CODE + to.slice(1);
            to += '@s.whatsapp.net';
        }

        try {
            await socket.sendMessage(to, { text: message });
            console.log(`[WhatsApp Worker] Message sent to ${to}`);
            return true;
        } catch (error) {
            console.error(`[WhatsApp Worker] Failed to send message:`, error);
            throw new AppError(`Failed to send message: ${error.message}`);
        }
    }

    async logout(sessionId) {
        const socket = this.sockets.get(sessionId);
        const sessionManager = new WhatsAppSessionManager(sessionId);

        if (socket) {
            await socket.logout();
            this.sockets.delete(sessionId);
        }

        await sessionManager.clearSession();
        await sessionManager.logEvent('logout');
        return { loggedOut: true };
    }

    async reconnect(sessionId) {
        await this.logout(sessionId);
        await this.initializeSession(sessionId);
        return { reconnected: true };
    }

    async cleanup() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (this.commandCheckInterval) clearInterval(this.commandCheckInterval);

        for (const [sessionId, socket] of this.sockets) {
            try {
                await socket.logout();
            } catch (error) {
                console.error(`Error logging out session ${sessionId}:`, error);
            }
        }

        this.sockets.clear();
        this.sessionManagers.clear();
    }
    // Inside the WhatsAppWorkerService class, add this method:

    /**
     * Get detailed status of the worker and all sessions
     * @returns {Object} Worker status information
     */
    async getStatus() {
        const sessions = [];

        for (const [sessionId, socket] of this.sockets) {
            const sessionManager = this.sessionManagers.get(sessionId);
            const sessionStatus = await SessionStatus.findOne({ sessionId });

            let connectionStatus = 'unknown';
            let isConnected = false;
            let user = null;

            if (socket) {
                isConnected = !!socket.user;
                user = socket.user;

                // Determine connection state
                if (socket.user) {
                    connectionStatus = 'connected';
                } else if (socket.authState?.creds?.registered) {
                    connectionStatus = 'registered';
                } else {
                    connectionStatus = 'connecting';
                }
            }

            // Check if QR is available
            const qrDoc = await WaAuth.findOne({ _id: `qr:${sessionId}` });
            const hasQR = !!qrDoc;
            const qrExpiry = qrDoc?.updatedAt || qrDoc?.createdAt;

            sessions.push({
                sessionId,
                connectionStatus,
                isConnected,
                isPaused: this.isPaused,
                phoneNumber: user?.id?.split(':')[0] || sessionStatus?.phoneNumber || null,
                deviceInfo: user ? {
                    platform: user?.platform,
                    device: user?.device,
                    browser: user?.browser
                } : null,
                hasQR,
                qrExpiry: qrExpiry ? new Date(qrExpiry).toISOString() : null,
                qrValid: qrExpiry ? (Date.now() - new Date(qrExpiry).getTime()) < 60000 : false,
                lastActive: sessionStatus?.lastActive || null,
                uptime: sessionStatus?.connectedAt ?
                    Math.floor((Date.now() - new Date(sessionStatus.connectedAt).getTime()) / 1000) : 0
            });
        }

        return {
            workerId: this.workerId,
            isPaused: this.isPaused,
            totalSessions: this.sockets.size,
            connectedSessions: Array.from(this.sockets.values()).filter(s => !!s.user).length,
            sessions,
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
    }
}

// =========================
// 🌐 MAIN WHATSAPP SERVICE (API + Worker coordination)
// =========================
class WhatsAppService {
    constructor() {
        this.workerService = null;
        this.isWorker = process.env.PROCESS_TYPE === 'worker';

        if (this.isWorker) {
            const workerId = process.env.WORKER_ID;
            this.workerService = new WhatsAppWorkerService(workerId);
            this.workerService.start();
            console.log(`[WhatsApp] Worker mode activated with ID: ${workerId}`);
        } else {
            console.log('[WhatsApp] API Server mode activated');
        }
    }

    // =========================
    // 📊 MONITORING METHODS (Available in both modes)
    // =========================

    async getWorkerStatus() {
        const heartbeats = await WorkerHeartbeat.find().sort({ lastHeartbeat: -1 });

        return heartbeats.map(hb => {
            const isOnline = (Date.now() - new Date(hb.lastHeartbeat).getTime()) < HEARTBEAT_TIMEOUT;
            return {
                workerId: hb.workerId,
                sessionId: hb.sessionId,
                status: isOnline ? hb.status : 'offline',
                lastHeartbeat: hb.lastHeartbeat,
                isOnline,
                metadata: hb.metadata
            };
        });
    }

    async getQRCode(sessionId = 'default') {
        const doc = await WaAuth.findOne({ _id: `qr:${sessionId}` });
        if (doc?.value) {
            const createdAt = doc.updatedAt || doc.createdAt;
            const now = Date.now();
            const ONE_MINUTE = 60 * 1000;

            if (!createdAt || now - new Date(createdAt).getTime() > ONE_MINUTE) {
                return null;
            }

            return doc.value;
        }
        return null;
    }

    async getSessionInfo(sessionId = 'default') {
        const sessionManager = new WhatsAppSessionManager(sessionId);
        const status = await sessionManager.getSessionStatus();
        const history = await LoginHistory.find({ sessionId })
            .sort({ timestamp: -1 })
            .limit(10);

        const workers = await this.getWorkerStatus();
        const activeWorker = workers.find(w => w.sessionId === sessionId && w.isOnline);

        return {
            sessionId,
            status: status?.connectionStatus || 'unknown',
            isActive: status?.isActive || false,
            isPaused: status?.isPaused || false,
            phoneNumber: status?.phoneNumber,
            lastActive: status?.lastActive,
            recentHistory: history,
            worker: activeWorker || null,
            hasActiveWorker: !!activeWorker
        };
    }

    async getAllSessions() {
        const sessions = await SessionStatus.find().sort({ lastActive: -1 });
        const workers = await this.getWorkerStatus();

        return sessions.map(session => {
            const worker = workers.find(w => w.sessionId === session.sessionId);
            return {
                ...session.toObject(),
                worker: worker || null,
                hasActiveWorker: !!worker
            };
        });
    }

    async getLoginHistory(sessionId = 'default', limit = 50) {
        return await LoginHistory.find({ sessionId })
            .sort({ timestamp: -1 })
            .limit(limit);
    }

    async healthCheck(sessionId = 'default') {
        const sessionInfo = await this.getSessionInfo(sessionId);
        const workers = await this.getWorkerStatus();

        return {
            sessionId,
            mode: this.isWorker ? 'worker' : 'server',
            session: sessionInfo,
            workers: workers,
            timestamp: new Date().toISOString()
        };
    }

    // =========================
    // 🎮 CONTROL METHODS (Available in both modes, some forwarded to worker)
    // =========================

    async sendCommand(sessionId, command, requestedBy = 'api') {
        const workers = await this.getWorkerStatus();
        const activeWorker = workers.find(w => w.sessionId === sessionId && w.isOnline);

        if (!activeWorker) {
            throw new AppError(`No active worker found for session ${sessionId}`, 503);
        }

        const workerCommand = await WorkerCommand.create({
            workerId: activeWorker.workerId,
            sessionId,
            command,
            requestedBy,
            status: 'pending'
        });

        // Wait for completion (with timeout)
        const startTime = Date.now();
        const timeout = 30000; // 30 seconds

        while (Date.now() - startTime < timeout) {
            const updated = await WorkerCommand.findById(workerCommand._id);
            if (updated.status === 'completed') {
                return { success: true, result: updated.result };
            }
            if (updated.status === 'failed') {
                throw new AppError(`Command failed: ${updated.error}`, 500);
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        throw new AppError('Command timeout', 504);
    }

    async initializeSession(sessionId = 'default') {
        if (this.isWorker) {
            return await this.workerService.initializeSession(sessionId);
        } else {
            // In server mode, we just return success and let worker handle it
            const sessionManager = new WhatsAppSessionManager(sessionId);
            await sessionManager.updateConnectionStatus('connecting');
            return { initialized: true, sessionId };
        }
    }

    async pauseWorker(sessionId = 'default') {
        return await this.sendCommand(sessionId, 'pause');
    }

    async resumeWorker(sessionId = 'default') {
        return await this.sendCommand(sessionId, 'resume');
    }

    async restartWorker(sessionId = 'default') {
        return await this.sendCommand(sessionId, 'restart');
    }

    async logout(sessionId = 'default') {
        const sessionManager = new WhatsAppSessionManager(sessionId);

        if (this.isWorker) {
            const result = await this.workerService.logout(sessionId);
            await sessionManager.logEvent('logout');
            return result;
        } else {
            // Forward to worker
            return await this.sendCommand(sessionId, 'logout');
        }
    }

    async sendMessage(to, message, sessionId = 'default') {
        // if (this.isWorker) {
        if (true) {
            return await this.workerService.sendMessage(to, message);
        } else {
            // In server mode, message sending is disabled
            throw new AppError('Message sending is only available in worker mode', 403);
        }
    }

    async shutdown() {
        if (this.isWorker && this.workerService) {
            await WorkerHeartbeat.deleteOne({ workerId: this.workerService.workerId });
            await this.workerService.cleanup();
        }
    }
    // Inside the WhatsAppService class, update the getWorkerStatus method:

    async getWorkerStatus() {
        const heartbeats = await WorkerHeartbeat.find().sort({ lastHeartbeat: -1 });

        const workers = heartbeats.map(hb => {
            const isOnline = (Date.now() - new Date(hb.lastHeartbeat).getTime()) < HEARTBEAT_TIMEOUT;
            return {
                workerId: hb.workerId,
                sessionId: hb.sessionId,
                status: isOnline ? hb.status : 'offline',
                lastHeartbeat: hb.lastHeartbeat,
                isOnline,
                metadata: hb.metadata
            };
        });

        // If in worker mode, get detailed status from worker service
        if (this.isWorker && this.workerService) {
            const detailedStatus = await this.workerService.getStatus();

            // Merge with heartbeat data
            return workers.map(w => {
                if (w.workerId === this.workerService.workerId) {
                    return {
                        ...w,
                        detailed: detailedStatus
                    };
                }
                return w;
            });
        }

        return workers;
    }

    /**
     * Get detailed status for a specific worker
     * @param {string} workerId - Worker ID
     * @returns {Object} Worker status
     */
    async getWorkerDetailedStatus(workerId = null) {
        if (this.isWorker) {
            // In worker mode, just return local status
            return await this.workerService.getStatus();
        } else {
            // In server mode, we can only return what's in the database
            const heartbeat = await WorkerHeartbeat.findOne({
                workerId: workerId || { $exists: true }
            }).sort({ lastHeartbeat: -1 });

            if (!heartbeat) {
                return null;
            }

            const isOnline = (Date.now() - new Date(heartbeat.lastHeartbeat).getTime()) < HEARTBEAT_TIMEOUT;

            return {
                workerId: heartbeat.workerId,
                sessionId: heartbeat.sessionId,
                status: isOnline ? heartbeat.status : 'offline',
                lastHeartbeat: heartbeat.lastHeartbeat,
                isOnline,
                metadata: heartbeat.metadata,
                note: 'For detailed session info, query from worker directly or use healthCheck endpoint'
            };
        }
    }
}

// Create singleton instance
const whatsAppService = new WhatsAppService();

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[WhatsApp] SIGTERM received, shutting down...');
    await whatsAppService.shutdown();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[WhatsApp] SIGINT received, shutting down...');
    await whatsAppService.shutdown();
    process.exit(0);
});

export default whatsAppService;

// Legacy exports for backward compatibility
export const connectToWhatsApp = () => whatsAppService.initializeSession('default');
export const sendWhatsAppMessage = (to, message) => whatsAppService.sendMessage(to, message, 'default');