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
  res.json({ message: "Baatkro API is running!" });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.use("/api/auth", require("./src/routes/authRoutes"));
app.use("/api/room", require("./src/routes/roomRoutes"));
app.use("/api/upload", require("./src/routes/uploadRoutes"));
app.use("/api/notifications", require("./src/routes/notificationRoutes"));
app.use("/api/agora", require("./src/routes/agoraRoutes")); // ✅ NEW
app.use("/api/calls", require("./src/routes/callRoutes"));   // ✅ NEW

const server = http.createServer(app);

// Socket.IO server with proper CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOCKET HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
require("./src/socket/chatSocket")(io);
require("./src/socket/callSocket")(io); // ✅ NEW

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Baatkro backend running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});