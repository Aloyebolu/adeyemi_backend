// import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys';
// import { Boom } from '@hapi/boom';
// import pino from 'pino';

// let sock;
// let isReady = false;

// // Adjust this to your default country code
// const DEFAULT_COUNTRY_CODE = '234';

// // ------------------- Connect to WhatsApp -------------------
// export const connectToWhatsApp = async () => {
//     const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
//     const { version } = await fetchLatestBaileysVersion();

//     sock = makeWASocket({
//         auth: state,
//         logger: pino({ level: 'silent' }),
//         browser: ['Chrome', 'Linux', '4.0.0'],
//         version,
//         getMessage: async () => undefined,
//     });

//     // Save credentials automatically
//     sock.ev.on('creds.update', saveCreds);

//     sock.ev.on('connection.update', (update) => {
//         const { connection, lastDisconnect, qr } = update;

//         if (connection === 'open') {
//             console.log('✅ Connection opened successfully!');
//             isReady = true;
//         } else if (connection === 'close') {
//             isReady = false;
//             const statusCode = (lastDisconnect?.error instanceof Boom)
//                 ? lastDisconnect.error.output.statusCode
//                 : 0;
//             const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
//             console.log('⚠️ Connection closed, reconnecting:', shouldReconnect);
//             if (shouldReconnect) connectToWhatsApp();
//         }

//         if (qr) console.log('📸 QR Code received:', qr);
//     });

//     sock.ev.on('messages.upsert', async (m) => {
//         const message = m.messages[0];
//         if (m.type === 'notify' && message && !message.key.fromMe) {
//             const text = message.message?.conversation || '';
//             console.log(`💬 Received message from ${message.key.remoteJid}: ${text}`);
//         }
//     });
// };

// // ------------------- Send WhatsApp Message -------------------
// export const sendWhatsAppMessage = async (to, message, retries = 3) => {
//     if (!sock || !sock.user) throw new AppError('WhatsApp service unavailable');

//     // Handle full JID conversion
//     if (!to.includes('@')) {
//         to = to.replace(/\D/g, ''); // remove non-digit characters
//         if (to.startsWith('0')) to = DEFAULT_COUNTRY_CODE + to.slice(1);
//         to += '@s.whatsapp.net';
//     }

//     // Wait until socket is ready
//     if (!isReady) {
//         console.log('⏳ Waiting for WhatsApp socket to be ready...');
//         await new Promise((resolve, reject) => {
//             const timeout = setTimeout(() => reject(new AppError('Socket not ready in time')), 40000);
//             const interval = setInterval(() => {
//                 if (isReady) {
//                     clearTimeout(timeout);
//                     clearInterval(interval);
//                     resolve();
//                 }
//             }, 500);
//         });
//         // Small delay to ensure full session sync
//         await new Promise(r => setTimeout(r, 2000));
//     }

//     // Retry with exponential backoff
//     for (let attempt = 1; attempt <= retries; attempt++) {
//         try {
//             await sock.sendMessage(to, { text: message });
//             console.log(`✅ Message sent to ${to}`);
//             return;
//         } catch (err) {
//             console.warn(`⚠️ Attempt ${attempt} failed: ${err.message}`);
//             if (attempt < retries) await new Promise(r => setTimeout(r, 2000 * attempt)); // backoff
//         }
//     }

//     throw new AppError(`🚫 Failed to send message to ${to} after ${retries} attempts`);
// };

// // ------------------- Initialize -------------------
// connectToWhatsApp();


