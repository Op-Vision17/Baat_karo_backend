const Call = require("../models/callModel");
const Room = require("../models/roomModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");

module.exports = (io) => {
  // 🔥 In-memory tracking for active calls
  const activeCalls = new Map();
  // Structure: roomId -> { callId, participants: Set(userId), startTime, callType, status }

  async function sendActiveCallsToUser(socket) {
    try {
      console.log(`📞 Checking active calls for user ${socket.userId}`);

      // Get all rooms the user is a member of
      const userRooms = await Room.find({ members: socket.userId })
        .select('_id name');

      if (userRooms.length === 0) {
        console.log(`   No rooms found for user ${socket.userId}`);
        return;
      }

      console.log(`   User is in ${userRooms.length} rooms`);

      // Check each room for active calls
      for (const room of userRooms) {
        const roomId = room._id.toString();
        const activeCall = activeCalls.get(roomId);

        // If there's an active call in this room
        if (activeCall && 
            (activeCall.status === 'ringing' || activeCall.status === 'ongoing')) {
          
          console.log(`   ✅ Found active call in room ${room.name}`);

          try {
            // Get call details from database
            const call = await Call.findById(activeCall.callId)
              .populate('initiator', 'name profilePhoto email');

            if (call) {
              // Get caller info
              const caller = await User.findById(call.initiator._id || call.initiator)
                .select('name profilePhoto email');

              // Send incoming_call event to this specific user
              socket.emit('incoming_call', {
                callId: call._id,
                roomId: roomId,
                roomName: room.name,
                callType: call.callType,
                status: activeCall.status,
                caller: {
                  id: caller._id,
                  name: caller.name,
                  avatar: caller.profilePhoto || null,
                  email: caller.email
                },
                participants: activeCall.participants.size,
                timestamp: call.createdAt || new Date()
              });

              console.log(`   📤 Sent active call to user ${socket.userId}`);
            }
          } catch (err) {
            console.error(`   ❌ Error fetching call details: ${err}`);
          }
        }
      }
    } catch (err) {
      console.error('❌ Error in sendActiveCallsToUser:', err);
    }
  }


  io.on("connection", (socket) => {
    console.log(`🔌 User ${socket.userId} connected for calls`);

    sendActiveCallsToUser(socket);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📞 1. START CALL
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    socket.on("start_call", async ({ roomId, callType }) => {
      try {
        console.log(`📞 User ${socket.userId} starting ${callType} call in room ${roomId}`);

        // Validate room ID
        if (!mongoose.Types.ObjectId.isValid(roomId)) {
          socket.emit("call_error", { message: "Invalid room ID" });
          return;
        }

        // Check if room exists and user is member
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

        // Check if call already active in this room
        if (activeCalls.has(roomId)) {
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

        // Add to active calls in memory
        activeCalls.set(roomId, {
          callId: call._id.toString(),
          participants: new Set([socket.userId]),
          startTime: new Date(),
          callType,
          status: "ringing",
        });

        // Join socket room for call
        socket.join(roomId);

        // Get caller info
        const caller = await User.findById(socket.userId).select("name profilePhoto email");

        // Notify all room members (except caller)
        socket.to(roomId).emit("incoming_call", {
          callId: call._id,
          roomId,
          callType,
          caller: {
            id: caller._id,
            name: caller.name,
            avatar: caller.profilePhoto || null,
            email: caller.email,
          },
          roomName: room.name,
          timestamp: new Date(),
        });

        // Confirm to caller
        socket.emit("call_started", {
          success: true,
          callId: call._id,
          roomId,
          callType,
        });

        console.log(`✅ Call ${call._id} started in room ${roomId}`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 🔔 SEND FCM PUSH NOTIFICATION
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        try {
          const { sendCallNotification } = require("../services/notificationService");

          // Get all members except caller
          const otherMembers = room.members.filter(
            (m) => m._id.toString() !== socket.userId
          );

          if (otherMembers.length > 0) {
            // Get users with notifications enabled
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

                  // Clean up invalid tokens
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
              } else {
                console.log("ℹ️ No FCM tokens found for members");
              }
            } else {
              console.log("ℹ️ No members with call notifications enabled");
            }
          }
        } catch (notifError) {
          console.error("❌ Call notification error:", notifError);
          // Don't fail the call if notification fails
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

        // Add user to participants in memory
        activeCall.participants.add(socket.userId);

        // Update status to ongoing if it was ringing
        if (activeCall.status === "ringing") {
          activeCall.status = "ongoing";
        }

        // Update database
        const call = await Call.findById(callId);
        if (call) {
          // Check if user already in participants
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
            // Rejoin case (if user left and came back)
            existingParticipant.callStatus = "joined";
            existingParticipant.leftAt = null;
          }

          call.status = "ongoing";
          call.wasAnswered = true;
          await call.save();
        }

        // Join socket room
        socket.join(roomId);

        // Get user info
        const user = await User.findById(socket.userId).select("name profilePhoto email");

        // Notify others in call
        socket.to(roomId).emit("user_joined_call", {
          user: {
            id: user._id,
            name: user.name,
            avatar: user.profilePhoto || null,
            email: user.email,
          },
          totalParticipants: activeCall.participants.size,
          callId: activeCall.callId,
        });

        // Send current participants to new joiner
        const participantIds = Array.from(activeCall.participants);
        const participantUsers = await User.find({
          _id: { $in: participantIds },
        }).select("name profilePhoto email");

        socket.emit("call_participants", {
          participants: participantUsers.map((u) => ({
            id: u._id,
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

        // Update database
        const call = await Call.findById(callId);
        if (call) {
          // Add to rejectedBy array
          if (!call.rejectedBy.includes(socket.userId)) {
            call.rejectedBy.push(socket.userId);
          }

          // Update or add participant status
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

        // Notify others (caller mainly)
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

        // Remove from participants in memory
        activeCall.participants.delete(socket.userId);

        // Update database
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

        // Leave socket room
        socket.leave(roomId);

        // Get user info
        const user = await User.findById(socket.userId).select("name");

        // Notify others
        socket.to(roomId).emit("user_left_call", {
          user: {
            id: socket.userId,
            name: user ? user.name : "Unknown",
          },
          totalParticipants: activeCall.participants.size,
          callId: activeCall.callId,
        });

        console.log(`✅ User ${user?.name || socket.userId} left. Remaining: ${activeCall.participants.size}`);

        // If last person left, end call
        if (activeCall.participants.size === 0) {
          await endCall(roomId, callId, io);
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

      // Check if user was in any call
      for (const [roomId, activeCall] of activeCalls.entries()) {
        if (activeCall.participants.has(socket.userId)) {
          console.log(`⚠️ User ${socket.userId} disconnected from active call in ${roomId}`);

          // Wait 10 seconds before auto-removing (reconnection grace period)
          setTimeout(async () => {
            // Double-check if still disconnected and call still active
            const currentCall = activeCalls.get(roomId);
            if (currentCall && currentCall.participants.has(socket.userId)) {
              console.log(`🚪 Auto-removing ${socket.userId} from call after disconnect timeout`);

              currentCall.participants.delete(socket.userId);

              // Update database
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

              // Notify others
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

              // End call if empty
              if (currentCall.participants.size === 0) {
                await endCall(roomId, currentCall.callId, io);
              }
            }
          }, 10000); // 10 second grace period
        }
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🏁 HELPER: END CALL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async function endCall(roomId, callId, io) {
    try {
      console.log(`🏁 Ending call ${callId} in room ${roomId}`);

      // Remove from active calls
      const activeCall = activeCalls.get(roomId);
      if (activeCall) {
        activeCalls.delete(roomId);
      }

      // Update database
      const call = await Call.findById(callId);
      if (call) {
        call.status = "ended";
        call.endTime = new Date();

        // Mark users who never joined as "missed"
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

          // Add missed participants to participants array
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

        // Send missed call notifications
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

                console.log(`📵 Sent missed call notifications to ${fcmTokens.length} devices`);
              }
            }
          } catch (notifError) {
            console.error("❌ Missed call notification error:", notifError);
          }
        }
      }

      // Notify all participants
      io.to(roomId).emit("call_ended", {
        callId,
        roomId,
        timestamp: new Date(),
      });

      console.log(`✅ Call ${callId} ended successfully`);
    } catch (err) {
      console.error("❌ End call error:", err);
    }
  }
};