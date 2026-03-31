const express = require("express");
const router = express.Router();
const Contact = require("../Models/contact");
const authMiddleware = require("../middleware/auth");

router.post("/contact", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !message)
      return res
        .status(400)
        .json({ message: "Name, email and message are required" });
    const contact = await Contact.create({ name, email, phone, message });
    return res.status(201).json({
      message: "Message received! We'll get back to you soon.",
      data: contact,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error saving your message" });
  }
});

router.get("/contacts", authMiddleware, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    return res
      .status(200)
      .json({ message: "Contacts fetched", data: contacts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching contacts" });
  }
});

router.patch("/contact-read/:id", authMiddleware, async (req, res) => {
  try {
    await Contact.updateOne(
      { _id: req.params.id },
      { $set: { isRead: true } },
    );
    return res.status(200).json({ message: "Marked as read" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating contact" });
  }
});

module.exports = router;
