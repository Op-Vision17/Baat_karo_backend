const Call = require("../models/callModel");
const Room = require("../models/roomModel");

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