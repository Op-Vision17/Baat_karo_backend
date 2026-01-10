const Call = require("../models/callModel");
const Room = require("../models/roomModel");

// Get call history for a room
exports.getRoomCallHistory = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room || !room.members.includes(req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const calls = await Call.find({ roomId })
      .populate("initiator", "name profilePhoto")
      .populate("participants.user", "name profilePhoto")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(calls);
  } catch (err) {
    console.error("Get call history error:", err);
    res.status(500).json({ message: "Failed to get call history" });
  }
};

// Get call details by ID
exports.getCallDetails = async (req, res) => {
  try {
    const { callId } = req.params;

    const call = await Call.findById(callId)
      .populate("initiator", "name profilePhoto")
      .populate("participants.user", "name profilePhoto")
      .populate("roomId", "name roomPhoto");

    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }

    res.json(call);
  } catch (err) {
    console.error("Get call details error:", err);
    res.status(500).json({ message: "Failed to get call details" });
  }
};

// ✅ NEW: Check if room has active call
exports.checkRoomActiveCall = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Verify user has access to this room
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (!room.members.includes(req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Find active call in this room
    const activeCall = await Call.findOne({
      roomId,
      status: { $in: ['ringing', 'ongoing'] },
      endTime: null
    })
      .populate('initiator', 'name profilePhoto email')
      .sort({ createdAt: -1 })
      .limit(1);

    if (!activeCall) {
      return res.json({
        hasActiveCall: false,
        call: null
      });
    }

    // Get participants who are still in the call
    const activeParticipants = activeCall.participants.filter(
      p => p.callStatus === 'joined' && !p.leftAt
    );

    res.json({
      hasActiveCall: true,
      call: {
        id: activeCall._id,
        roomId: activeCall.roomId,
        callType: activeCall.callType,
        status: activeCall.status,
        caller: {
          id: activeCall.initiator._id,
          name: activeCall.initiator.name,
          email: activeCall.initiator.email,
          avatar: activeCall.initiator.profilePhoto || null
        },
        participantCount: activeParticipants.length,
        startTime: activeCall.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error checking active call:', error);
    res.status(500).json({
      message: 'Failed to check active call',
      error: error.message
    });
  }
};

// ✅ NEW: Get all active calls for user's rooms
exports.getMyActiveRoomCalls = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's rooms
    const userRooms = await Room.find({
      members: userId
    }).select('_id name');

    const roomIds = userRooms.map(r => r._id);

    // Find active calls in these rooms
    const activeCalls = await Call.find({
      roomId: { $in: roomIds },
      status: { $in: ['ringing', 'ongoing'] },
      endTime: null
    })
      .populate('initiator', 'name profilePhoto email')
      .sort({ createdAt: -1 });

    const callsWithRoomInfo = activeCalls.map(call => {
      const room = userRooms.find(r => r._id.toString() === call.roomId.toString());
      const activeParticipants = call.participants.filter(
        p => p.callStatus === 'joined' && !p.leftAt
      );

      return {
        id: call._id,
        roomId: call.roomId,
        roomName: room ? room.name : 'Unknown Room',
        callType: call.callType,
        status: call.status,
        caller: {
          id: call.initiator._id,
          name: call.initiator.name,
          email: call.initiator.email,
          avatar: call.initiator.profilePhoto || null
        },
        participantCount: activeParticipants.length,
        startTime: call.createdAt
      };
    });

    res.json({
      activeCalls: callsWithRoomInfo
    });

  } catch (error) {
    console.error('❌ Error getting active calls:', error);
    res.status(500).json({
      message: 'Failed to get active calls',
      error: error.message
    });
  }
};