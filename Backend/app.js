const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const User = require("./Models/user");
const Product = require("./Models/product");
const Order = require("./Models/order");
const Cart = require("./Models/cart");
const LoginHistory = require("./Models/loginHistory");
const Otp = require("./Models/otp");
const Contact = require("./Models/contact");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { InferenceClient } = require("@huggingface/inference");
const nodemailer = require("nodemailer");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const upload = require("./middleware/upload");
const cloudinary = require("./config/cloudinary");
const { Resend } = require("resend");

// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

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

const allowedOrigin = isProd
  ? "https://fatafat-masala-frontend.onrender.com"
  : "http://localhost:4200";

app.use(
  cors({
    origin: allowedOrigin,
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

app.post("/logout", authMiddleware, async (req, res, next) => {
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

app.post(
  "/add-product",
  upload.single("image"),
  authMiddleware,
  async (req, res, next) => {
    try {
      const { name, mrp, price, description } = req.body;
      try {
        const tempCloudinary = require("cloudinary").v2;
        tempCloudinary.config({
          cloud_name: process.env.CLOUD_NAME,
          api_key: process.env.CLOUD_API_KEY,
          api_secret: process.env.CLOUD_API_SECRET,
        });
        // console.log(tempCloudinary.config());
        const stream = tempCloudinary.uploader.upload_stream(
          { folder: "my_app_uploads" },
          async (error, result) => {
            if (error) {
              console.error(error);
              return res
                .status(500)
                .json({ message: "Error in uploading image to Cloudinary" });
            }
            const product = new Product({
              name,
              mrp,
              price,
              description,
              images: [{ url: result.secure_url, publicId: result.public_id }],
            });
            await product.save();
            return res
              .status(201)
              .json({ message: "Product saved successfully" });
          },
        );
        stream.end(req.file.buffer);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error in uploading image" });
      }
    } catch (error) {
      return res.status(500).json({ message: "Error in saving product" });
    }
  },
);

app.patch(
  "/update-product",
  upload.single("image"),
  authMiddleware,
  async (req, res, next) => {
    try {
      console.log(req.body);
      const { id, name, mrp, price, description } = req.body;
      const product = await Product.findById(id);
      if (product) {
        if (req.file) {
          try {
            const tempCloudinary = require("cloudinary").v2;
            tempCloudinary.config({
              cloud_name: process.env.CLOUD_NAME,
              api_key: process.env.CLOUD_API_KEY,
              api_secret: process.env.CLOUD_API_SECRET,
            });
            // console.log(tempCloudinary.config());
            if (product.images[0]?.publicId)
              await cloudinary.uploader.destroy(product.images[0]?.publicId);
            const stream = tempCloudinary.uploader.upload_stream(
              { folder: "my_app_uploads" },
              async (error, result) => {
                if (error) {
                  console.error(error);
                  return res.status(500).json({
                    message: "Error in uploading image to Cloudinary",
                  });
                }
                await Product.findByIdAndUpdate(id, {
                  name: name,
                  mrp: mrp,
                  price: price,
                  description: description,
                  images: [
                    { url: result.secure_url, publicId: result.public_id },
                  ],
                  updatedAt: Date.now(),
                });
                return res
                  .status(200)
                  .json({ message: "Product updated successfully" });
              },
            );
            stream.end(req.file.buffer);
          } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Error in uploading image" });
          }
        } else {
          await Product.findByIdAndUpdate(id, {
            name: name,
            mrp: mrp,
            price: price,
            description: description,
            images: product.images,
            updatedAt: Date.now(),
          });
          return res
            .status(200)
            .json({ message: "Product updated successfully" });
        }
      } else {
        return res.status(500).json({ message: "Cannot find product ID" });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Error in updating product" });
    }
  },
);

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
    const product = await Product.findById(id);
    const tempCloudinary = require("cloudinary").v2;
    tempCloudinary.config({
      cloud_name: process.env.CLOUD_NAME,
      api_key: process.env.CLOUD_API_KEY,
      api_secret: process.env.CLOUD_API_SECRET,
    });
    if (product.images[0]?.publicId)
      await cloudinary.uploader.destroy(product.images[0]?.publicId);
    await Product.findByIdAndDelete(id);
    await Cart.updateMany(
      { "items.productId": id },
      { $pull: { items: { productId: id } } },
    );
    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error in deleting the product" });
  }
});

app.post("/set-cart-products", authMiddleware, async (req, res, next) => {
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
        quantity: product.quantity,
      });
    }
    const cart = await Cart.findOne({ userId: req.user.userId });
    console.log("cart ----> ", cart);
    if (cart) {
      await Cart.findByIdAndUpdate(cart._id, {
        items: selectedProducts,
      });
      return res
        .status(200)
        .json({ message: "Products added to cart successfully" });
    } else {
      await Cart.create({
        userId: req.user.userId,
        items: selectedProducts,
      });
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

app.get("/generate-description", authMiddleware, async (req, res, next) => {
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
    const cartProducts = await Cart.findOne({
      userId: req.user.userId,
    });
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
      const foundProduct = await Product.findById(id);
      if (!cart) {
        newItem = [
          {
            productId: foundProduct._id,
            name: foundProduct.name,
            price: foundProduct.price,
            quantity: 1,
          },
        ];
        await Cart.create({
          userId: req.user.userId,
          items: newItem,
        });
        return res.status(200).json({
          message: "Cart is created and product is added successfully",
        });
      }
      const selectedProduct = cart.items.find((ele) => ele.productId == id);
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

app.post("/send-otp", async (req, res, next) => {
  try {
    const { email, resendFlag } = req.body;
    const otpNumber = Math.floor(100000 + Math.random() * 900000); // 6-digit
    const otpHash = await bcrypt.hash(otpNumber.toString(), 10);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min
    await Otp.deleteMany({ email });
    const otp = new Otp({
      email,
      otpHash,
      expiresAt,
    });
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

app.post("/validate-otp", async (req, res, next) => {
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

app.get("/checkout-products", authMiddleware, async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.userId }).populate(
      "items.productId",
      "images",
    );
    if (!cart)
      return res.status(500).json({ message: "Cannot find cart for the user" });
    let totalPrice = 0;
    let totalQuantity = 0;
    const deliveryFees = 50;
    let response = [];
    for (const product of cart.items) {
      const selectedProduct = await Product.findById(product.productId);
      totalPrice += product.quantity * selectedProduct.price;
      totalQuantity += product.quantity;
      response.push({
        productId: selectedProduct._id,
        productName: selectedProduct.name,
        price: product.quantity * selectedProduct.price,
        quantity: product.quantity,
        images: product?.productId?.images,
      });
    }
    totalPrice += deliveryFees;
    return res.status(200).json({
      message: "Checkout products retrieved successfully",
      data: {
        products: response,
        totalQuantity,
        totalPrice,
        deliveryFees,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error in getting checkout products" });
  }
});

app.post("/address", authMiddleware, async (req, res, next) => {
  try {
    const { _id, name, line1, line2, city, state, pincode, phone, flag } = req.body;
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

app.post("/reset-password", async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    const otpDocument = await Otp.findOne({ email });
    if (!otpDocument)
      return res.status(400).json({ message: "OTP not found or expired" });
    if (otpDocument.attempts >= 3) {
      await Otp.findOneAndDelete({ email });
      return res.status(400).json({ message: "Too many incorrect attempts. Request a new OTP." });
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
    if (!user) return res.status(404).json({ message: "No account found with this email" });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ username: email }, { $set: { password: hashedPassword } });
    return res.status(200).json({ message: "Password reset successfully", flag: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error in resetting password" });
  }
});

app.post("/change-password", authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Current password is incorrect" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ _id: req.user.userId }, { $set: { password: hashedPassword } });
    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error in changing password" });
  }
});

app.post("/contact", async (req, res, next) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !message)
      return res.status(400).json({ message: "Name, email and message are required" });
    const contact = await Contact.create({ name, email, phone, message });
    return res.status(201).json({ message: "Message received! We'll get back to you soon.", data: contact });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error saving your message" });
  }
});

app.get("/contacts", authMiddleware, async (req, res, next) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    return res.status(200).json({ message: "Contacts fetched", data: contacts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching contacts" });
  }
});

app.patch("/contact-read/:id", authMiddleware, async (req, res, next) => {
  try {
    await Contact.updateOne({ _id: req.params.id }, { $set: { isRead: true } });
    return res.status(200).json({ message: "Marked as read" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating contact" });
  }
});

app.delete("/delete-address", authMiddleware, async (req, res, next) => {
  const { id } = req.query;
  try {
    await User.updateOne(
      { _id: req.user.userId },
      {
        $pull: {
          addresses: { _id: id },
        },
      },
    );
    return res.status(200).json({ message: "Address deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error in deleting address" });
  }
});

app.get("/profile", authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    // const orders = await Order.find({ userId: req.user.userId });
    const orders = await Order.find({ userId: req.user.userId }).populate({
      path: "items.productId",
      select: "images", // only fields you need
    });
    const profile = {
      userDetails: user,
      orders: orders,
    };
    return res.status(200).json({
      message: "User profile details fetched successfully",
      data: profile,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error in fetching profile details" });
  }
});

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

app.post("/place-order", authMiddleware, async (req, res, next) => {
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
        } else
          return res.status(500).json({ message: "Error in placing order" });
      } catch (err) {
        if (err.code === 11000) {
          // Duplicate key error
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

app.get("/get-orders", authMiddleware, async (req, res, next) => {
  try {
    const orders = await Order.find();
    return res
      .status(200)
      .json({ message: "Orders fetched successfully", data: orders });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error in fetching orders" });
  }
});

app.post(
  "/upload-image",
  authMiddleware,
  upload.single("image"),
  async (req, res, next) => {
    try {
      const tempCloudinary = require("cloudinary").v2;
      tempCloudinary.config({
        cloud_name: process.env.CLOUD_NAME,
        api_key: process.env.CLOUD_API_KEY,
        api_secret: process.env.CLOUD_API_SECRET,
      });
      // console.log(tempCloudinary.config());
      const stream = tempCloudinary.uploader.upload_stream(
        { folder: "my_app_uploads" },
        (error, result) => {
          if (error) {
            console.error(error);
            return res
              .status(500)
              .json({ message: "Error in uploading image to Cloudinary" });
          }
          return res.status(200).json({ url: result.secure_url });
        },
      );

      stream.end(req.file.buffer);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error in uploading image" });
    }
  },
);

app.get("/product-details", async (req, res, next) => {
  try {
    const { id } = req.query;
    const product = await Product.findById(id);
    if (!product)
      return res
        .status(500)
        .json({ message: "Product not found", flag: false });
    return res.status(200).json({
      message: "Product details fetched successfully",
      flag: true,
      data: product,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Error in fetching product details", flag: false });
  }
});

app.get("/order-details", async (req, res, next) => {
  try {
    const { id } = req.query;
    console.log(id);
    const order = await Order.findOne({ _id: id }).populate('items.productId', 'images');
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

module.exports = app;
