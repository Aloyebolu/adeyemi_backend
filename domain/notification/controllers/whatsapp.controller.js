import buildResponse from "#utils/responseBuilder.js";
import WhatsAppService from "#domain/notification/services/whatsapp/whatsapp.service.js";


class WhatsAppController {
    async getQR(req, res) {
        try {
            const sessionId = req.query.sessionId || 'default';
            const qrData = await WhatsAppService.getQRCode(sessionId);
            
            if (!qrData) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'No QR code available or QR code expired' 
                });
            }
            
            const base64Data = qrData.replace(/^data:image\/png;base64,/, "");
            const imgBuffer = Buffer.from(base64Data, "base64");
            
            res.set("Content-Type", "image/png");
            res.send(imgBuffer);
        } catch (err) {
            throw err
        }
    }

    async getSessionStatus(req, res) {
        try {
            const sessionId = req.query.sessionId || 'default';
            const status = await WhatsAppService.getSessionInfo(sessionId);
            
            res.json({
                success: true,
                data: status
            });
        } catch (err) {
            res.status(500).json({ 
                success: false, 
                message: 'Error fetching session status',
                error: err.message 
            });
        }
    }

    async getAllSessions(req, res) {
        try {
            const sessions = await WhatsAppService.getAllSessions();
            
            res.json({
                success: true,
                data: sessions,
                count: sessions.length
            });
        } catch (err) {
            res.status(500).json({ 
                success: false, 
                message: 'Error fetching sessions',
                error: err.message 
            });
        }
    }

    async getWorkers(req, res) {
        try {
            const workers = await WhatsAppService.getWorkerStatus();
            
            res.json({
                success: true,
                data: workers,
                count: workers.length
            });
        } catch (err) {
            res.status(500).json({ 
                success: false, 
                message: 'Error fetching workers',
                error: err.message 
            });
        }
    }

    async initializeSession(req, res) {
        try {
            const { sessionId = 'default' } = req.body;
            
            const sessionInfo = await WhatsAppService.getSessionInfo(sessionId);
            
            if (sessionInfo.isActive) {
                return res.json({
                    success: true,
                    message: 'Session already active',
                    data: sessionInfo
                });
            }
            
            await WhatsAppService.initializeSession(sessionId);
            
            res.json({
                success: true,
                message: 'Session initialization started',
                data: { sessionId }
            });
        } catch (err) {
            res.status(500).json({ 
                success: false, 
                message: 'Error initializing session',
                error: err.message 
            });
        }
    }

    async pauseWorker(req, res) {
        try {
            const { sessionId = 'default' } = req.body;
            const result = await WhatsAppService.pauseWorker(sessionId);
            
            res.json({
                success: true,
                message: 'Worker paused successfully',
                data: result
            });
        } catch (err) {
            res.status(err.statusCode || 500).json({ 
                success: false, 
                message: err.message || 'Error pausing worker',
                error: err.message 
            });
        }
    }

    async resumeWorker(req, res) {
        try {
            const { sessionId = 'default' } = req.body;
            const result = await WhatsAppService.resumeWorker(sessionId);
            
            res.json({
                success: true,
                message: 'Worker resumed successfully',
                data: result
            });
        } catch (err) {
            res.status(err.statusCode || 500).json({ 
                success: false, 
                message: err.message || 'Error resuming worker',
                error: err.message 
            });
        }
    }

    async restartWorker(req, res) {
        try {
            const { sessionId = 'default' } = req.body;
            const result = await WhatsAppService.restartWorker(sessionId);
            
            res.json({
                success: true,
                message: 'Worker restart command sent',
                data: result
            });
        } catch (err) {
            res.status(err.statusCode || 500).json({ 
                success: false, 
                message: err.message || 'Error restarting worker',
                error: err.message 
            });
        }
    }

    async logout(req, res) {
        try {
            const { sessionId = 'default' } = req.body;
            
            await WhatsAppService.logout(sessionId);
            
            res.json({
                success: true,
                message: 'Logged out successfully',
                data: { sessionId }
            });
        } catch (err) {
            res.status(err.statusCode || 500).json({ 
                success: false, 
                message: err.message || 'Error during logout',
                error: err.message 
            });
        }
    }

    async sendMessage(req, res) {
        try {
            const { sessionId = 'default', to, message } = req.body;
            
            if (!to || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: to, message'
                });
            }
            
            const result = await WhatsAppService.sendMessage(to, message, sessionId);
            
            res.json({
                success: true,
                message: 'Message sent successfully',
                data: result
            });
        } catch (err) {
            res.status(err.statusCode || 500).json({ 
                success: false, 
                message: err.message || 'Error sending message',
                error: err.message 
            });
        }
    }

    async getLoginHistory(req, res) {
        try {
            const sessionId = req.query.sessionId || 'default';
            const limit = parseInt(req.query.limit) || 50;
            
            const history = await WhatsAppService.getLoginHistory(sessionId, limit);
            
            res.json({
                success: true,
                data: history,
                count: history.length
            });
        } catch (err) {
            res.status(500).json({ 
                success: false, 
                message: 'Error fetching login history',
                error: err.message 
            });
        }
    }

    async checkHealth(req, res) {
        try {
            const sessionId = req.query.sessionId || 'default';
            const health = await WhatsAppService.healthCheck(sessionId);
            
            res.json({
                success: true,
                data: health
            });
        } catch (err) {
            res.status(500).json({ 
                success: false, 
                message: 'Health check failed',
                error: err.message 
            });
        }
    }

    async getServiceInfo(req, res) {
        try {
            const workers = await WhatsAppService.getWorkerStatus();
            
            res.json({
                success: true,
                data: {
                    mode: process.env.PROCESS_TYPE === 'worker' ? 'worker' : 'server',
                    activeWorkers: workers.filter(w => w.isOnline).length,
                    totalWorkers: workers.length,
                    features: {
                        autoReconnect: process.env.PROCESS_TYPE === 'worker',
                        messageProcessing: process.env.PROCESS_TYPE === 'worker',
                        messageSending: process.env.PROCESS_TYPE === 'worker',
                        workerControl: true,
                        sessionManagement: true,
                        qrGeneration: true
                    }
                }
            });
        } catch (err) {
            res.status(500).json({ 
                success: false, 
                message: 'Error fetching service info',
                error: err.message 
            });
        }
    }
}

export default new WhatsAppController();