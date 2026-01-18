// backend/src/socket/chatSocket.js
const jwt = require("jsonwebtoken");
const Message = require("../models/messageModel");
const Room = require("../models/roomModel");
const User = require("../models/userModel");
const Call = require("../models/callModel");
const mongoose = require("mongoose");
const { sendMessageNotification } = require("../services/notificationService");

module.exports = (io, activeCalls) => {
  const roomUsers = new Map(); // Track online users per room
  const typingUsers = new Map(); // Track typing users per room: roomId -> Set of userId
  const typingTimeouts = new Map(); // Auto-clear typing after timeout: userId-roomId -> timeout

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

  // ✅ CRITICAL FIX: Force leave current room first (even if same room)
  if (socket.currentRoom) {
    console.log(`🔄 User ${socket.userId} leaving previous room: ${socket.currentRoom}`);
    
    // Leave the Socket.IO room
    socket.leave(socket.currentRoom);
    
    // Remove from online users of previous room
    if (roomUsers.has(socket.currentRoom)) {
      roomUsers.get(socket.currentRoom).delete(socket.userId);
      
      // Notify others in previous room
      io.to(socket.currentRoom).emit(
        "onlineUsers",
        Array.from(roomUsers.get(socket.currentRoom))
      );
      
      // Clean up empty room
      if (roomUsers.get(socket.currentRoom).size === 0) {
        roomUsers.delete(socket.currentRoom);
        console.log(`🧹 Cleaned up empty room: ${socket.currentRoom}`);
      }
    }
    
    // Clear typing indicator for previous room
    const prevRoomTypingUsers = typingUsers.get(socket.currentRoom);
    if (prevRoomTypingUsers) {
      prevRoomTypingUsers.delete(socket.userId);
      
      const typingKey = `${socket.userId}-${socket.currentRoom}`;
      if (typingTimeouts.has(typingKey)) {
        clearTimeout(typingTimeouts.get(typingKey));
        typingTimeouts.delete(typingKey);
      }
      
      // Notify others in previous room
      io.to(socket.currentRoom).emit("typingUpdate", {
        typingUsers: Array.from(prevRoomTypingUsers.values())
      });
      
      // Clean up empty typing map
      if (prevRoomTypingUsers.size === 0) {
        typingUsers.delete(socket.currentRoom);
      }
    }
    
    console.log(`✅ User ${socket.userId} left previous room: ${socket.currentRoom}`);
  }

  // ✅ NOW join the new room (fresh join even if same room)
  socket.join(roomId);
  socket.currentRoom = roomId;

  // Track online users
  if (!roomUsers.has(roomId)) {
    roomUsers.set(roomId, new Set());
  }
  roomUsers.get(roomId).add(socket.userId);

  // Initialize typing users set for this room
  if (!typingUsers.has(roomId)) {
    typingUsers.set(roomId, new Map()); // Map of userId -> user info
  }

  // Emit updated online users list
  io.to(roomId).emit("onlineUsers", Array.from(roomUsers.get(roomId)));

  console.log(`✅ User ${socket.userId} joined room ${roomId}`);

  // ✅ CHECK FOR ACTIVE CALL IN THIS ROOM
  try {
    const activeCall = activeCalls.get(roomId);
    
    if (activeCall && 
        (activeCall.status === 'ringing' || activeCall.status === 'ongoing')) {
      
      console.log(`📞 Active call found in room ${roomId}, notifying user ${socket.userId}`);

      // Get call details from database
      const call = await Call.findById(activeCall.callId)
        .populate('initiator', 'name profilePhoto email');

      if (call) {
        // Get caller info
        const caller = await User.findById(call.initiator._id || call.initiator)
          .select('name profilePhoto email');

        // Send incoming_call event to this specific user
        socket.emit('incoming_call', {
          callId: call._id.toString(),
          roomId: roomId,
          roomName: room.name,
          callType: call.callType,
          status: activeCall.status,
          caller: {
            id: caller._id.toString(),
            name: caller.name,
            avatar: caller.profilePhoto || null,
            email: caller.email
          },
          participants: Array.from(activeCall.participants).map(uid => ({
            id: uid
          })),
          startTime: call.createdAt || new Date(),
          timestamp: new Date()
        });

        console.log(`   ✅ Sent active call notification to user ${socket.userId}`);
      }
    }
  } catch (callError) {
    console.error('❌ Error checking active call:', callError);
  }
});
    // ✅ TYPING INDICATOR - User started typing
    socket.on("typing", async ({ roomId, isTyping }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(roomId)) {
          return;
        }

        // Get user info for typing indicator
        const user = await User.findById(socket.userId).select("name profilePhoto");
        if (!user) return;

        const roomTypingUsers = typingUsers.get(roomId);
        if (!roomTypingUsers) return;

        const typingKey = `${socket.userId}-${roomId}`;

        if (isTyping) {
          // Add user to typing list
          roomTypingUsers.set(socket.userId, {
            userId: socket.userId,
            name: user.name,
            profilePhoto: user.profilePhoto
          });

          // Clear existing timeout
          if (typingTimeouts.has(typingKey)) {
            clearTimeout(typingTimeouts.get(typingKey));
          }

          // Auto-remove typing after 3 seconds of inactivity
          const timeout = setTimeout(() => {
            roomTypingUsers.delete(socket.userId);
            typingTimeouts.delete(typingKey);

            // Emit updated typing users (excluding sender)
            socket.to(roomId).emit("typingUpdate", {
              typingUsers: Array.from(roomTypingUsers.values())
            });
          }, 3000);

          typingTimeouts.set(typingKey, timeout);

          console.log(`⌨️ User ${user.name} is typing in room ${roomId}`);
        } else {
          // User stopped typing
          roomTypingUsers.delete(socket.userId);

          // Clear timeout
          if (typingTimeouts.has(typingKey)) {
            clearTimeout(typingTimeouts.get(typingKey));
            typingTimeouts.delete(typingKey);
          }

          console.log(`✋ User ${user.name} stopped typing in room ${roomId}`);
        }

        // Broadcast typing status to other users in room (exclude sender)
        socket.to(roomId).emit("typingUpdate", {
          typingUsers: Array.from(roomTypingUsers.values())
        });

      } catch (err) {
        console.error("❌ Typing indicator error:", err);
      }
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

        // Clear typing indicator when sending message
        const roomTypingUsers = typingUsers.get(roomId);
        if (roomTypingUsers) {
          roomTypingUsers.delete(socket.userId);
          const typingKey = `${socket.userId}-${roomId}`;
          if (typingTimeouts.has(typingKey)) {
            clearTimeout(typingTimeouts.get(typingKey));
            typingTimeouts.delete(typingKey);
          }
          // Notify others typing stopped
          socket.to(roomId).emit("typingUpdate", {
            typingUsers: Array.from(roomTypingUsers.values())
          });
        }

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
          isDeleted: populated.isDeleted,
          createdAt: populated.createdAt
        };

        // Broadcast to all users in room (including sender)
        io.to(roomId).emit("receiveMessage", payload);
        console.log("📡 Message broadcasted to room:", roomId);

        // Push notifications code
        try {
          const room = await Room.findById(roomId);
          const onlineUsers = roomUsers.get(roomId) || new Set();
          const offlineUserIds = room.members.filter(
            memberId => {
              const memberIdStr = memberId.toString();
              return !onlineUsers.has(memberIdStr) && memberIdStr !== socket.userId.toString();
            }
          );

          if (offlineUserIds.length > 0) {
            console.log(`📢 Sending push notifications to ${offlineUserIds.length} offline users`);

            const offlineUsers = await User.find({
              _id: { $in: offlineUserIds },
              'notificationSettings.enabled': true,
              'notificationSettings.messageNotifications': true
            });

            if (offlineUsers.length > 0) {
              const fcmTokens = [];
              const userTokenMap = new Map();
              
              offlineUsers.forEach(user => {
                const tokens = user.getActiveFcmTokens();
                tokens.forEach(token => {
                  fcmTokens.push(token);
                  userTokenMap.set(token, user._id);
                });
              });

              if (fcmTokens.length > 0) {
                let messageType = 'text';
                let notificationText = text || "";
                
                if (imageUrl && !text) {
                  messageType = 'image';
                  notificationText = "📷 Sent an image";
                } else if (voiceUrl && !text) {
                  messageType = 'voice';
                  notificationText = "🎤 Sent a voice message";
                }

                const result = await sendMessageNotification(
                  fcmTokens,
                  populated.sender.name,
                  notificationText,
                  roomId,
                  messageType
                );

                if (result.success) {
                  console.log(`✅ Sent ${result.successCount || 1} push notification(s)`);
                  
                  if (result.invalidTokens && result.invalidTokens.length > 0) {
                    console.log(`🧹 Cleaning up ${result.invalidTokens.length} invalid tokens`);
                    
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
        }

      } catch (err) {
        console.error("❌ Message error:", err);
        socket.emit("error", {
          message: "Failed to send message",
          error: err.message
        });
      }
    });

    // ✅ DELETE MESSAGE EVENT
    socket.on("deleteMessage", async ({ messageId, roomId }) => {
      try {
        console.log("🗑️ Delete message request:", {
          user: socket.userId,
          messageId,
          roomId
        });

        // Validate IDs
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          socket.emit("error", { message: "Invalid message ID" });
          return;
        }

        if (!mongoose.Types.ObjectId.isValid(roomId)) {
          socket.emit("error", { message: "Invalid room ID" });
          return;
        }

        // Find message
        const message = await Message.findById(messageId);

        if (!message) {
          socket.emit("error", { message: "Message not found" });
          return;
        }

        // Check if user is the sender
        if (message.sender.toString() !== socket.userId.toString()) {
          socket.emit("error", { message: "You can only delete your own messages" });
          return;
        }

        // Check if already deleted
        if (message.isDeleted) {
          socket.emit("error", { message: "Message already deleted" });
          return;
        }

        // Soft delete the message
        message.isDeleted = true;
        message.deletedAt = new Date();
        message.deletedBy = socket.userId;
        await message.save();

        console.log("✅ Message deleted:", messageId);

        // Broadcast delete event to all users in the room
        const deletePayload = {
          messageId: message._id,
          roomId: message.roomId,
          deletedBy: socket.userId,
          deletedAt: message.deletedAt
        };

        io.to(roomId).emit("messageDeleted", deletePayload);
        console.log("📡 Delete event broadcasted to room:", roomId);

      } catch (err) {
        console.error("❌ Delete message error:", err);
        socket.emit("error", {
          message: "Failed to delete message",
          error: err.message
        });
      }
    });

    // User disconnect
    socket.on("disconnect", () => {
      console.log("👋 User disconnected:", socket.userId);

      if (socket.currentRoom) {
        const roomId = socket.currentRoom;

        // Remove from online users
        if (roomUsers.has(roomId)) {
          roomUsers.get(roomId).delete(socket.userId);

          io.to(roomId).emit(
            "onlineUsers",
            Array.from(roomUsers.get(roomId))
          );

          console.log(`👋 User ${socket.userId} left room ${roomId}`);

          // Clean up empty rooms
          if (roomUsers.get(roomId).size === 0) {
            roomUsers.delete(roomId);
            console.log(`🧹 Cleaned up empty room: ${roomId}`);
          }
        }

        // Clear typing indicator
        const roomTypingUsers = typingUsers.get(roomId);
        if (roomTypingUsers) {
          roomTypingUsers.delete(socket.userId);

          // Clear timeout
          const typingKey = `${socket.userId}-${roomId}`;
          if (typingTimeouts.has(typingKey)) {
            clearTimeout(typingTimeouts.get(typingKey));
            typingTimeouts.delete(typingKey);
          }

          // Notify others
          io.to(roomId).emit("typingUpdate", {
            typingUsers: Array.from(roomTypingUsers.values())
          });

          // Clean up empty typing room
          if (roomTypingUsers.size === 0) {
            typingUsers.delete(roomId);
          }
        }
      }
    });
  });
};