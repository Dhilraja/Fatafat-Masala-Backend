const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const otpRoutes = require("./routes/otp");
const productRoutes = require("./routes/products");
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/orders");
const profileRoutes = require("./routes/profile");
const contactRoutes = require("./routes/contact");

const app = express();

const isProd = process.env.NODE_ENV === "production";

mongoose
  .connect(
    "mongodb+srv://Dhilraja:admin@cluster0.zwmol.mongodb.net/FatafatMasalaDatabase",
    { autoIndex: !isProd },
  )
  .then(() => {
    console.log("Connected to Fatafat Masala Database!");
  });

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const allowedOrigin = isProd
  ? "https://fatafat-masala-frontend.onrender.com"
  : "http://localhost:4200";

app.use(cors({ origin: allowedOrigin, credentials: true }));

app.use(authRoutes);
app.use(otpRoutes);
app.use(productRoutes);
app.use(cartRoutes);
app.use(orderRoutes);
app.use(profileRoutes);
app.use(contactRoutes);

module.exports = app;
