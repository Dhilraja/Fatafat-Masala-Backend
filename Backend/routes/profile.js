const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const User = require("../Models/user");
const Order = require("../Models/order");
const authMiddleware = require("../middleware/auth");

router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const orders = await Order.find({ userId: req.user.userId }).populate({
      path: "items.productId",
      select: "images",
    });
    const profile = { userDetails: user, orders: orders };
    return res.status(200).json({
      message: "User profile details fetched successfully",
      data: profile,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error in fetching profile details" });
  }
});

router.post("/address", authMiddleware, async (req, res) => {
  try {
    const { _id, name, line1, line2, city, state, pincode, phone, flag } =
      req.body;
    const address = {
      name: name.trim(),
      line1: line1.trim(),
      line2: line2.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      phone: phone ? phone.trim() : undefined,
    };
    if (flag) {
      await User.updateOne(
        { _id: req.user.userId },
        { $push: { addresses: address } },
      );
      return res.status(200).json({ message: "Address added successfully" });
    } else {
      const result = await User.updateOne(
        { _id: req.user.userId, "addresses._id": _id },
        {
          $set: {
            "addresses.$.name": address.name,
            "addresses.$.line1": address.line1,
            "addresses.$.line2": address.line2,
            "addresses.$.city": address.city,
            "addresses.$.state": address.state,
            "addresses.$.pincode": address.pincode,
            "addresses.$.phone": address.phone,
          },
        },
      );
      console.log(result);
      return res.status(200).json({ message: "Address updated successfully" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error in adding or updating address" });
  }
});

router.delete("/delete-address", authMiddleware, async (req, res) => {
  const { id } = req.query;
  try {
    await User.updateOne(
      { _id: req.user.userId },
      { $pull: { addresses: { _id: id } } },
    );
    return res.status(200).json({ message: "Address deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error in deleting address" });
  }
});

router.post("/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Current password is incorrect" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updateOne(
      { _id: req.user.userId },
      { $set: { password: hashedPassword } },
    );
    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error in changing password" });
  }
});

module.exports = router;
