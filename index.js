import "./config/dbMetrics.js";
import app from "./app.js";
import { createServer } from "http";
import connectToDB from "./config/db.js";
import userService from "./domain/user/user.service.js";
import { SYSTEM_USER_ID } from "./config/system.js";
import { Perf } from "./utils/performanceMonitor.js";
// import { setupSocketServer } from "./domain/chat/chat.socket.js";
import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

async function startApp() {
  try {
    console.log("Start")
    const perf = Perf.start("Step 1: Connecting to DB...");
    await connectToDB();
    const systemUser = await userService.findById(SYSTEM_USER_ID).lean();

    if (!systemUser) {
      throw new Error(`
===========================
❌ CRITICAL STARTUP ERROR
System user not found.
ID: ${SYSTEM_USER_ID}
Application aborted.
===========================
`);

    }

    console.log("Step 1 done.");

    const server = createServer(app);

    // // attach socket.io
    // setupSocketServer(server);

    console.log("Starting server...");
    server.listen(PORT, HOST, () => {
      console.log(`HTTP + Socket.IO running at http://${HOST}:${PORT}`);
    });
    Perf.end(perf)
  } catch (err) {
    console.error("Failed to start server:", err);
  }
}

startApp();
