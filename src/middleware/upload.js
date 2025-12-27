const multer = require("multer");
const storage = multer.memoryStorage();


const fileFilter = (req, file, cb) => {
  // Accept images and audio files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else if (file.mimetype === 'video/mp4' || file.mimetype === 'video/webm') {
    // Some browsers send audio as video/webm
    cb(null, true);
  } else {
    cb(new Error('Only images and audio files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB (voice messages can be larger)
  },
  fileFilter: fileFilter
});

module.exports = upload;