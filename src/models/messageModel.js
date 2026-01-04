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
    // ✅ DELETE FUNCTIONALITY FIELDS
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


module.exports = mongoose.model("Message", messageSchema);