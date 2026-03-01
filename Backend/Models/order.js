const mongoose = require("mongoose");
const { Schema } = mongoose;

const OrderItemSchema = mongoose.Schema({
  productId: Schema.Types.ObjectId,
  name: String,
  price: Number,
  quantity: Number,
  total: Number,
});

const OrderSchema = mongoose.Schema({
  orderNumber: { type: String, unique: true },

  userId: { type: Schema.Types.ObjectId, ref: "User" },

  items: [OrderItemSchema],

  totalAmount: Number,

  shippingAddress: {
    name: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
  },

  status: {
    type: String,
    enum: ["PLACED", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"],
    default: "PLACED",
  },

  paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },

  createdAt: { type: Date, default: Date.now },
});

OrderSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Order", OrderSchema);
