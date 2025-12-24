const jwt = require("jsonwebtoken");
const Message = require("../models/messageModel");
const Room = require("../models/roomModel");
const mongoose = require("mongoose");

module.exports = (io) => {
  // 🔥 Track users in rooms: { roomId: Set([userId1, userId2, ...]) }
  const roomUsers = new Map();

  // 🔐 SOCKET AUTH MIDDLEWARE
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

      if (!room.members.includes(socket.userId)) {
        socket.emit("error", { message: "Access denied" });
        return;
      }

      socket.join(roomId);
      socket.currentRoom = roomId; // 🔥 Store current room on socket

      // 🔥 Add user to online tracking
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Set());
      }
      roomUsers.get(roomId).add(socket.userId);

      // 🔥 Broadcast updated online users to everyone in the room
      io.to(roomId).emit("onlineUsers", Array.from(roomUsers.get(roomId)));

      console.log(`User ${socket.userId} joined room ${roomId}`);
      console.log(`✅ Online users in room ${roomId}:`, Array.from(roomUsers.get(roomId)));
    });

    // 💬 SEND MESSAGE (TEXT + IMAGE)
    socket.on("sendMessage", async ({ roomId, text, imageUrl }) => {
      try {
        console.log("💬 Incoming:", {
          user: socket.userId,
          roomId,
          text,
          imageUrl
        });

        if (!mongoose.Types.ObjectId.isValid(roomId)) {
          socket.emit("error", { message: "Invalid room ID" });
          return;
        }

        // ❌ Empty message guard
        if (!text && !imageUrl) {
          socket.emit("error", { message: "Message cannot be empty" });
          return;
        }

        // 1️⃣ Save message
        const message = await Message.create({
          roomId,
          sender: socket.userId,
          text: text || "",
          imageUrl: imageUrl || null
        });

        // 2️⃣ Populate sender
        const populated = await Message.findById(message._id)
          .populate("sender", "name email");

        // 3️⃣ Broadcast
        io.to(roomId).emit("receiveMessage", {
          _id: populated._id,
          roomId: populated.roomId,
          sender: {
            _id: populated.sender._id,
            name: populated.sender.name,
            email: populated.sender.email
          },
          text: populated.text,
          imageUrl: populated.imageUrl,
          createdAt: populated.createdAt
        });

        console.log("📡 Message broadcasted:", message._id);

      } catch (err) {
        console.error("❌ Message error:", err);
        socket.emit("error", {
          message: "Failed to send message",
          error: err.message
        });
      }
    });

    // ❌ DISCONNECT
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.userId);

      // 🔥 Remove user from online tracking
      if (socket.currentRoom && roomUsers.has(socket.currentRoom)) {
        roomUsers.get(socket.currentRoom).delete(socket.userId);

        // 🔥 Broadcast updated online users to remaining users in the room
        io.to(socket.currentRoom).emit(
          "onlineUsers",
          Array.from(roomUsers.get(socket.currentRoom))
        );

        console.log(`👋 User ${socket.userId} left room ${socket.currentRoom}`);
        console.log(`✅ Remaining online users:`, Array.from(roomUsers.get(socket.currentRoom)));

        // 🧹 Clean up empty room tracking
        if (roomUsers.get(socket.currentRoom).size === 0) {
          roomUsers.delete(socket.currentRoom);
          console.log(`🧹 Cleaned up empty room: ${socket.currentRoom}`);
        }
      }
    });
  });
};