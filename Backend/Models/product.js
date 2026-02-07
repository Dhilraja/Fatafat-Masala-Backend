const mongoose = require("mongoose");

const ProductSchema = mongoose.Schema({
  name: { type: String, required: true },
  // slug: { type: String, required: true, unique: true },

  description: { type: String, required: true },

  mrp: { type: Number, required: true },
  price: { type: Number, required: true },
  // stock: { type: Number, default: 0 },

  images: [
    {
      url: String,
      alt: String,
    },
  ],

  // categoryId: { type: Types.ObjectId, ref: "Category" },

  isActive: { type: Boolean, default: true },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

module.exports = mongoose.model("Product", ProductSchema);
