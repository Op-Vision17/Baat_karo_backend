// backend/src/models/messageModel.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MESSAGE TYPE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    messageType: {
      type: String,
      enum: ["text", "image", "voice", "call"],
      default: "text",
    },
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // REGULAR MESSAGE FIELDS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    text: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String,
      default: null,
    },
    voiceUrl: {
      type: String,
      default: null,
    },
    voiceDuration: {
      type: Number,
      default: null,
    },
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CALL MESSAGE FIELDS (NEW)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    callData: {
      callId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Call",
        default: null,
      },
      callType: {
        type: String,
        enum: ["audio", "video"],
        default: null,
      },
      status: {
        type: String,
        enum: ["started", "ongoing", "ended", "missed", "cancelled"],
        default: "started",
      },
      initiatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      initiatorName: {
        type: String,
        default: null,
      },
      startTime: {
        type: Date,
        default: null,
      },
      endTime: {
        type: Date,
        default: null,
      },
      duration: {
        type: Number, // in seconds
        default: null,
      },
      participantCount: {
        type: Number,
        default: 0,
      },
      wasAnswered: {
        type: Boolean,
        default: false,
      },
    },
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DELETE FUNCTIONALITY FIELDS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATIC METHOD: Create Call Message
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
messageSchema.statics.createCallMessage = async function (
  roomId,
  callId,
  callType,
  initiatorId,
  initiatorName,
  status = "started"
) {
  return await this.create({
    roomId,
    sender: initiatorId,
    messageType: "call",
    callData: {
      callId,
      callType,
      status,
      initiatorId,
      initiatorName,
      startTime: new Date(),
      participantCount: 1,
      wasAnswered: false,
    },
  });
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATIC METHOD: Update Call Message
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
messageSchema.statics.updateCallMessage = async function (
  callId,
  updates
) {
  const message = await this.findOne({
    messageType: "call",
    "callData.callId": callId,
  });

  if (!message) {
    return null;
  }

  // Update callData fields
  Object.keys(updates).forEach((key) => {
    if (updates[key] !== undefined) {
      message.callData[key] = updates[key];
    }
  });

  // Calculate duration if endTime is provided
  if (updates.endTime && message.callData.startTime) {
    message.callData.duration = Math.floor(
      (new Date(updates.endTime) - new Date(message.callData.startTime)) / 1000
    );
  }

  await message.save();
  return message;
};

module.exports = mongoose.model("Message", messageSchema);