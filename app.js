const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const os = require("os");

dotenv.config();
mongoose.connect(process.env.MONGO_URI);

const app = express();
app.use(express.json());

app.use("/api/auth", require("./src/routes/authRoutes"));
app.use("/api/room", require("./src/routes/roomRoutes"));

const server = http.createServer(app);

// 🔥 Socket.IO server with proper CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

// socket logic alag file me
require("./src/socket/chatSocket")(io);

// Get local IP address (local dev only)
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

const PORT = process.env.PORT || 3000;

// ✅ Render-compatible listen
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Baatkro backend running on port ${PORT}`);

  // ye logs local dev ke liye helpful hain
  if (!process.env.RENDER) {
    const localIP = getLocalIP();
    console.log("📡 Access URLs:");
    console.log(`   - Local:   http://localhost:${PORT}`);
    console.log(`   - Network: http://${localIP}:${PORT}`);
    console.log(`   - Socket:  ws://${localIP}:${PORT}`);
  }
});
