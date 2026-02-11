const mongoose = require("mongoose");

const OtpSchema = mongoose.Schema({
  email: { type: String, required: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  used: Boolean,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Otp", OtpSchema);