import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { exec } from 'child_process';
import notifier from 'node-notifier';
import path from 'path';
import { fileURLToPath } from 'url';
import AppError from '../../../errors/AppError.js';


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

    static sendSystemNotification(contactName, message, notificationId) {
        const cleanMessage = message.replace(/"/g, '\\"');
        const command = `notify-send "WhatsApp - ${contactName}" "${cleanMessage}" -u normal -t 10000`;

        exec(command, (error) => {
            if (error) {
                console.error('System notification failed:', error);
            }
        });
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

// Add this function to generate terminal QR code
async function displayQRCodeInTerminal(qrCodeData) {
    try {
        // Generate QR code as ASCII for terminal
        const terminalQR = await QRCode.toString(qrCodeData, { type: 'terminal', width: 6 });
        console.log('\n📱 SCAN THIS QR CODE WITH WHATSAPP:\n');
        console.log(terminalQR);
        console.log('\n⚠️  QR code expires in 60 seconds!\n');

        // Also save as image file
        const qrImagePath = path.join("/home/breakthrough/Pictures", 'whatsapp-qr.png');
        await QRCode.toFile(qrImagePath, qrCodeData);
        console.log(`📸 QR Code also saved to: ${qrImagePath}`);

        // Send system notification with file path
        notifier.notify({
            title: 'WhatsApp QR Code',
            message: `QR code generated! Open ${qrImagePath} to scan`,
            timeout: 10
        });
    } catch (err) {
        console.error('QR Generation Error:', err);
    }
}




// ------------------- Enhanced WhatsApp Client -------------------
export const connectToWhatsApp = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
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

    // Update your connection.update handler
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'open') {
            console.log('✅ Connection opened successfully!');
            isReady = true;
            notifier.notify({
                title: 'WhatsApp',
                message: 'Connected to WhatsApp successfully!',
                timeout: 3
            });
            setInterval(() => {
                // sendWhatsAppMessage('09114313756', meaningfulMessages[Math.floor(Math.random() * meaningfulMessages.length)]);
            }, 1000000);
        } else if (connection === 'close') {
            isReady = false;
            const statusCode = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode
                : 0;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Connection closed, reconnecting:', shouldReconnect);

            notifier.notify({
                title: 'WhatsApp',
                message: 'Connection lost. Reconnecting...',
                timeout: 5
            });

            // if (shouldReconnect) {
            setTimeout(() => connectToWhatsApp(), 100000);
            // }
        }

        if (qr) {
            sendNotificationCore({ target: 'admin', userIds: mongoose.Types.ObjectId('690c70aa423136f152398166'), message: `📸 QR Code received: ${qr}  \nMake use of it before it expires` })
            console.log('📸 QR Code received:', qr);
            displayQRCodeInTerminal(qr); // Display QR code properly
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

// ------------------- CLI Interface for Replies -------------------
import readline from 'readline';
import { universitySystem } from './processIncomingMessage.js';
import { sendNotificationCore } from '../../notification.controller.js';
import mongoose from 'mongoose';

function setupCLIInterface() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('\n🤖 WhatsApp Linux Notifier Started');
    console.log('Type "quit" to exit\n');

    rl.on('line', (input) => {
        if (input.toLowerCase() === 'quit') {
            console.log('Goodbye! 👋');
            process.exit(0);
        }
    });
}

// ------------------- Initialize -------------------
if (process.env.PROCESS_TYPE == 'worker') {
    connectToWhatsApp();
    setupCLIInterface();
}else{
    console.log('[whatsapp] Not worker! Goodbye from whatsap! 👋');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    notifier.notify({
        title: 'WhatsApp',
        message: 'WhatsApp client shutting down',
        timeout: 3
    });
    process.exit(0);
});

