import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import { WaAuth, SessionStatus } from '#domain/notification/models/whatsapp.model.js';

const collection = WaAuth;

// =========================
// 💾 DB SERIALIZATION
// =========================
const toDb = (val) =>
    JSON.parse(JSON.stringify(val, BufferJSON.replacer));

const fromDb = (val) =>
    val ? JSON.parse(JSON.stringify(val), BufferJSON.reviver) : val;

// =========================
// 🔐 AUTH STATE
// =========================
export const useDbAuthState = async (sessionId = 'default') => {
    const credsDoc = await collection.findOne({ _id: `creds:${sessionId}` });

    const creds = credsDoc?.value
        ? fromDb(credsDoc.value)
        : initAuthCreds();

    const keys = {
        get: async (type, ids) => {
            const data = {};

            for (const id of ids) {
                const doc = await collection.findOne({ 
                    _id: `key:${sessionId}:${type}:${id}` 
                });

                if (doc?.value) {
                    data[id] = fromDb(doc.value);
                }
            }

            return data;
        },

        set: async (data) => {
            for (const type in data) {
                for (const id in data[type]) {
                    await collection.updateOne(
                        { _id: `key:${sessionId}:${type}:${id}` },
                        { $set: { value: toDb(data[type][id]) } },
                        { upsert: true }
                    );
                }
            }
        }
    };

    const saveCreds = async () => {
        await collection.updateOne(
            { _id: `creds:${sessionId}` },
            { $set: { value: toDb(creds) } },
            { upsert: true }
        );
    };

    return { state: { creds, keys }, saveCreds };
};

// =========================
// 🎯 SESSION MANAGER
// =========================
export class WhatsAppSessionManager {
    constructor(sessionId = 'default') {
        this.sessionId = sessionId;
    }

    async logEvent(action, metadata = {}) {
        const { LoginHistory } = await import('../../models/whatsapp.model.js');
        return await LoginHistory.create({
            sessionId: this.sessionId,
            action,
            metadata,
            timestamp: new Date()
        });
    }

    async updateConnectionStatus(status, metadata = {}) {
        const update = {
            connectionStatus: status,
            lastActive: new Date(),
            ...(metadata.phoneNumber && { phoneNumber: metadata.phoneNumber }),
            ...(metadata.deviceInfo && { deviceInfo: metadata.deviceInfo })
        };

        if (status === 'connected') {
            update.isActive = true;
        } else if (status === 'disconnected' || status === 'error') {
            update.isActive = false;
        } else if (status === 'paused') {
            update.isPaused = true;
            update.isActive = false;
        }

        return await SessionStatus.findOneAndUpdate(
            { sessionId: this.sessionId },
            { $set: update },
            { upsert: true, new: true }
        );
    }

    async getSessionStatus() {
        return await SessionStatus.findOne({ sessionId: this.sessionId });
    }

    async clearSession() {
        await collection.deleteMany({ 
            _id: { $regex: `^(creds|key):${this.sessionId}` } 
        });
        await SessionStatus.deleteOne({ sessionId: this.sessionId });
    }
}