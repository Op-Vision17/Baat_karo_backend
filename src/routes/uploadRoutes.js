const router = require("express").Router();
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");
const streamifier = require('streamifier');

// Image upload
router.post(
  "/image",
  auth,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image provided" });
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: "baatkro/chat/images",
          resource_type: "image"
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary error:", error);
            return res.status(500).json({ message: "Upload failed", error: error.message });
          }
          res.json({ 
            imageUrl: result.secure_url,
            publicId: result.public_id 
          });
        }
      );

      streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
      
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ message: "Image upload error", error: err.message });
    }
  }
);

// 🎤 Voice message upload
router.post(
  "/voice",
  auth,
  upload.single("voice"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No voice file provided" });
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: "baatkro/chat/voice",
          resource_type: "video", // Cloudinary uses "video" for audio files
          format: "mp3" // Convert to mp3 for consistency
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary voice error:", error);
            return res.status(500).json({ message: "Voice upload failed", error: error.message });
          }
          res.json({ 
            voiceUrl: result.secure_url,
            publicId: result.public_id,
            duration: result.duration // Cloudinary provides audio duration
          });
        }
      );

      streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
      
    } catch (err) {
      console.error("Voice upload error:", err);
      res.status(500).json({ message: "Voice upload error", error: err.message });
    }
  }
);

module.exports = router;