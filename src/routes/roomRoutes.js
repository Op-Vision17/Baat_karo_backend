const router = require("express").Router();
const auth = require("../middleware/auth");
const { handleValidation } = require("../middleware/validate");
const roomValidators = require("../validators/roomValidators");
const {
  createRoom,
  joinRoomByCode,
  getUserRooms,
  getRoomDetails,
  updateRoom,
  deleteRoom,
  leaveRoom,
  getRoomMessages
} = require("../controllers/roomController");

router.post("/create", auth, ...roomValidators.createRoom, handleValidation, createRoom);
router.post("/join", auth, ...roomValidators.joinRoom, handleValidation, joinRoomByCode);
router.get("/my-rooms", auth, getUserRooms);
router.get("/:roomId", auth, ...roomValidators.roomIdParam, handleValidation, getRoomDetails);
router.put("/:roomId", auth, ...roomValidators.updateRoom, handleValidation, updateRoom);
router.delete("/:roomId", auth, ...roomValidators.roomIdParam, handleValidation, deleteRoom);
router.post("/:roomId/leave", auth, ...roomValidators.roomIdParam, handleValidation, leaveRoom);
router.get("/:roomId/messages", auth, ...roomValidators.roomIdParam, handleValidation, getRoomMessages);

module.exports = router;