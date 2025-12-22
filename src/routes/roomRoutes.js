const router = require("express").Router();
const auth = require("../middleware/auth");
const {
  createRoom,
  joinRoomByCode,
  getUserRooms,
  getRoomDetails,
  deleteRoom,
  leaveRoom,
  getRoomMessages
} = require("../controllers/roomController");

router.post("/create", auth, createRoom);
router.post("/join", auth, joinRoomByCode);
router.get("/my-rooms", auth, getUserRooms); 
router.get("/:roomId", auth, getRoomDetails); 
router.delete("/:roomId", auth, deleteRoom); 
router.post("/:roomId/leave", auth, leaveRoom); 
router.get("/:roomId/messages", auth, getRoomMessages);

module.exports = router;