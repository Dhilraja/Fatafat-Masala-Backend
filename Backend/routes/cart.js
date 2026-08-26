const express = require("express");
const router = express.Router();
const Product = require("../Models/product");
const Cart = require("../Models/cart");
const authMiddleware = require("../middleware/auth");

router.get("/cart-products", authMiddleware, async (req, res) => {
  try {
    const cartProducts = await Cart.findOne({ userId: req.user.userId });
    return res.status(200).json({
      message: "Cart products for the user has been fetched successfully",
      data: cartProducts?.items ?? [],
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error in fetching cart products for the user" });
  }
});

router.post("/set-cart-products", authMiddleware, async (req, res) => {
  try {
    const products = req.body;
    let selectedProducts = [];
    for (const product of products) {
      const foundProduct = await Product.findById(product.id);
      if (!foundProduct) {
        return res.status(500).json({
          message: `Cannot find product with given id: ${product.id}`,
        });
      }
      selectedProducts.push({
        productId: foundProduct._id,
        name: foundProduct.name,
        price: foundProduct.price,
        variant: foundProduct.variant,
        quantity: product.quantity,
      });
    }
    const cart = await Cart.findOne({ userId: req.user.userId });
    if (cart) {
      await Cart.findByIdAndUpdate(cart._id, { items: selectedProducts });
      return res
        .status(200)
        .json({ message: "Products added to cart successfully" });
    } else {
      await Cart.create({ userId: req.user.userId, items: selectedProducts });
      return res.status(200).json({
        message: "Cart is created and products added to cart successfully",
      });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Error in adding products to cart" });
  }
});

router.post("/add-remove-cart-products", authMiddleware, async (req, res) => {
  try {
    const { id, flag } = req.body;
    const cart = await Cart.findOne({ userId: req.user.userId });
    const foundProduct = await Product.findById(id);
    if (!cart) {
      const newItem = [
        {
          productId: foundProduct._id,
          name: foundProduct.name,
          price: foundProduct.price,
          variant: foundProduct.variant,
          quantity: 1,
        },
      ];
      await Cart.create({ userId: req.user.userId, items: newItem });
      return res
        .status(200)
        .json({ message: "Cart is created and product is added successfully" });
    }
    const selectedProduct = cart.items.find((ele) => ele.productId == id);
    if (flag) {
      if (!selectedProduct) {
        const item = {
          productId: foundProduct._id,
          name: foundProduct.name,
          price: foundProduct.price,
          variant: foundProduct.variant,
          quantity: 1,
        };
        await Cart.findOneAndUpdate(
          { userId: req.user.userId },
          { $push: { items: item }, $set: { updatedAt: Date.now() } },
        );
        return res.status(200).json({ message: "Product is added to cart" });
      }
      await Cart.findOneAndUpdate(
        { userId: req.user.userId, "items.productId": id },
        { $inc: { "items.$.quantity": 1 }, $set: { updatedAt: Date.now() } },
      );
      return res
        .status(200)
        .json({ message: "Product is incremented to cart" });
    } else {
      if (!selectedProduct)
        return res
          .status(500)
          .json({ message: "Selected product is not found in the cart" });
      if (selectedProduct.quantity == 1) {
        const itemIndex = cart.items.findIndex((item) => item.productId == id);
        cart.items.splice(itemIndex, 1);
        cart.updatedAt = Date.now();
        await cart.save();
      }
      await Cart.findOneAndUpdate(
        { userId: req.user.userId, "items.productId": id },
        { $inc: { "items.$.quantity": -1 }, $set: { updatedAt: Date.now() } },
      );
      return res
        .status(200)
        .json({ message: "Product is decremented from cart" });
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error in adding or removing products in cart" });
  }
});

router.get("/checkout-products", authMiddleware, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.userId }).populate(
      "items.productId",
      "images",
    );
    if (!cart)
      return res.status(500).json({ message: "Cannot find cart for the user" });
    let subtotal = 0;
    let totalQuantity = 0;
    let response = [];
    for (const product of cart.items) {
      const selectedProduct = await Product.findById(product.productId);
      subtotal += product.quantity * selectedProduct.price;
      totalQuantity += product.quantity;
      response.push({
        productId: selectedProduct._id,
        productName: selectedProduct.name,
        price: product.quantity * selectedProduct.price,
        quantity: product.quantity,
        variant: selectedProduct.variant,
        images: product?.productId?.images,
      });
    }
    const deliveryFees = subtotal >= 299 ? 0 : 50;
    const totalPrice = subtotal + deliveryFees;
    return res.status(200).json({
      message: "Checkout products retrieved successfully",
      data: { products: response, totalQuantity, totalPrice, deliveryFees },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error in getting checkout products" });
  }
});

module.exports = router;
