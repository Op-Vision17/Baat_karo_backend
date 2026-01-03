const jwt = require("jsonwebtoken");
const Message = require("../models/messageModel");
const Room = require("../models/roomModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");
const { sendMessageNotification } = require("../services/notificationService");

module.exports = (io) => {
  const roomUsers = new Map(); // Track online users per room

  // Authentication middleware
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

  io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.userId);

    // Join room
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

      // Track online users
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Set());
      }
      roomUsers.get(roomId).add(socket.userId);

      // Emit updated online users list
      io.to(roomId).emit("onlineUsers", Array.from(roomUsers.get(roomId)));

      console.log(`✅ User ${socket.userId} joined room ${roomId}`);
    });

    // SEND MESSAGE WITH PUSH NOTIFICATIONS
    socket.on("sendMessage", async ({ roomId, text, imageUrl, voiceUrl, voiceDuration }) => {
      try {
        console.log("💬 Incoming message:", {
          user: socket.userId,
          roomId,
          text: text ? text.substring(0, 50) : null,
          hasImage: !!imageUrl,
          hasVoice: !!voiceUrl
        });

        // Validate room ID
        if (!mongoose.Types.ObjectId.isValid(roomId)) {
          socket.emit("error", { message: "Invalid room ID" });
          return;
        }

        // Check if message has content
        if (!text && !imageUrl && !voiceUrl) {
          socket.emit("error", { message: "Message cannot be empty" });
          return;
        }

        // Save message to database
        const message = await Message.create({
          roomId,
          sender: socket.userId,
          text: text || "",
          imageUrl: imageUrl || null,
          voiceUrl: voiceUrl || null,
          voiceDuration: voiceDuration || null
        });

        console.log("✅ Message saved:", message._id);

        // Populate sender details
        const populated = await Message.findById(message._id)
          .populate("sender", "name email profilePhoto");

        // Prepare payload for clients
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

        // Broadcast to all users in room (including sender)
        io.to(roomId).emit("receiveMessage", payload);
        console.log("📡 Message broadcasted to room:", roomId);

        // ==========================================
        // 🔔 SEND PUSH NOTIFICATIONS TO OFFLINE USERS
        // ==========================================
        try {
          // Get room details
          const room = await Room.findById(roomId);
          
          // Get currently online users in this room
          const onlineUsers = roomUsers.get(roomId) || new Set();
          
          // Find offline users (members who are not online and not the sender)
          const offlineUserIds = room.members.filter(
            memberId => {
              const memberIdStr = memberId.toString();
              return !onlineUsers.has(memberIdStr) && memberIdStr !== socket.userId.toString();
            }
          );

          if (offlineUserIds.length > 0) {
            console.log(`📢 Sending push notifications to ${offlineUserIds.length} offline users`);

            // Get users with notification settings enabled
            const offlineUsers = await User.find({
              _id: { $in: offlineUserIds },
              'notificationSettings.enabled': true,
              'notificationSettings.messageNotifications': true
            });

            if (offlineUsers.length > 0) {
              // Collect all FCM tokens
              const fcmTokens = [];
              const userTokenMap = new Map(); // Map to track which tokens belong to which user
              
              offlineUsers.forEach(user => {
                const tokens = user.getActiveFcmTokens();
                tokens.forEach(token => {
                  fcmTokens.push(token);
                  userTokenMap.set(token, user._id);
                });
              });

              if (fcmTokens.length > 0) {
                // Determine message type and notification text
                let messageType = 'text';
                let notificationText = text || "";
                
                if (imageUrl && !text) {
                  messageType = 'image';
                  notificationText = "📷 Sent an image";
                } else if (voiceUrl && !text) {
                  messageType = 'voice';
                  notificationText = "🎤 Sent a voice message";
                }

                // Send push notifications
                const result = await sendMessageNotification(
                  fcmTokens,
                  populated.sender.name,
                  notificationText,
                  roomId,
                  messageType
                );

                if (result.success) {
                  console.log(`✅ Sent ${result.successCount || 1} push notification(s)`);
                  
                  // Clean up invalid tokens
                  if (result.invalidTokens && result.invalidTokens.length > 0) {
                    console.log(`🧹 Cleaning up ${result.invalidTokens.length} invalid tokens`);
                    
                    // Group invalid tokens by user
                    const userInvalidTokens = new Map();
                    result.invalidTokens.forEach(token => {
                      const userId = userTokenMap.get(token);
                      if (userId) {
                        if (!userInvalidTokens.has(userId.toString())) {
                          userInvalidTokens.set(userId.toString(), []);
                        }
                        userInvalidTokens.get(userId.toString()).push(token);
                      }
                    });
                    
                    // Remove invalid tokens from each user
                    for (const [userId, tokens] of userInvalidTokens) {
                      const user = offlineUsers.find(u => u._id.toString() === userId);
                      if (user) {
                        await user.removeInvalidTokens(tokens);
                      }
                    }
                  }
                } else {
                  console.error("❌ Failed to send push notifications:", result.error);
                }
              } else {
                console.log("ℹ️ No FCM tokens found for offline users");
              }
            } else {
              console.log("ℹ️ No offline users with notifications enabled");
            }
          } else {
            console.log("ℹ️ All members are online, no push notifications needed");
          }
        } catch (notifError) {
          console.error("❌ Error in notification flow:", notifError);
          // Don't fail the message send if notification fails
        }

      } catch (err) {
        console.error("❌ Message error:", err);
        socket.emit("error", {
          message: "Failed to send message",
          error: err.message
        });
      }
    });

    // User disconnect
    socket.on("disconnect", () => {
      console.log("👋 User disconnected:", socket.userId);

      if (socket.currentRoom && roomUsers.has(socket.currentRoom)) {
        roomUsers.get(socket.currentRoom).delete(socket.userId);

        // Notify remaining users about updated online list
        io.to(socket.currentRoom).emit(
          "onlineUsers",
          Array.from(roomUsers.get(socket.currentRoom))
        );

        console.log(`👋 User ${socket.userId} left room ${socket.currentRoom}`);

        // Clean up empty rooms
        if (roomUsers.get(socket.currentRoom).size === 0) {
          roomUsers.delete(socket.currentRoom);
          console.log(`🧹 Cleaned up empty room: ${socket.currentRoom}`);
        }
      }
    });
  });
};