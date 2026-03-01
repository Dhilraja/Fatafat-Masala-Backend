const multer = require("multer");

const storage = multer.memoryStorage(); // store in memory (not disk)

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

module.exports = upload;
