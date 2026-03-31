const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../Models/user");
const LoginHistory = require("../Models/loginHistory");
const authMiddleware = require("../middleware/auth");

router.get("/login-details", (req, res) => {
  const token = req.cookies.access_token;
  try {
    const decodedData = jwt.verify(token, process.env.JWT_SECRET);
    return res.status(200).json({
      message: "User details fetched successfully",
      flag: true,
      data: decodedData,
    });
  } catch (error) {
    return res
      .status(200)
      .json({ message: "User not logged in", flag: false, data: null });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { username, name, password } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const user = new User({ username, name, password: hashedPassword });
    await user.save();
    return res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error in registering a user" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(403).json({ message: "Invalid username" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(403).json({ message: "Invalid password" });
    }
    const data = {
      userId: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const token = jwt.sign(data, process.env.JWT_SECRET, { expiresIn: "10m" });
    console.log("JWT Token -- ", token);
    res.cookie("access_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 10 * 60 * 1000,
    });
    const loginHistory = new LoginHistory({
      userId: user._id,
      username: user.name,
      loggedAt: Date.now(),
    });
    await loginHistory.save();
    return res.json({ message: "Login successful", data: data });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error in logging in" });
  }
});

router.post("/logout", authMiddleware, async (req, res) => {
  try {
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: "/",
    });
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error in logging out" });
  }
});

module.exports = router;
