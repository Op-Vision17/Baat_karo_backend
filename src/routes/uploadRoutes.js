const router = require("express").Router();
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");
const streamifier = require('streamifier'); // Need to install this

router.post(
  "/image",
  auth,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image provided" });
      }

      // 🔥 FIX: Proper stream upload
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: "baatkro/chat",
          resource_type: "auto" // Allows any file type
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

module.exports = router;