import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { universitySystem } from '../../services/whatsapp/processIncomingMessage.js';
import connectToDB from '../../../../config/db.js';
connectToDB()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mock socket object that mimics the real WhatsApp socket
// In whatsapp-mock-server.js - Updated MockSocket class
class MockSocket {
    constructor(contactId, io, socket) {
        this.contactId = contactId;
        this.io = io;
        this.socket = socket;
        this.user = { id: 'current_user', name: 'Me' };
    }

    async sendMessage(jid, message) {
        console.log(`📤 Mock sending to ${jid}:`, message.text);

        // Create message in WhatsApp format
        const whatsappMessage = {
            key: {
                remoteJid: jid,
                fromMe: true,
                id: `mock_${Date.now()}`
            },
            message: {
                conversation: message.text
            },
            messageTimestamp: Date.now() / 1000,
            status: 'sent'
        };

        // Emit to frontend with consistent event name
        this.socket.emit('whatsapp-message', {  // ← Changed to consistent name
            type: 'incoming',
            to: jid,
            message: message.text,
            timestamp: new Date(),
            fromMe: true,
            messageId: whatsappMessage.key.id
        });

        return whatsappMessage;
    }
}


// Import your processIncomingMessage function
// You need to export this from your original file or copy the logic

// Store active conversations
const activeConversations = new Map();

io.on('connection', (socket) => {
    console.log('📱 Frontend connected:', socket.id);

    // When frontend sends a message (as if from WhatsApp)
    socket.on('whatsapp-message-received', async (data) => {
        const { from, message, messageId } = data;

        console.log(`📨 Received message from ${from}: ${message}`);

        // Create mock message object exactly like WhatsApp format
        const mockWhatsAppMessage = {
            key: {
                remoteJid: `${from}@s.whatsapp.net`,
                fromMe: false,
                id: messageId || `mock_${Date.now()}`
            },
            message: {
                conversation: message
            },
            messageTimestamp: Date.now() / 1000,
            pushName: from.split('@')[0],
            status: 'received'
        };

        // Create or get mock socket for this conversation
        let mockSock = activeConversations.get(from);
        if (!mockSock) {
            mockSock = new MockSocket(from, io, socket);
            activeConversations.set(from, mockSock);
        }

        // Create mock NotificationManager that sends to frontend
        // In the connection handler, update the MockNotificationManager
        const MockNotificationManager = {
            sendWhatsAppNotification: async (contactName, message, messageData) => {
                console.log(`🔔 Notification for ${contactName}: ${message}`);

                // Send to frontend with consistent event name
                socket.emit('whatsapp-notification', {  // ← Specific event for notifications
                    contactName,
                    message,
                    remoteJid: messageData.key.remoteJid,
                    timestamp: new Date()
                });
            },

            sendReply: async (remoteJid, replyText) => {
                console.log(`💬 Reply to ${remoteJid}: ${replyText}`);

                // Send reply back to frontend with consistent event name
                socket.emit('whatsapp-message', {  // ← Same event name as sendMessage
                    type: 'reply',
                    to: remoteJid,
                    message: replyText,
                    timestamp: new Date(),
                    fromMe: true,
                    isReply: true
                });

                // Also send as incoming message to simulate receiving
                socket.emit('whatsapp-message', {  // ← Same event name for incoming too
                    type: 'incoming',
                    from: remoteJid,
                    message: replyText,
                    timestamp: new Date(),
                    fromMe: false,
                    isReply: true
                });
            },

            extractContactName: (remoteJid) => {
                return remoteJid.split('@')[0];
            }
        };


        // Call the original processIncomingMessage function
        try {
            await universitySystem.processMessage(mockWhatsAppMessage, mockSock, MockNotificationManager);
            console.log(`✅ Message processed successfully`);
        } catch (error) {
            console.error(`❌ Error processing message:`, error);
            socket.emit('error', { message: error.message });
        }
    });

    // Simulate sending a message from the mock WhatsApp to a contact
    socket.on('send-whatsapp-message', async (data) => {
        const { to, message } = data;

        // Create mock message as if received from WhatsApp
        const mockMessage = {
            key: {
                remoteJid: to.includes('@') ? to : `${to}@s.whatsapp.net`,
                fromMe: false,
                id: `incoming_${Date.now()}`
            },
            message: {
                conversation: message
            },
            messageTimestamp: Date.now() / 1000,
            pushName: to.split('@')[0]
        };

        let mockSock = activeConversations.get(to);
        if (!mockSock) {
            mockSock = new MockSocket(to, io, socket);
            activeConversations.set(to, mockSock);
        }

        const MockNotificationManager = {
            sendWhatsAppNotification: async (contactName, message, messageData) => {
                socket.emit('notification', {
                    contactName,
                    message,
                    remoteJid: messageData.key.remoteJid
                });
            },
            sendReply: async (remoteJid, replyText) => {
                socket.emit('reply-sent', {
                    to: remoteJid,
                    message: replyText
                });
                socket.emit('new-message', {
                    from: remoteJid,
                    message: replyText
                });
            },
            extractContactName: (remoteJid) => remoteJid.split('@')[0]
        };

        await universitySystem.processMessage(mockMessage, mockSock, MockNotificationManager);
    });

    socket.on('disconnect', () => {
        console.log('📱 Frontend disconnected:', socket.id);
        // Clean up active conversations
        for (const [key, value] of activeConversations.entries()) {
            if (value.socket === socket) {
                activeConversations.delete(key);
            }
        }
    });
});

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Mock WhatsApp Server running on http://localhost:${PORT}`);
    console.log(`📱 Open this URL in your browser to access the WhatsApp-like interface`);
});