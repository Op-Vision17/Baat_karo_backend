const jwt = require("jsonwebtoken");
const Message = require("../models/messageModel");
const Room = require("../models/roomModel");
const mongoose = require("mongoose");

module.exports = (io) => {

  // 🔐 SOCKET AUTH MIDDLEWARE
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error("No token provided"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      return next(new Error("Invalid token"));
    }
  });

  // 🔌 SOCKET CONNECTION
  io.on("connection", (socket) => {
    console.log("User connected:", socket.userId);

    // 🏠 JOIN ROOM
    socket.on("joinRoom", async (roomId) => {
      if (!mongoose.Types.ObjectId.isValid(roomId)) {
        socket.emit("error", { message: "Invalid room ID" });
        return;
      }

      const room = await Room.findById(roomId);
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      // Check if user is member
      if (!room.members.includes(socket.userId)) {
        socket.emit("error", { message: "Access denied" });
        return;
      }

      socket.join(roomId);
      console.log(`User ${socket.userId} joined room ${roomId}`);
    });

    // 💬 SEND MESSAGE
    socket.on("sendMessage", async ({ roomId, text }) => {
      try {
        console.log(`💬 Received message from ${socket.userId}:`, { roomId, text });

        if (!mongoose.Types.ObjectId.isValid(roomId)) {
          socket.emit("error", { message: "Invalid room ID" });
          return;
        }

        // 1️⃣ Save message to DB
        const message = await Message.create({
          roomId,
          sender: socket.userId,
          text
        });

        // 2️⃣ Populate sender info
        const populatedMessage = await Message.findById(message._id)
          .populate("sender", "name email");

        console.log("✅ Message saved to DB:", message._id);

        // 3️⃣ Broadcast to room
        io.to(roomId).emit("receiveMessage", {
          _id: populatedMessage._id,
          roomId: populatedMessage.roomId,
          sender: {
            _id: populatedMessage.sender._id,
            name: populatedMessage.sender.name,
            email: populatedMessage.sender.email
          },
          text: populatedMessage.text,
          createdAt: populatedMessage.createdAt
        });

        console.log(`📡 Message broadcasted to room ${roomId}`);

      } catch (err) {
        console.error("❌ Message error:", err);
        socket.emit("error", { message: "Failed to send message", error: err.message });
      }
    });

    // ❌ DISCONNECT
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.userId);
    });
  });
};