import mongoose from "mongoose";
import dotenv from "dotenv";
import { initWorkers, getWorkerStatus, jobMonitor } from "../worker.js";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI2 || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("[Worker Script] MONGODB_URI not set");
  process.exit(1);
}

/**
 * Connect to MongoDB
 */
async function connectMongo() {
  console.log("[Worker Script] Connecting to MongoDB...");
  
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  
  console.log("[Worker Script] MongoDB connected");
}

/**
 * Main startup function
 */
async function start() {
  try {
    // Connect to database
    await connectMongo();

    // Initialize workers with monitoring and WhatsApp
    const { agenda, whatsapp } = await initWorkers({
      enableMonitoring: true,
      monitoringInterval: 10000, // Log stats every 10 seconds
      heartbeatInterval: "30 seconds",
      enableWhatsApp: true // Enable WhatsApp worker
    });

    console.log("[Worker Script] ✅ Department worker running!");
    console.log("[Worker Script] ✅ WhatsApp worker running!");
    console.log("[Worker Script] 📊 Monitoring active");
    
    // Log WhatsApp worker ID
    console.log(`[Worker Script] WhatsApp Worker ID: ${whatsapp?.workerId || 'N/A'}`);

    // Display initial stats
    const status = await getWorkerStatus();
    console.log("[Worker Script] Initial status:", {
      agendaReady: status.agendaReady,
      whatsappStatus: status.whatsappStatus,
      jobStats: status.stats
    });

    // Optional: Periodic detailed stats
    setInterval(async () => {
      const failed = await jobMonitor.getFailedJobs(5);
      if (failed.length > 0) {
        console.log(`[Worker Script] Recent failed jobs: ${failed.length}`);
        failed.forEach(job => {
          console.log(`  - ${job.attrs.name} (${job.attrs._id}): ${job.attrs.failReason}`);
        });
      }
      
      // Log WhatsApp status periodically
      const currentStatus = await getWorkerStatus();
      console.log(`[Worker Script] WhatsApp status: ${currentStatus.whatsappStatus}`);
    }, 60000);

  } catch (error) {
    console.error("[Worker Script] ❌ Failed to start:", error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("[Worker Script] Uncaught exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Worker Script] Unhandled rejection:", reason);
});

// Start the worker
start();