const mongoose = require("mongoose");
const { Schema } = mongoose;

const LoginHistorySchema = mongoose.Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  username: String,
  ip: String,
  device: String,
  loggedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("LoginHistory", LoginHistorySchema);
