const mongoose = require("mongoose");

const AddressSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    line1: { type: String, required: true },
    line2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const UserSchema = mongoose.Schema({
  username: { type: String, required: true, sparse: true },
  name: { type: String, required: true },
  phone: { type: String, sparse: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["USER", "ADMIN"], default: "USER" },
  addresses: [AddressSchema],
  createdAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date },
});

UserSchema.index({ username: 1 }, { unique: true, sparse: true });
UserSchema.index({ phone: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("User", UserSchema);
