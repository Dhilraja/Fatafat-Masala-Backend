const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const User = require("../Models/user");
const Otp = require("../Models/otp");

router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    const otpNumber = Math.floor(100000 + Math.random() * 900000); // 6-digit
    const otpHash = await bcrypt.hash(otpNumber.toString(), 10);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min
    await Otp.deleteMany({ email });
    const otp = new Otp({ email, otpHash, expiresAt });
    await otp.save();
    try {
      return res.status(200).json({
        message: `OTP has been sent to ${email} successfully`,
        data: otpNumber,
      });
    } catch (err) {
      console.error(err);
      if (
        err.code === "EENVELOPE" ||
        err.responseCode === 550 ||
        err.response.includes("Invalid recipient")
      ) {
        res.status(400).json({ message: `Email does not exist` });
      }
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error in sending OTP" });
  }
});

router.post("/validate-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const otpDocument = await Otp.findOne({ email });
    if (!otpDocument)
      return res
        .status(200)
        .json({ message: `OTP is not generated for validation` });
    if (otpDocument.attempts >= 3) {
      await Otp.findOneAndDelete({ email });
      return res.status(200).json({ message: "Too many incorrect attempts" });
    }
    const isMatch = await bcrypt.compare(otp, otpDocument.otpHash);
    if (!isMatch) {
      await Otp.findOneAndUpdate({ email }, { $inc: { attempts: 1 } });
      return res.status(200).json({
        message: `Incorrect OTP. ${2 - otpDocument.attempts} attempt${otpDocument.attempts == 0 ? "s" : ""} left`,
      });
    }
    await Otp.findOneAndDelete({ email });
    return res
      .status(200)
      .json({ message: "OTP verified successfully", flag: true });
  } catch (error) {
    res.status(500).json({ message: "Error in validating OTP" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const otpDocument = await Otp.findOne({ email });
    if (!otpDocument)
      return res.status(400).json({ message: "OTP not found or expired" });
    if (otpDocument.attempts >= 3) {
      await Otp.findOneAndDelete({ email });
      return res
        .status(400)
        .json({ message: "Too many incorrect attempts. Request a new OTP." });
    }
    const isMatch = await bcrypt.compare(otp, otpDocument.otpHash);
    if (!isMatch) {
      await Otp.findOneAndUpdate({ email }, { $inc: { attempts: 1 } });
      return res.status(400).json({
        message: `Incorrect OTP. ${2 - otpDocument.attempts} attempt${otpDocument.attempts === 0 ? "s" : ""} left`,
      });
    }
    await Otp.findOneAndDelete({ email });
    const user = await User.findOne({ username: email });
    if (!user)
      return res
        .status(404)
        .json({ message: "No account found with this email" });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updateOne(
      { username: email },
      { $set: { password: hashedPassword } },
    );
    return res
      .status(200)
      .json({ message: "Password reset successfully", flag: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error in resetting password" });
  }
});

module.exports = router;
