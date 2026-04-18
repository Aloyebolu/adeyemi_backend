import mongoose from 'mongoose';

// Auth storage schema
const whatsappAuthSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  value: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Login History Schema
const loginHistorySchema = new mongoose.Schema({
  sessionId: { type: String, required: true, default: 'default' },
  action: { 
    type: String, 
    // enum: ['login', 'logout', 'qr_generated', 'connection_lost', 'reconnected', 'session_expired', 'paused', 'pause', 'resumed', 'resume', 'res'],
    required: true 
  },
  timestamp: { type: Date, default: Date.now },
  metadata: mongoose.Schema.Types.Mixed
});

// Session Status Schema
const sessionStatusSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: false },
  isPaused: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now },
  connectionStatus: {
    type: String,
    enum: ['disconnected', 'connecting', 'connected', 'qr_pending', 'error', 'paused'],
    default: 'disconnected'
  },
  phoneNumber: String,
  deviceInfo: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

// Worker Heartbeat Schema
const workerHeartbeatSchema = new mongoose.Schema({
  workerId: { type: String, required: true, unique: true },
  sessionId: { type: String, default: 'default' },
  lastHeartbeat: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['online', 'offline', 'paused', 'error'],
    default: 'online'
  },
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

// Worker Commands Schema
const workerCommandSchema = new mongoose.Schema({
  workerId: { type: String, required: true },
  sessionId: { type: String, required: true },
  command: {
    type: String,
    enum: ['pause', 'resume', 'restart', 'logout', 'reconnect'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  requestedBy: String,
  requestedAt: { type: Date, default: Date.now },
  processedAt: Date,
  result: mongoose.Schema.Types.Mixed,
  error: String
});

export const WaAuth = mongoose.model('WaAuth', whatsappAuthSchema);
export const LoginHistory = mongoose.model('LoginHistory', loginHistorySchema);
export const SessionStatus = mongoose.model('SessionStatus', sessionStatusSchema);
export const WorkerHeartbeat = mongoose.model('WorkerHeartbeat', workerHeartbeatSchema);
export const WorkerCommand = mongoose.model('WorkerCommand', workerCommandSchema);