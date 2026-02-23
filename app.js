const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const app = express();
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ message: "Baatkaro API is running!" });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.use("/api/auth", require("./src/routes/authRoutes"));
app.use("/api/room", require("./src/routes/roomRoutes"));
app.use("/api/upload", require("./src/routes/uploadRoutes"));
app.use("/api/notifications", require("./src/routes/notificationRoutes"));
app.use("/api/agora", require("./src/routes/agoraRoutes"));
app.use("/api/calls", require("./src/routes/callRoutes"));

// 404 for unmatched routes (must be before error handler)
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Not found" });
});

// Global error handler (must be last; 4 args = Express error middleware)
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error("Unhandled error:", err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { error: err.stack }),
  });
});

const server = http.createServer(app);

// Socket.IO server with CORS (set CORS_ORIGIN in production to restrict origins)
const corsOrigin = process.env.CORS_ORIGIN || "*";
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✅ SHARED ACTIVE CALLS MAP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// This Map is shared between chatSocket and callSocket
// so both can access the same active calls data
const activeCalls = new Map();
console.log('✅ Shared activeCalls Map created');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOCKET HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pass activeCalls to both handlers so they can share call state
require("./src/socket/chatSocket")(io, activeCalls);  // ✅ PASS activeCalls
require("./src/socket/callSocket")(io, activeCalls);  // ✅ PASS activeCalls

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Baatkaro backend running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Active calls tracking enabled`);
});