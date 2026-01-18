// backend/src/socket/callSocket.js - WITH CALL MESSAGES
const Call = require("../models/callModel");
const Room = require("../models/roomModel");
const User = require("../models/userModel");
const Message = require("../models/messageModel"); // ✅ ADDED
const mongoose = require("mongoose");

module.exports = (io, activeCalls) => {
  console.log('🔥 callSocket initialized with SHARED activeCalls Map');

  // ✅ Send active calls to user when they connect
  async function sendActiveCallsToUser(socket) {
    try {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📞 Checking active calls for user ${socket.userId}`);

      const userRooms = await Room.find({ members: socket.userId })
        .select('_id name');

      if (userRooms.length === 0) {
        console.log(`   No rooms found for user ${socket.userId}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        return;
      }

      console.log(`   User is in ${userRooms.length} rooms`);
      console.log(`   Active calls in system: ${activeCalls.size}`);

      for (const room of userRooms) {
        const roomId = room._id.toString();
        const activeCall = activeCalls.get(roomId);

        if (activeCall && 
            (activeCall.status === 'ringing' || activeCall.status === 'ongoing')) {
          
          console.log(`   ✅ Found active ${activeCall.status} call in room ${room.name}`);

          try {
            const call = await Call.findById(activeCall.callId)
              .populate('initiator', 'name profilePhoto email');

            if (call) {
              const caller = await User.findById(call.initiator._id || call.initiator)
                .select('name profilePhoto email');

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

              console.log(`   📤 Sent active call event to user ${socket.userId}`);
            }
          } catch (err) {
            console.error(`   ❌ Error fetching call details: ${err}`);
          }
        }
      }
      
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    } catch (err) {
      console.error('❌ Error in sendActiveCallsToUser:', err);
    }
  }

  io.on("connection", (socket) => {
    console.log(`🔌 User ${socket.userId} connected for calls`);

    setTimeout(() => {
      sendActiveCallsToUser(socket);
    }, 500);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📞 1. START CALL
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    socket.on("start_call", async ({ roomId, callType }) => {
      try {
        console.log(`📞 User ${socket.userId} starting ${callType} call in room ${roomId}`);

        if (!mongoose.Types.ObjectId.isValid(roomId)) {
          socket.emit("call_error", { message: "Invalid room ID" });
          return;
        }

        const room = await Room.findById(roomId).populate("members", "name profilePhoto email");
        if (!room) {
          socket.emit("call_error", { message: "Room not found" });
          return;
        }

        const isMember = room.members.some((m) => m._id.toString() === socket.userId);
        if (!isMember) {
          socket.emit("call_error", { message: "Access denied" });
          return;
        }

        if (activeCalls.has(roomId)) {
          console.log(`⚠️ Call already in progress in room ${roomId}`);
          socket.emit("call_error", { message: "Call already in progress" });
          return;
        }

        // Create call record in database
        const call = await Call.create({
          roomId,
          callType,
          initiator: socket.userId,
          status: "ringing",
          participants: [
            {
              user: socket.userId,
              joinedAt: new Date(),
              callStatus: "joined",
            },
          ],
        });

        // Add to active calls in memory (SHARED Map)
        activeCalls.set(roomId, {
          callId: call._id.toString(),
          participants: new Set([socket.userId]),
          startTime: new Date(),
          callType,
          status: "ringing",
        });

        console.log(`✅ Call added to shared activeCalls Map`);
        console.log(`   Total active calls: ${activeCalls.size}`);

        socket.join(roomId);

        const caller = await User.findById(socket.userId).select("name profilePhoto email");

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ✅ CREATE CALL MESSAGE IN CHAT
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        try {
          const callMessage = await Message.createCallMessage(
            roomId,
            call._id,
            callType,
            socket.userId,
            caller.name,
            "started"
          );

          // Populate sender for broadcast
          const populatedMessage = await Message.findById(callMessage._id)
            .populate("sender", "name email profilePhoto");

          // Broadcast call message to room
          io.to(roomId).emit("receiveMessage", {
            _id: populatedMessage._id,
            roomId: populatedMessage.roomId,
            sender: {
              _id: populatedMessage.sender._id,
              name: populatedMessage.sender.name,
              email: populatedMessage.sender.email,
              profilePhoto: populatedMessage.sender.profilePhoto || null
            },
            messageType: populatedMessage.messageType,
            callData: populatedMessage.callData,
            isDeleted: populatedMessage.isDeleted,
            createdAt: populatedMessage.createdAt
          });

          console.log(`💬 Call message created and broadcasted`);
        } catch (msgError) {
          console.error("❌ Error creating call message:", msgError);
        }

        // Notify all room members (except caller)
        socket.to(roomId).emit("incoming_call", {
          callId: call._id.toString(),
          roomId,
          callType,
          caller: {
            id: caller._id.toString(),
            name: caller.name,
            avatar: caller.profilePhoto || null,
            email: caller.email,
          },
          roomName: room.name,
          status: 'ringing',
          startTime: call.createdAt,
          timestamp: new Date(),
        });

        socket.emit("call_started", {
          success: true,
          callId: call._id.toString(),
          roomId,
          callType,
        });

        console.log(`✅ Call ${call._id} started in room ${roomId}`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 🔔 SEND FCM PUSH NOTIFICATION
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        try {
          const { sendCallNotification } = require("../services/notificationService");

          const otherMembers = room.members.filter(
            (m) => m._id.toString() !== socket.userId
          );

          if (otherMembers.length > 0) {
            const memberIds = otherMembers.map((m) => m._id);
            const usersWithTokens = await User.find({
              _id: { $in: memberIds },
              "notificationSettings.enabled": true,
              "notificationSettings.callNotifications": true,
            });

            if (usersWithTokens.length > 0) {
              const fcmTokens = [];
              const userTokenMap = new Map();

              usersWithTokens.forEach((user) => {
                const tokens = user.getActiveFcmTokens();
                tokens.forEach((token) => {
                  fcmTokens.push(token);
                  userTokenMap.set(token, user._id);
                });
              });

              if (fcmTokens.length > 0) {
                console.log(`📢 Sending call notification to ${fcmTokens.length} devices`);

                const result = await sendCallNotification(
                  fcmTokens,
                  caller.name,
                  room.name,
                  callType,
                  roomId,
                  call._id.toString(),
                  caller.profilePhoto || null
                );

                if (result.success) {
                  console.log(`✅ Sent ${result.successCount || 1} call notification(s)`);

                  if (result.invalidTokens && result.invalidTokens.length > 0) {
                    console.log(`🧹 Cleaning up ${result.invalidTokens.length} invalid tokens`);

                    const userInvalidTokens = new Map();
                    result.invalidTokens.forEach((token) => {
                      const userId = userTokenMap.get(token);
                      if (userId) {
                        if (!userInvalidTokens.has(userId.toString())) {
                          userInvalidTokens.set(userId.toString(), []);
                        }
                        userInvalidTokens.get(userId.toString()).push(token);
                      }
                    });

                    for (const [userId, tokens] of userInvalidTokens) {
                      const user = usersWithTokens.find((u) => u._id.toString() === userId);
                      if (user) {
                        await user.removeInvalidTokens(tokens);
                      }
                    }
                  }
                } else {
                  console.error("❌ Failed to send call notifications:", result.error);
                }
              }
            }
          }
        } catch (notifError) {
          console.error("❌ Call notification error:", notifError);
        }
      } catch (err) {
        console.error("❌ Start call error:", err);
        socket.emit("call_error", {
          message: "Failed to start call",
          error: err.message,
        });
      }
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ✅ 2. JOIN CALL (Accept)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    socket.on("join_call", async ({ roomId, callId }) => {
      try {
        console.log(`✅ User ${socket.userId} joining call ${callId} in room ${roomId}`);

        const activeCall = activeCalls.get(roomId);
        if (!activeCall) {
          socket.emit("call_error", { message: "Call not found or ended" });
          return;
        }

        activeCall.participants.add(socket.userId);

        if (activeCall.status === "ringing") {
          activeCall.status = "ongoing";
          
          // ✅ UPDATE CALL MESSAGE TO "ONGOING"
          try {
            const updatedMessage = await Message.updateCallMessage(callId, {
              status: "ongoing",
              participantCount: activeCall.participants.size,
              wasAnswered: true
            });

            if (updatedMessage) {
              const populatedMessage = await Message.findById(updatedMessage._id)
                .populate("sender", "name email profilePhoto");

              io.to(roomId).emit("messageUpdated", {
                _id: populatedMessage._id,
                roomId: populatedMessage.roomId,
                sender: {
                  _id: populatedMessage.sender._id,
                  name: populatedMessage.sender.name,
                  email: populatedMessage.sender.email,
                  profilePhoto: populatedMessage.sender.profilePhoto || null
                },
                messageType: populatedMessage.messageType,
                callData: populatedMessage.callData,
                isDeleted: populatedMessage.isDeleted,
                createdAt: populatedMessage.createdAt
              });

              console.log(`💬 Call message updated to ongoing`);
            }
          } catch (msgError) {
            console.error("❌ Error updating call message:", msgError);
          }
        }

        const call = await Call.findById(callId);
        if (call) {
          const existingParticipant = call.participants.find(
            (p) => p.user.toString() === socket.userId
          );

          if (!existingParticipant) {
            call.participants.push({
              user: socket.userId,
              joinedAt: new Date(),
              callStatus: "joined",
            });
          } else {
            existingParticipant.callStatus = "joined";
            existingParticipant.leftAt = null;
          }

          call.status = "ongoing";
          call.wasAnswered = true;
          await call.save();
        }

        socket.join(roomId);

        const user = await User.findById(socket.userId).select("name profilePhoto email");

        socket.to(roomId).emit("user_joined_call", {
          user: {
            id: user._id.toString(),
            name: user.name,
            avatar: user.profilePhoto || null,
            email: user.email,
          },
          totalParticipants: activeCall.participants.size,
          callId: activeCall.callId,
        });

        const participantIds = Array.from(activeCall.participants);
        const participantUsers = await User.find({
          _id: { $in: participantIds },
        }).select("name profilePhoto email");

        socket.emit("call_participants", {
          participants: participantUsers.map((u) => ({
            id: u._id.toString(),
            name: u.name,
            avatar: u.profilePhoto || null,
            email: u.email,
          })),
          callId: activeCall.callId,
        });

        console.log(`✅ User ${user.name} joined call. Total: ${activeCall.participants.size}`);
      } catch (err) {
        console.error("❌ Join call error:", err);
        socket.emit("call_error", {
          message: "Failed to join call",
          error: err.message,
        });
      }
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ❌ 3. REJECT CALL
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    socket.on("reject_call", async ({ roomId, callId }) => {
      try {
        console.log(`❌ User ${socket.userId} rejected call ${callId} in room ${roomId}`);

        const call = await Call.findById(callId);
        if (call) {
          if (!call.rejectedBy.includes(socket.userId)) {
            call.rejectedBy.push(socket.userId);
          }

          const participant = call.participants.find(
            (p) => p.user.toString() === socket.userId
          );

          if (participant) {
            participant.callStatus = "rejected";
          } else {
            call.participants.push({
              user: socket.userId,
              callStatus: "rejected",
              joinedAt: new Date(),
            });
          }

          await call.save();
        }

        const user = await User.findById(socket.userId).select("name");
        socket.to(roomId).emit("call_rejected", {
          user: {
            id: socket.userId,
            name: user ? user.name : "Unknown",
          },
          callId,
        });

        console.log(`✅ User ${user?.name || socket.userId} rejected call ${callId}`);
      } catch (err) {
        console.error("❌ Reject call error:", err);
      }
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🚪 4. LEAVE CALL
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    socket.on("leave_call", async ({ roomId, callId }) => {
      try {
        console.log(`🚪 User ${socket.userId} leaving call ${callId} in room ${roomId}`);

        const activeCall = activeCalls.get(roomId);
        if (!activeCall) {
          console.log("⚠️ Call not found in active calls");
          return;
        }

        activeCall.participants.delete(socket.userId);

        const call = await Call.findById(callId);
        if (call) {
          const participant = call.participants.find(
            (p) => p.user.toString() === socket.userId
          );

          if (participant) {
            participant.leftAt = new Date();
            participant.callStatus = "left";
          }

          await call.save();
        }

        socket.leave(roomId);

        const user = await User.findById(socket.userId).select("name");

        socket.to(roomId).emit("user_left_call", {
          user: {
            id: socket.userId,
            name: user ? user.name : "Unknown",
          },
          totalParticipants: activeCall.participants.size,
          callId: activeCall.callId,
        });

        console.log(`✅ User ${user?.name || socket.userId} left. Remaining: ${activeCall.participants.size}`);

        if (activeCall.participants.size === 0) {
          console.log(`🏁 Last participant left, ending call ${callId}`);
          await endCall(roomId, callId, io, activeCalls);
        }
      } catch (err) {
        console.error("❌ Leave call error:", err);
      }
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔇 5. TOGGLE AUDIO
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    socket.on("toggle_audio", ({ roomId, isMuted }) => {
      console.log(`🔇 User ${socket.userId} ${isMuted ? 'muted' : 'unmuted'} audio`);
      socket.to(roomId).emit("user_audio_changed", {
        userId: socket.userId,
        isMuted,
      });
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📹 6. TOGGLE VIDEO
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    socket.on("toggle_video", ({ roomId, isVideoOff }) => {
      console.log(`📹 User ${socket.userId} turned video ${isVideoOff ? 'off' : 'on'}`);
      socket.to(roomId).emit("user_video_changed", {
        userId: socket.userId,
        isVideoOff,
      });
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔌 7. DISCONNECT (Auto-leave with grace period)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    socket.on("disconnect", async () => {
      console.log(`🔌 User ${socket.userId} disconnected`);

      for (const [roomId, activeCall] of activeCalls.entries()) {
        if (activeCall.participants.has(socket.userId)) {
          console.log(`⚠️ User ${socket.userId} disconnected from active call in ${roomId}`);

          setTimeout(async () => {
            const currentCall = activeCalls.get(roomId);
            if (currentCall && currentCall.participants.has(socket.userId)) {
              console.log(`🚪 Auto-removing ${socket.userId} from call after disconnect timeout`);

              currentCall.participants.delete(socket.userId);

              const call = await Call.findById(currentCall.callId);
              if (call) {
                const participant = call.participants.find(
                  (p) => p.user.toString() === socket.userId
                );
                if (participant && participant.callStatus === "joined") {
                  participant.leftAt = new Date();
                  participant.callStatus = "left";
                  await call.save();
                }
              }

              const user = await User.findById(socket.userId).select("name");
              io.to(roomId).emit("user_left_call", {
                user: {
                  id: socket.userId,
                  name: user ? user.name : "Unknown",
                },
                totalParticipants: currentCall.participants.size,
                callId: currentCall.callId,
                reason: "disconnect",
              });

              if (currentCall.participants.size === 0) {
                await endCall(roomId, currentCall.callId, io, activeCalls);
              }
            }
          }, 10000);
        }
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🏁 HELPER: END CALL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async function endCall(roomId, callId, io, activeCalls) {
    try {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🏁 Ending call ${callId} in room ${roomId}`);

      const activeCall = activeCalls.get(roomId);
      if (activeCall) {
        activeCalls.delete(roomId);
        console.log(`   ✅ Removed from shared activeCalls map`);
        console.log(`   Remaining active calls: ${activeCalls.size}`);
      }

      const call = await Call.findById(callId);
      if (call) {
        call.status = "ended";
        call.endTime = new Date();

        const room = await Room.findById(roomId);
        if (room) {
          const joinedUserIds = call.participants
            .filter((p) => p.callStatus === "joined" || p.callStatus === "left")
            .map((p) => p.user.toString());

          const rejectedUserIds = call.rejectedBy.map((id) => id.toString());

          const missedUserIds = room.members
            .map((m) => m.toString())
            .filter(
              (memberId) =>
                !joinedUserIds.includes(memberId) && !rejectedUserIds.includes(memberId)
            );

          call.missedBy = missedUserIds;

          missedUserIds.forEach((userId) => {
            const existingParticipant = call.participants.find(
              (p) => p.user.toString() === userId
            );
            if (!existingParticipant) {
              call.participants.push({
                user: userId,
                callStatus: "missed",
              });
            }
          });
        }

        await call.save();
        console.log(`   ✅ Database updated`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ✅ UPDATE CALL MESSAGE TO "ENDED"
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        try {
          const updatedMessage = await Message.updateCallMessage(callId, {
            status: call.wasAnswered ? "ended" : "missed",
            endTime: call.endTime,
            wasAnswered: call.wasAnswered
          });

          if (updatedMessage) {
            const populatedMessage = await Message.findById(updatedMessage._id)
              .populate("sender", "name email profilePhoto");

            io.to(roomId).emit("messageUpdated", {
              _id: populatedMessage._id,
              roomId: populatedMessage.roomId,
              sender: {
                _id: populatedMessage.sender._id,
                name: populatedMessage.sender.name,
                email: populatedMessage.sender.email,
                profilePhoto: populatedMessage.sender.profilePhoto || null
              },
              messageType: populatedMessage.messageType,
              callData: populatedMessage.callData,
              isDeleted: populatedMessage.isDeleted,
              createdAt: populatedMessage.createdAt
            });

            console.log(`💬 Call message updated to ${call.wasAnswered ? 'ended' : 'missed'}`);
          }
        } catch (msgError) {
          console.error("❌ Error updating call message:", msgError);
        }

        if (call.missedBy.length > 0) {
          try {
            const { sendMissedCallNotification } = require("../services/notificationService");

            const usersWithTokens = await User.find({
              _id: { $in: call.missedBy },
              "notificationSettings.enabled": true,
              "notificationSettings.callNotifications": true,
            });

            if (usersWithTokens.length > 0) {
              const fcmTokens = [];
              usersWithTokens.forEach((user) => {
                const tokens = user.getActiveFcmTokens();
                fcmTokens.push(...tokens);
              });

              if (fcmTokens.length > 0) {
                const caller = await User.findById(call.initiator).select("name");
                const room = await Room.findById(roomId).select("name");

                await sendMissedCallNotification(
                  fcmTokens,
                  caller ? caller.name : "Someone",
                  room ? room.name : "Group",
                  call.callType
                );

                console.log(`   📵 Sent missed call notifications to ${fcmTokens.length} devices`);
              }
            }
          } catch (notifError) {
            console.error("   ❌ Missed call notification error:", notifError);
          }
        }
      }

      io.to(roomId).emit("call_ended", {
        callId: callId,
        roomId: roomId,
        timestamp: new Date(),
      });

      console.log(`   ✅ Emitted call_ended to room ${roomId}`);
      console.log(`✅ Call ${callId} ended successfully`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    } catch (err) {
      console.error("❌ End call error:", err);
    }
  }

  return { endCall };
};