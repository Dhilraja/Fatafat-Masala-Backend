const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const User = require("./Models/user");
const Product = require("./Models/product");
// const Order = require("./Models/order");
const Cart = require("./Models/cart");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { InferenceClient } = require("@huggingface/inference");

const mongoose = require("mongoose");

const app = express();

const isProd = process.env.NODE_ENV === "production";

mongoose
  .connect(
    "mongodb+srv://Dhilraja:admin@cluster0.zwmol.mongodb.net/FatafatMasalaDatabase",
    {
      autoIndex: !isProd,
    },
  )
  .then(() => {
    console.log("Connected to Fatafat Masala Database!");
  });
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
// app.use((req, res, next) => {
//   res.setHeader("Access-Control-Allow-Origin", "*");
//   res.setHeader(
//     "Access-Control-Allow-Headers",
//     "Origin, X-Requested-With, Content-Type, Accept",
//   );
//   res.setHeader(
//     "Access-Control-Allow-Methods",
//     "GET, POST, PATCH, DELETE, OPTIONS",
//   );
//   next();
// });

//  https://fatafat-masala-frontend.onrender.com

app.use(
  cors({
    origin: "https://fatafat-masala-frontend.onrender.com", // exact frontend origin
    credentials: true,
  }),
);

const authMiddleware = (req, res, next) => {
  const token = req.cookies.access_token;
  if (!token) {
    return res
      .status(401)
      .json({ message: "Unauthorized to access this service" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

app.get("/login-details", (req, res, next) => {
  const token = req.cookies.access_token;
  console.log("token -- ", token);
  try {
    const decodedData = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded Data -- ", decodedData);
    return res.status(200).json({
      message: "User details fetched successfully",
      flag: true,
      data: decodedData,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(200)
      .json({ message: "User not logged in", flag: false, data: null });
  }
});

app.post("/register", async (req, res, next) => {
  try {
    const { username, name, password } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const user = new User({
      username,
      name,
      password: hashedPassword,
    });
    await user.save();
    return res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error in registering a user" });
  }
});

app.post("/login", async (req, res, next) => {
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
    // res.cookie("access_token", token, {
    //   httpOnly: true,
    //   secure: true, // HTTPS only
    //   sameSite: "strict", // CSRF protection
    //   maxAge: 2 * 60 * 1000,
    // });
    console.log("JWT Token -- ", token);
    res.cookie("access_token", token, {
      httpOnly: true,
      secure: true, // MUST be false on http
      sameSite: "None", // allows cross-origin dev
      maxAge: 10 * 60 * 1000,
    });
    return res.json({ message: "Login successful", data: data });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error in logging in" });
  }
});

app.post("/logout", async (req, res, next) => {
  try {
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: true, // same as when you set it
      sameSite: "None", // same as original
      path: "/", // must match path where cookie was set
    });
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error in logging out" });
  }
});

app.get("/products", async (req, res, next) => {
  try {
    const products = await Product.find();
    return res
      .status(200)
      .json({ data: products, message: "Products fetched successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error in fetching products" });
  }
});

app.post("/add-product", authMiddleware, async (req, res, next) => {
  try {
    const { name, mrp, price, description } = req.body;
    const product = new Product({
      name,
      mrp,
      price,
      description,
    });
    await product.save();
    return res.status(201).json({ message: "Product saved successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error in saving product" });
  }
});

app.patch("/update-product", authMiddleware, async (req, res, next) => {
  try {
    const { id, name, mrp, price, description } = req.body;
    const product = await Product.findById(id);
    if (product) {
      await Product.findByIdAndUpdate(id, {
        name: name,
        mrp: mrp,
        price: price,
        description: description,
        updatedAt: Date.now(),
      });
      return res.status(201).json({ message: "Product updated successfully" });
    } else {
      return res.status(500).json({ message: "Cannot find product ID" });
    }
  } catch (error) {
    return res.status(500).json({ message: "Error in updating product" });
  }
});

app.patch("/enable-disable-product", authMiddleware, async (req, res, next) => {
  try {
    const { id, flag } = req.body;
    const product = await Product.findById(id);
    if (product) {
      await Product.findByIdAndUpdate(id, {
        isActive: flag,
        updatedAt: Date.now(),
      });
      return res.status(201).json({
        message: `Product ${flag ? "enabled" : "disabled"} successfully`,
      });
    } else {
      return res
        .status(500)
        .json({ message: `Cannot ${flag ? "enable" : "disable"} product` });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Error in ${flag ? "enabling" : "disabling"} product` });
  }
});

app.delete("/delete-product", authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.query;
    await Product.findByIdAndDelete(id);
    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error in deleting the product" });
  }
});

app.post("/set-cart-products", authMiddleware, async (req, res, next) => {
  try {
    const products = req.body;
    let selectedProducts = [];
    console.log("products ---> ", products);
    for (const product of products) {
      const foundProduct = await Product.findById(product.id);
      console.log("foundProduct ------> ", foundProduct);
      if (!foundProduct) {
        return res.status(500).json({
          message: `Cannot find product with given id: ${product.id}`,
        });
      }
      selectedProducts.push({
        productId: foundProduct._id,
        name: foundProduct.name,
        price: foundProduct.price,
        quantity: product.quantity,
      });
    }
    await Cart.create({
      userId: req.user.userId,
      items: selectedProducts,
    });
    // await cart.save();
    return res
      .status(200)
      .json({ message: "Products added to cart successfully" });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Error in adding products to cart" });
  }
});

app.get("/generate-description", async (req, res, next) => {
  const { input } = req.query;
  console.log(req);
  console.log(input);
  try {
    const client = new InferenceClient(process.env["HF_TOKEN"]);
    const chatCompletion = await client.chatCompletion({
      model: "meta-llama/Llama-3.1-8B-Instruct",
      messages: [
        {
          role: "user",
          content: `Give me product description for my ecommerce website which focuses on indian spices in three sentences without quotes and only description in marketing way -> ${input}`,
        },
      ],
    });
    return res
      .status(200)
      .json({ data: chatCompletion.choices[0].message.content });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Error in generating description for the product" });
  }
});

app.get("/cart-products", authMiddleware, async (req, res, next) => {
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

app.post(
  "/add-remove-cart-products",
  authMiddleware,
  async (req, res, next) => {
    try {
      const { id, flag } = req.body;
      const cart = await Cart.findOne({ userId: req.user.userId });
      if (!cart)
        return res
          .status(500)
          .json({ message: "Cannot find products in cart for the user" });
      const selectedProduct = cart.items.find((ele) => ele.productId == id);
      const foundProduct = await Product.findById(id);
      if (flag) {
        if (!selectedProduct) {
          const item = {
            productId: foundProduct._id,
            name: foundProduct.name,
            price: foundProduct.price,
            quantity: 1,
          };
          await Cart.findOneAndUpdate(
            { userId: req.user.userId },
            {
              $push: { items: item },
              $set: { updatedAt: Date.now() },
            },
          );
          return res.status(200).json({ message: "Product is added to cart" });
        }
        await Cart.findOneAndUpdate(
          { userId: req.user.userId, "items.productId": id },
          {
            $inc: { "items.$.quantity": 1 },
            $set: { updatedAt: Date.now() },
          },
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
          const itemIndex = cart.items.findIndex(
            (item) => item.productId == id,
          );
          cart.items.splice(itemIndex, 1);
          cart.updatedAt = Date.now();
          await cart.save();
        }
        await Cart.findOneAndUpdate(
          { userId: req.user.userId, "items.productId": id },
          {
            $inc: { "items.$.quantity": -1 },
            $set: { updatedAt: Date.now() },
          },
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
  },
);

module.exports = app;
