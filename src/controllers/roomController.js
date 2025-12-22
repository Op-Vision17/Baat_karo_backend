const Room = require("../models/roomModel");
const Message = require("../models/messageModel");

// Generate random 6-digit room code
const generateRoomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create room
exports.createRoom = async (req, res) => {
  try {
    const { name } = req.body;

    // Generate unique room code
    let roomCode = generateRoomCode();
    let existingRoom = await Room.findOne({ roomCode });
    while (existingRoom) {
      roomCode = generateRoomCode();
      existingRoom = await Room.findOne({ roomCode });
    }

    const room = await Room.create({
      name,
      roomCode,
      createdBy: req.user.id,
      members: [req.user.id] // 🔥 CREATOR IS FIRST MEMBER
    });

    const populatedRoom = await Room.findById(room._id)
      .populate('createdBy', 'name email')
      .populate('members', 'name email');

    res.json(populatedRoom);
  } catch (err) {
    console.error("Create room error:", err);
    res.status(500).json({ message: "Failed to create room" });
  }
};

// Join room by code
exports.joinRoomByCode = async (req, res) => {
  try {
    const { roomCode } = req.body;

    const room = await Room.findOne({ roomCode });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // 🔥 ADD USER TO MEMBERS IF NOT ALREADY
    if (!room.members.includes(req.user.id)) {
      room.members.push(req.user.id);
      await room.save();
    }

    const populatedRoom = await Room.findById(room._id)
      .populate('createdBy', 'name email')
      .populate('members', 'name email');

    res.json(populatedRoom);
  } catch (err) {
    console.error("Join room error:", err);
    res.status(500).json({ message: "Failed to join room" });
  }
};

// 🔥 NEW: Get all rooms for user
exports.getUserRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.user.id })
      .populate('createdBy', 'name email')
      .populate('members', 'name email')
      .sort({ updatedAt: -1 });

    res.json(rooms);
  } catch (err) {
    console.error("Get rooms error:", err);
    res.status(500).json({ message: "Failed to get rooms" });
  }
};

// 🔥 NEW: Get room details with members
exports.getRoomDetails = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId)
      .populate('createdBy', 'name email')
      .populate('members', 'name email');

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Check if user is member
    if (!room.members.some(member => member._id.toString() === req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(room);
  } catch (err) {
    console.error("Get room details error:", err);
    res.status(500).json({ message: "Failed to get room details" });
  }
};

// 🔥 NEW: Delete room (only creator)
exports.deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Check if user is creator
    if (room.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only creator can delete room" });
    }

    // Delete all messages
    await Message.deleteMany({ roomId });

    // Delete room
    await Room.findByIdAndDelete(roomId);

    res.json({ message: "Room deleted successfully" });
  } catch (err) {
    console.error("Delete room error:", err);
    res.status(500).json({ message: "Failed to delete room" });
  }
};

// 🔥 NEW: Leave room
exports.leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Creator cannot leave (must delete room instead)
    if (room.createdBy.toString() === req.user.id) {
      return res.status(400).json({ message: "Creator cannot leave. Delete room instead." });
    }

    // Remove user from members
    room.members = room.members.filter(
      member => member.toString() !== req.user.id
    );
    await room.save();

    res.json({ message: "Left room successfully" });
  } catch (err) {
    console.error("Leave room error:", err);
    res.status(500).json({ message: "Failed to leave room" });
  }
};

// Get message history of room
exports.getRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Check if user is member
    const room = await Room.findById(roomId);
    if (!room || !room.members.includes(req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const messages = await Message.find({ roomId })
      .populate("sender", "name email") // 🔥 POPULATE NAME
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Failed to get messages" });
  }
};