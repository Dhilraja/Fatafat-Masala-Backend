const mongoose = require("mongoose");
const { Schema } = mongoose;

const CartItemSchema = mongoose.Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product" },

  name: String,
  price: Number,
  image: String,

  quantity: { type: Number, min: 1 },
});

const CartSchema = mongoose.Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", unique: true },

  items: [CartItemSchema],

  updatedAt: { type: Date, default: Date.now },
});

// CartSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model("Cart", CartSchema);
