// server.js - Complete working Socket.IO server
import express, { json } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Store active computations and their intervals
const activeComputations = new Map();

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  socket.on('subscribe', (options, callback) => {
    console.log('📡 Subscription received:', options);
    
    try {
      if (options.scopeId) {
        socket.join(`computation:${options.scopeId}`);
        socket.join(`computation:computation`);
        console.log(`✅ Client ${socket.id} joined room: computation:${options.scopeId}`);
        console.log('Current rooms:', Array.from(socket.rooms));
        
        // Send immediate confirmation
        socket.emit('log_event', {
          timestamp: Date.now(),
          level: 'info',
          message: '✅ Successfully subscribed to computation',
          domain: 'computation',
          scopeId: options.scopeId,
          data: { 
            status: 'subscribed',
            computationId: options.scopeId,
            room: `computation:${options.scopeId}`
          }
        });
        
        // Check if this computation already has a simulation running
        if (activeComputations.has(options.scopeId)) {
          console.log(`ℹ️ Simulation already running for ${options.scopeId}`);
        } else {
          console.log(`⚠️ No active simulation found for ${options.scopeId}`);
        }
      }
      
      if (options.channel) {
        socket.join(`channel:${options.channel}`);
        console.log(`✅ Client ${socket.id} joined channel: ${options.channel}`);
        
        socket.emit('log_event', {
          timestamp: Date.now(),
          level: 'info',
          message: `✅ Subscribed to ${options.channel} channel`,
          domain: 'system',
          data: { channel: options.channel }
        });
      }

      // Send success response
      if (callback) {
        callback({ success: true, options });
      } else {
        socket.emit('subscribed', { success: true, options });
      }
      
    } catch (error) {
      console.error('❌ Subscription error:', error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  });

  socket.on('unsubscribe', (options, callback) => {
    if (options.scopeId) {
      socket.leave(`computation:${options.scopeId}`);
      console.log(`Client ${socket.id} left room: computation:${options.scopeId}`);
    }
    if (options.channel) {
      socket.leave(`channel:${options.channel}`);
    }
    
    if (callback) {
      callback({ success: true, options });
    } else {
      socket.emit('unsubscribed', { success: true, options });
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Start computation endpoint
app.get('/api/compute', json(), (req, res) => {
  const computationId = `computation`;
  
  console.log('\n🚀 Starting new computation:', computationId);
  
  // Start the simulation immediately
  const interval = simulateComputation(computationId);
  activeComputations.set(computationId, interval);
  
  res.json({
    success: true,
    computationId,
    status: 'started',
    message: 'Computation started successfully'
  });
});

// Simulation function - defined after io is initialized
function simulateComputation(computationId) {
  console.log(`🎯 Starting simulation for computation: ${computationId}`);
  
  const departments = [
    'Computer Science', 'Mathematics', 'Physics', 'Chemistry', 
    'Biology', 'Engineering', 'Economics', 'English'
  ];
  
  let step = 0;
  let studentsProcessed = 0;
  const totalStudents = 5000000;
  
  // Send logs every 2 seconds
  const interval = setInterval(() => {
    step++;
    studentsProcessed = Math.min(studentsProcessed + 25, totalStudents);
    const progress = Math.round((studentsProcessed / totalStudents) * 100);
    
    // Get the room name
    const room = `computation:${computationId}`;
    
    // Get all clients in this room
    const roomClients = io.sockets.adapter.rooms.get(room);
    const clientCount = roomClients ? roomClients.size : 0;
    
    console.log(`\n📤 [${computationId}] Step ${step}:`);
    console.log(`   - Room: ${room}`);
    console.log(`   - Clients in room: ${clientCount}`);
    console.log(`   - Progress: ${progress}%`);
    
    if (clientCount === 0) {
      console.log(`   ⚠️ No clients in room! Logs won't be received by anyone.`);
    }
    
    // Send progress log - using io.to(room) which is the correct way
    const logEvent = {
      timestamp: Date.now(),
      level: 'info',
      message: `Processing students: ${studentsProcessed}/${totalStudents} (${progress}%)`,
      domain: 'computation',
      scopeId: computationId,
      data: {
        step,
        progress,
        studentsProcessed,
        totalStudents,
        phase: step % 3 === 0 ? 'calculating_gpa' : 'processing_records',
        clientCount
      }
    };
    
    console.log(`   📨 Emitting log event to room:`, logEvent.message);
    io.to(room).emit('log_event', logEvent);
    
    // Send department updates
    if (step % 3 === 0) {
      const dept = departments[Math.floor(Math.random() * departments.length)];
      const deptLog = {
        timestamp: Date.now(),
        level: 'debug',
        message: `Processing department: ${dept}`,
        domain: 'computation',
        scopeId: computationId,
        data: {
          department: dept,
          recordsProcessed: Math.floor(Math.random() * 100) + 50
        }
      };
      io.to(room).emit('log_event', deptLog);
    }
    
    // Send occasional warnings
    if (step % 5 === 0) {
      const warnLog = {
        timestamp: Date.now(),
        level: 'warn',
        message: 'High memory usage detected',
        domain: 'computation',
        scopeId: computationId,
        data: {
          memoryUsage: '85%',
          recommendation: 'Consider optimizing queries'
        }
      };
      io.to(room).emit('log_event', warnLog);
    }
    
    // Send occasional errors
    if (step % 7 === 0) {
      const errorLog = {
        timestamp: Date.now(),
        level: 'error',
        message: 'Failed to process student record',
        domain: 'computation',
        scopeId: computationId,
        data: {
          studentId: `STU${Math.floor(Math.random() * 1000)}`,
          reason: 'Missing grades',
          recoverable: true
        }
      };
      io.to(room).emit('log_event', errorLog);
    }
    
    // Send completion
    if (progress >= 100) {
      const completeLog = {
        timestamp: Date.now(),
        level: 'info',
        message: '✅ Computation completed successfully!',
        domain: 'computation',
        scopeId: computationId,
        data: {
          status: 'completed',
          totalProcessed: studentsProcessed,
          duration: `${step * 1.5}s`,
          averageTimePerStudent: '2.3ms'
        }
      };
      
      io.to(room).emit('log_event', completeLog);
      
      clearInterval(interval);
      activeComputations.delete(computationId);
      console.log(`✅ Simulation completed for ${computationId}`);
    }
    
  }, 30); // Send every 3 seconds
  
  return interval;
}

// Get active computations
app.get('/api/computations/active', (req, res) => {
  const active = Array.from(activeComputations.keys());
  res.json({
    count: active.length,
    computations: active
  });
});

// Get specific computation status
app.get('/api/computation/:id', (req, res) => {
  const { id } = req.params;
  const isActive = activeComputations.has(id);
  
  // Get room info
  const room = `computation:${id}`;
  const roomClients = io.sockets.adapter.rooms.get(room);
  const clientCount = roomClients ? roomClients.size : 0;
  
  res.json({
    computationId: id,
    status: isActive ? 'running' : 'completed',
    active: isActive,
    subscribers: clientCount,
    room: room
  });
});

// Stop a computation
app.post('/api/computation/:id/stop', (req, res) => {
  const { id } = req.params;
  const interval = activeComputations.get(id);
  
  if (interval) {
    clearInterval(interval);
    activeComputations.delete(id);
    
    // Notify subscribers
    io.to(`computation:${id}`).emit('log_event', {
      timestamp: Date.now(),
      level: 'warn',
      message: '⚠️ Computation stopped by user',
      domain: 'computation',
      scopeId: id,
      data: { status: 'stopped' }
    });
    
    res.json({ success: true, message: 'Computation stopped' });
  } else {
    res.status(404).json({ success: false, message: 'Computation not found' });
  }
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO endpoint: http://localhost:${PORT}/socket.io/`);
  console.log(`\n📊 Test endpoints:`);
  console.log(`   POST http://localhost:${PORT}/api/compute - Start computation`);
  console.log(`   GET http://localhost:${PORT}/api/computations/active - List active`);
  console.log(`   GET http://localhost:${PORT}/api/computation/:id - Check status with subscriber count`);
  console.log(`\n💡 Ready to receive connections!\n`);
});