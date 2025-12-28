const jwt = require("jsonwebtoken");
const Message = require("../models/messageModel");
const Room = require("../models/roomModel");
const mongoose = require("mongoose");

module.exports = (io) => {
  const roomUsers = new Map();

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token || socket.handshake.query?.token;

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

  io.on("connection", (socket) => {
    console.log("User connected:", socket.userId);

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

      if (!room.members.includes(socket.userId)) {
        socket.emit("error", { message: "Access denied" });
        return;
      }

      socket.join(roomId);
      socket.currentRoom = roomId;

      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Set());
      }
      roomUsers.get(roomId).add(socket.userId);

      io.to(roomId).emit("onlineUsers", Array.from(roomUsers.get(roomId)));

      console.log(`User ${socket.userId} joined room ${roomId}`);
    });

    // SEND MESSAGE (TEXT + IMAGE + VOICE)
    socket.on("sendMessage", async ({ roomId, text, imageUrl, voiceUrl, voiceDuration }) => {
      try {
        console.log("💬 Incoming:", {
          user: socket.userId,
          roomId,
          text,
          imageUrl,
          voiceUrl,
          voiceDuration
        });

        if (!mongoose.Types.ObjectId.isValid(roomId)) {
          socket.emit("error", { message: "Invalid room ID" });
          return;
        }

        // Empty message guard
        if (!text && !imageUrl && !voiceUrl) {
          socket.emit("error", { message: "Message cannot be empty" });
          return;
        }

        // Save message
        const message = await Message.create({
          roomId,
          sender: socket.userId,
          text: text || "",
          imageUrl: imageUrl || null,
          voiceUrl: voiceUrl || null,
          voiceDuration: voiceDuration || null
        });

        console.log("✅ Message saved to DB:", message._id);

        // Populate sender with profile photo
        const populated = await Message.findById(message._id)
          .populate("sender", "name email profilePhoto");

        console.log("✅ Message populated:", populated);

        const payload = {
          _id: populated._id,
          roomId: populated.roomId,
          sender: {
            _id: populated.sender._id,
            name: populated.sender.name,
            email: populated.sender.email,
            profilePhoto: populated.sender.profilePhoto || null
          },
          text: populated.text,
          imageUrl: populated.imageUrl,
          voiceUrl: populated.voiceUrl,
          voiceDuration: populated.voiceDuration,
          createdAt: populated.createdAt
        };

        console.log("📡 Broadcasting payload:", payload);

        // Broadcast to room
        io.to(roomId).emit("receiveMessage", payload);

        console.log("📡 Message broadcasted to room:", roomId);

      } catch (err) {
        console.error("❌ Message error:", err);
        socket.emit("error", {
          message: "Failed to send message",
          error: err.message
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.userId);

      if (socket.currentRoom && roomUsers.has(socket.currentRoom)) {
        roomUsers.get(socket.currentRoom).delete(socket.userId);

        io.to(socket.currentRoom).emit(
          "onlineUsers",
          Array.from(roomUsers.get(socket.currentRoom))
        );

        console.log(`👋 User ${socket.userId} left room ${socket.currentRoom}`);

        if (roomUsers.get(socket.currentRoom).size === 0) {
          roomUsers.delete(socket.currentRoom);
          console.log(`🧹 Cleaned up empty room: ${socket.currentRoom}`);
        }
      }
    });
  });
};