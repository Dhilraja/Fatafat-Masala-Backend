const express = require("express");
const router = express.Router();
const Order = require("../Models/order");
const Cart = require("../Models/cart");
const authMiddleware = require("../middleware/auth");

function generateOrderId() {
  const prefix = "FM";
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const datePart = `${year}${month}${day}`;
  const randomPart = Math.floor(1000 + Math.random() * 9000); // 4 digit
  return `${prefix}-${datePart}-${randomPart}`;
}

router.post("/place-order", authMiddleware, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.userId });
    let totalAmount = 0;
    console.log("Cart ---> ", cart);
    const items = cart?.items?.map((ele) => {
      totalAmount += ele.price * ele.quantity;
      return {
        productId: ele.productId,
        name: ele.name,
        price: ele.price,
        quantity: ele.quantity,
        total: ele.price * ele.quantity,
      };
    });
    const deliveryFees = totalAmount >= 299 ? 0 : 50;
    totalAmount = totalAmount + deliveryFees;
    const shippingAddress = req.body.address;
    let order;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        const orderNumber = generateOrderId();
        console.log("Items ---> ", items);
        order = await Order.create({
          orderNumber,
          userId: req.user.userId,
          items,
          totalAmount,
          shippingAddress,
        });
        if (order) {
          await Cart.deleteOne({ userId: req.user.userId });
          return res
            .status(200)
            .json({ message: "Order placed successfully", data: order });
        } else {
          return res.status(500).json({ message: "Error in placing order" });
        }
      } catch (err) {
        if (err.code === 11000) {
          attempts++;
        } else {
          throw err;
        }
      }
    }

    throw new Error("Could not generate unique Order ID");
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error in placing order" });
  }
});

router.get("/get-orders", authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find().populate("userId", "name");
    return res
      .status(200)
      .json({ message: "Orders fetched successfully", data: orders });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error in fetching orders" });
  }
});

router.patch("/update-order-status", authMiddleware, async (req, res) => {
  try {
    const { id, status } = req.body;
    const validStatuses = [
      "PLACED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ];
    if (!validStatuses.includes(status))
      return res.status(400).json({ message: "Invalid status" });
    await Order.findByIdAndUpdate(id, { $set: { status } });
    return res
      .status(200)
      .json({ message: "Order status updated successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error updating order status" });
  }
});

router.get("/order-details", authMiddleware, async (req, res) => {
  try {
    const { id } = req.query;
    console.log(id);
    const order = await Order.findOne({ _id: id }).populate(
      "items.productId",
      "images",
    );
    if (!order) {
      return res.status(500).json({ message: "Order cannot be found!" });
    }
    return res
      .status(200)
      .json({ message: "Order details fetched successfully!", data: order });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error in fetching order details" });
  }
});

module.exports = router;
