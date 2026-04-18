import express from 'express';
import WhatsAppController from '#domain/notification/controllers/whatsapp.controller.js';

const router = express.Router();

// Service Info
router.get('/info', WhatsAppController.getServiceInfo.bind(WhatsAppController));

// Worker Management
router.get('/workers', WhatsAppController.getWorkers.bind(WhatsAppController));
router.post('/worker/pause', WhatsAppController.pauseWorker.bind(WhatsAppController));
router.post('/worker/resume', WhatsAppController.resumeWorker.bind(WhatsAppController));
router.post('/worker/restart', WhatsAppController.restartWorker.bind(WhatsAppController));

// Session Management
router.post('/session/init', WhatsAppController.initializeSession.bind(WhatsAppController));
router.post('/session/logout', WhatsAppController.logout.bind(WhatsAppController));
router.get('/session/status', WhatsAppController.getSessionStatus.bind(WhatsAppController));
router.get('/sessions', WhatsAppController.getAllSessions.bind(WhatsAppController));

// QR Code
router.get('/qr', WhatsAppController.getQR.bind(WhatsAppController));

// Messaging
router.post('/send', WhatsAppController.sendMessage.bind(WhatsAppController));

// History & Monitoring
router.get('/history', WhatsAppController.getLoginHistory.bind(WhatsAppController));
router.get('/health', WhatsAppController.checkHealth.bind(WhatsAppController));

export default router;