const meaningfulMessages = [
    "✨ Aloye Breakthrough: Dear beloved, your only limit is your mind. What you believe shapes what you can achieve. Stop doubting your potential and start trusting your journey. Every great accomplishment started as a thought, then became a word, then transformed into action. Today, choose to believe in yourself because you are capable of amazing things. The universe is waiting for you to take that bold step. Remember, faith without action is empty. So arise and shine, for your light has come! Your breakthrough is closer than you think. Keep pushing, keep believing, keep striving. You were born for such a time as this. Don't let fear hold you back from your destiny. ✨",

    "🌟 Aloye Breakthrough: Listen carefully, small progress is still progress. Never despise the days of small beginnings because every giant tree started as a tiny seed. You may not be where you want to be yet, but celebrate how far you've come. Each step forward, no matter how tiny, is bringing you closer to your goals. The journey of a thousand miles begins with a single step. Don't compare your chapter 1 to someone else's chapter 20. Keep watering your seed with consistency, patience, and hard work. Your harvest season is approaching. Just don't give up before the miracle happens. Keep pushing forward with everything you've got! 🌟",

    "💪 Aloye Breakthrough: I need you to understand this truth today - You are stronger than you think, braver than you feel, and smarter than you know. Life will throw challenges your way, but those challenges are not there to stop you. They are there to strengthen you, build your character, and prepare you for greater heights. Every storm you survive makes you more resilient. Every fall you recover from teaches you how to rise again. Don't let temporary struggles define your permanent destiny. You have survived 100% of your worst days so far. That's proof that you are unstoppable. Keep fighting, keep believing, keep winning! 💪",

    "🎯 Aloye Breakthrough: Here's a powerful reminder - Don't wait for opportunity to knock on your door. Create your own opportunity! Stop sitting around hoping for things to change. Take action today. The difference between dreams and achievements is action. Successful people don't wait for the perfect moment. They create it through hard work, determination, and relentless effort. What can you do today, right now, to move closer to your goals? Don't overthink it. Don't wait until Monday, next month, or next year. Start where you are, use what you have, and do what you can. Your future self will thank you for starting today. Go get it! 🎯",

    "🔥 Aloye Breakthrough: Wake up to reality! The future depends entirely on what you do TODAY. Not yesterday, not tomorrow, but right now in this present moment. Every single day is a gift filled with opportunities. The choices you make today shape the story you will tell tomorrow. Don't waste your precious time on things that don't matter. Focus your energy on activities that align with your purpose and vision. Stop procrastinating. Stop making excuses. Stop waiting for conditions to be perfect. Conditions are never perfect. Successful people take imperfect action and adjust along the way. Make today count because you will never get it back. 🔥",

    "🌈 Aloye Breakthrough: Listen to this wisdom - Every expert was once a beginner who refused to give up. The people you admire today, the successful ones, the accomplished ones, they all started exactly where you are now. Confused. Uncertain. Afraid. But they kept going despite the fear. They made mistakes. They failed forward. They learned from every setback and used it as a setup for a greater comeback. You don't have to be perfect. You just have to be persistent. Keep learning, keep growing, keep improving by just 1% every day. That's how champions are made. Your breakthrough is in the consistency. Keep going! 🌈",

    "⭐ Aloye Breakthrough: Pay attention to this truth - Your attitude determines your direction in life. Two people can face the exact same situation and have completely different outcomes based solely on their attitude. One sees a problem, the other sees an opportunity. One sees failure, the other sees a lesson. One sees the end, the other sees a new beginning. Choose today to cultivate a positive, grateful, resilient attitude. It won't change your circumstances overnight, but it will change how you respond to them. And your response determines your results. Stay positive, stay hopeful, stay faithful. Your breakthrough is coming! ⭐",

    "🌱 Aloye Breakthrough: Here's a growth secret - Real growth happens outside your comfort zone. The moment you feel comfortable, you've stopped growing. Challenge yourself daily. Do something that scares you. Take risks. Try new things. Learn new skills. Your comfort zone is a beautiful place, but nothing ever grows there. The magic of life happens in the stretch zone where you feel uncertain, nervous, and excited all at once. That's where strength is built. That's where character is formed. That's where breakthroughs occur. So today, I dare you to take the leap. Step out. Trust yourself. Your greatest life is waiting on the other side of fear. 🌱",

    "💎 Aloye Breakthrough: Remember this always - Success is not final, failure is not fatal. What matters most is the courage to continue. You will have wins and you will have losses. That's part of the human experience. Don't let success go to your head, and don't let failure go to your heart. Stay humble in victory and strong in defeat. Keep your eyes on the bigger picture. One bad chapter doesn't mean your story is over. One closed door doesn't mean all doors are closed. Keep showing up, keep trying, keep believing. Your persistence will pay off. The only way to truly fail is to stop trying. So continue! 💎",

    "🚀 Aloye Breakthrough: I declare over you today - Dream it. Believe it. Achieve it. Nothing is impossible for those who put their trust in God and take action. Your dreams are not accidents. They were placed in your heart for a reason. Don't let anyone talk you out of what God has placed inside you. People will doubt you. People will criticize you. People will tell you it's impossible. But what do they know? They are not living your life. They are not carrying your purpose. Trust your instincts. Trust your journey. Trust the process. If God brought you to it, He will bring you through it. Keep pursuing your dreams with everything you've got! 🚀",

    "🌊 Aloye Breakthrough: Learn this survival skill - You cannot calm the storm, but you can learn to dance in the rain. Life will bring challenges that you cannot control. You cannot control the weather, the economy, what people say about you, or how others behave. But you can control your response. You can choose joy despite the circumstances. You can choose peace despite the chaos. You can choose faith despite the fear. Don't waste your energy trying to control what you cannot change. Instead, focus your energy on how you respond. That's where your power lies. Dance through the rain and watch the storm lose its power over you. 🌊",

    "🏆 Aloye Breakthrough: Never forget this principle - The harder you work for something, the greater you will feel when you achieve it. There are no shortcuts to meaningful success. Anything worth having requires sacrifice, discipline, and consistent effort. Don't look for easy paths or quick riches. They lead to empty places. Embrace the struggle. Love the grind. Appreciate the process of becoming. Every late night, every early morning, every moment you chose work over comfort is building something beautiful. When you finally reach your goal, you'll look back and realize that the journey was the real reward. Keep working hard. Your trophy is waiting! 🏆",

    "🦋 Aloye Breakthrough: Transform your thinking - Your present circumstances do not determine where you can go. They merely determine where you start. Just because you're in a difficult situation right now doesn't mean you'll be there forever. Your current reality is not your final destination. You have the power to change, to grow, to transform. Like a caterpillar that becomes a butterfly, you too can experience a complete metamorphosis. Don't let your past define your future. Don't let your present discourage your potential. You are one decision away from a completely different life. Choose wisely today. Choose change. Choose growth. Choose your breakthrough! 🦋",

    "💡 Aloye Breakthrough: Wise counsel for you - Don't count the days, make the days count. Every single moment matters more than you realize. Time is the most precious resource you have because once it's gone, you can never get it back. Are you spending your days on things that truly matter? Are you investing your time in people, activities, and goals that align with your purpose? Or are you just passing time, waiting for something to happen? Stop waiting and start living. Make today so awesome that yesterday gets jealous. Fill each moment with intention, purpose, and gratitude. Your time is now. Use it wisely! 💡",

    "🌞 Aloye Breakthrough: Daily encouragement - Rise up, start fresh, and see the bright opportunity in each new day. Every morning you wake up is a second chance. A chance to try again, to do better, to be better. Yesterday's mistakes don't have to ruin today's possibilities. Let go of regret. Release the past. Forgive yourself and others. Walk into this day with a clean slate and a hopeful heart. Look for the good. Expect miracles. Believe that something wonderful is about to happen to you. Your attitude of expectancy will attract positive outcomes. This day is full of potential. Go out there and seize it with both hands! 🌞",

    "🎨 Aloye Breakthrough: Powerful realization - You have within you, right now, everything you need to deal with whatever the world throws at you. Stop looking outside yourself for validation, strength, or answers. The power you need is already inside you. You have survived every challenge that has come your way so far. That means you are equipped for whatever comes next. Trust your inner wisdom. Listen to your intuition. Believe in your capabilities. You are more resourceful, creative, and resilient than you give yourself credit for. Don't let insecurity or self-doubt convince you otherwise. Stand tall. You've got this. You've always had it. Keep moving forward! 🎨",

    "⚡ Aloye Breakthrough: Urgent message - The secret of getting ahead is getting started. Take that first step TODAY! Many people fail not because they lack ability, but because they never begin. They overthink. They overplan. They wait for perfect conditions that never arrive. Don't fall into that trap. You don't need to see the entire staircase to take the first step. You don't need to have everything figured out to start moving. Faith requires action. Dreams require movement. Success requires momentum. And momentum starts with a single, sometimes imperfect, step. Don't let fear of failure stop you from ever starting. Just begin. Adjust as you go. You'll figure it out along the way. ⚡",

    "💖 Aloye Breakthrough: Deep truth - What you get by achieving your goals is not as important as what you become by achieving them. The external rewards are nice - money, recognition, possessions. But they fade. What lasts is the person you become in the process. The discipline you develop. The strength you build. The character you form. The wisdom you gain. These internal transformations are priceless. They stay with you forever and benefit every area of your life. So don't focus solely on the destination. Fall in love with the journey of becoming. Who are you becoming as you chase your dreams? Make sure it's someone you're proud of. 💖",

    "🌙 Aloye Breakthrough: Nighttime reflection - Stars can't shine without darkness. Your struggles are shaping your strength. The most beautiful diamonds are created under extreme pressure. The strongest trees are those that have weathered the fiercest storms. Your current challenges are not punishments. They are preparations. They are building something in you that you cannot see yet. Something that will be revealed when the time is right. So don't curse the darkness. It's the backdrop that makes your light visible. Keep shining. Keep growing. Keep trusting that every struggle is serving a greater purpose. Your best days are still ahead, not behind. Sleep well knowing that tomorrow holds promise! 🌙",

    "🎉 Aloye Breakthrough: Celebration reminder - Celebrate every tiny victory. Small wins lead to big success! Too often we wait until we reach the final goal before we celebrate. But that's a mistake. The journey is long, and without celebration, you will lose motivation. Did you complete a small task today? Celebrate! Did you make progress on a difficult project? Celebrate! Did you simply show up when you wanted to give up? Celebrate! These small celebrations release dopamine and keep you motivated. They remind you that you are moving forward. They make the journey enjoyable instead of exhausting. So find reasons to celebrate every single day. Your future self will thank you for it. Keep winning! 🎉"
];
