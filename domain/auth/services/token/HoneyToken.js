import jwt from "jsonwebtoken";
import buildResponse from "#utils/responseBuilder.js";
import { AuditLogService } from "#domain/auditlog/index.js";
import { logger } from "#utils/logger.js";

export function detect_honeytoken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : req.cookies?.access_token;

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.HONEYTOKEN_SECRET);

    if (decoded.type === "honeytoken") {
      logger.info("🚨 Honeytoken triggered! Possible cookie theft.");
      req.user = {_id: decoded.uid}


      // Set audit context for honeytoken detection
      req.auditContext = {
        iisSuspicious: true,
        action: "HONEYTOKEN_TRIGGERED",
        resource: "Honeytoken",
        severity: "CRITICAL",
        status: "ERROR",
        reason: "Honeytoken detected - possible cookie theft or malicious activity",
        isSuspicious: true,
        requiresReview: true,
        metadata: {
          userId: decoded.uid,
          userEmail: decoded.email,
          userRole: decoded.role,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          timestamp: new Date().toISOString(),
          endpoint: req.originalUrl,
          method: req.method,
          decodedToken: {
            uid: decoded.uid,
            email: decoded.email,
            role: decoded.role,
            type: decoded.type,
            iat: decoded.iat,
            exp: decoded.exp
          },
          // Track how many times this IP/user has triggered honeytoken (can be used for rate limiting)
          triggeredAt: new Date().toISOString(),
          // Additional context for investigation
          requestHeaders: {
            authorization: req.headers.authorization ? "Bearer [REDACTED]" : undefined,
            cookie: req.headers.cookie ? "[REDACTED]" : undefined,
            referer: req.headers.referer,
            origin: req.headers.origin
          }
        }
      };

           const metadata = {
        userId: decoded.uid,
        userEmail: decoded.email,
        userRole: decoded.role,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        endpoint: req.originalUrl,
        method: req.method,
        decodedToken: decoded,
        triggeredAt: new Date().toISOString(),
        requestHeaders: {
          authorization: req.headers.authorization ? "Bearer [REDACTED]" : undefined,
          cookie: req.headers.cookie ? "[REDACTED]" : undefined,
          referer: req.headers.referer,
          origin: req.headers.origin
        }
      };

      // Immediately log the honeytoken hit
      AuditLogService.logHttpRequest({
        req,
        res,
        responseTime: 0, // can be computed if needed
        responseBody: getRandomFunnyMessage(),
        error: null,
        auditContext: {
          action: "HONEYTOKEN_TRIGGERED",
          resource: "Honeytoken",
          severity: "CRITICAL",
          status: "ALERT",
          reason: "Honeytoken detected - possible cookie theft or malicious activity",
          metadata
        }
      });


      // Hacker sees a fun "success" message 🎉
      // return buildResponse.success(res, getRandomFunnyMessage())
    }

  } catch (err) {
  }

  next();
}

// Function to get random funny message
function getRandomFunnyMessage() {
  const funnyMessages = [
    "🎉 Congrats! You found a shiny vulnerability! Just Keep exploring… 😉 We'll get back to you as soon as possible!😂😂",
    "😂 Oh wow, you're back! Did you miss me? Keep digging, there's more! 😏",
    "🤣 Another try? You're persistent… I like that! The trap is getting deeper!",
    "😏 Feeling lucky? Keep poking, it's just a honeypot! 🍯",
    "🎯 Bingo! This honeytoken knows all your secrets… or does it? 😉",
    "🔍 You've discovered our secret! Congratulations, you're now in our watchlist! 👀",
    "💫 Welcome to the honeypot! Please leave your dignity at the door. 🚪",
    "🎪 Step right up! Another brave hacker enters the honeytoken circus! 🎭",
    "🚀 You've triggered a honeytoken! We're sending a virtual high-five! ✋",
    "🍯 Sweet success! You've found the honey, now watch out for the bees! 🐝"
  ];
  
  return funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
}