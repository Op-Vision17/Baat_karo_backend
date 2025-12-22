const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    roomCode: {
      type: String,
      unique: true,
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    members: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }] // 🔥 ADD MEMBERS ARRAY
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);