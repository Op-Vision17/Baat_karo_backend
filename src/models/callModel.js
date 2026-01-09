const mongoose = require("mongoose");

const callSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    callType: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },
    initiator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        leftAt: {
          type: Date,
          default: null,
        },
        callStatus: {
          type: String,
          enum: ["joined", "missed", "rejected", "left"],
          default: "joined",
        },
      },
    ],
    status: {
      type: String,
      enum: ["ringing", "ongoing", "ended", "cancelled"],
      default: "ringing",
      index: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number, // in seconds
      default: 0,
    },
    // Track who missed the call
    missedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Track who rejected the call
    rejectedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Was call answered by anyone
    wasAnswered: {
      type: Boolean,
      default: false,
    },
  },
  { 
    timestamps: true,
    // Index for faster queries
    indexes: [
      { roomId: 1, createdAt: -1 },
      { initiator: 1, createdAt: -1 },
    ]
  }
);

// Calculate duration before saving
callSchema.pre("save", function (next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  
  // Mark as answered if any participant joined
  if (this.participants.some(p => p.callStatus === "joined")) {
    this.wasAnswered = true;
  }
  
  next();
});

// Static method to get active call for a room
callSchema.statics.getActiveCall = function(roomId) {
  return this.findOne({
    roomId,
    status: { $in: ["ringing", "ongoing"] }
  });
};

module.exports = mongoose.model("Call", callSchema);