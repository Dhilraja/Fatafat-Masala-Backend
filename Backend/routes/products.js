const express = require("express");
const router = express.Router();
const { InferenceClient } = require("@huggingface/inference");
const Product = require("../Models/product");
const Cart = require("../Models/cart");
const authMiddleware = require("../middleware/auth");
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");

router.get("/products", async (req, res) => {
  try {
    const products = await Product.find();
    return res
      .status(200)
      .json({ data: products, message: "Products fetched successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error in fetching products" });
  }
});

router.get("/product-details", async (req, res) => {
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

router.post(
  "/add-product",
  upload.single("image"),
  authMiddleware,
  async (req, res) => {
    try {
      const { name, mrp, price, description, variant } = req.body;
      const stream = cloudinary.uploader.upload_stream(
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
            variant,
            images: [{ url: result.secure_url, publicId: result.public_id }],
          });
          await product.save();
          return res
            .status(201)
            .json({ message: "Product saved successfully" });
        },
      );
      stream.end(req.file.buffer);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Error in saving product" });
    }
  },
);

router.patch(
  "/update-product",
  upload.single("image"),
  authMiddleware,
  async (req, res) => {
    try {
      console.log(req.body);
      const { id, name, mrp, price, description, variant } = req.body;
      const product = await Product.findById(id);
      if (!product)
        return res.status(500).json({ message: "Cannot find product ID" });

      if (req.file) {
        if (product.images[0]?.publicId)
          await cloudinary.uploader.destroy(product.images[0].publicId);
        const stream = cloudinary.uploader.upload_stream(
          { folder: "my_app_uploads" },
          async (error, result) => {
            if (error) {
              console.error(error);
              return res
                .status(500)
                .json({ message: "Error in uploading image to Cloudinary" });
            }
            await Product.findByIdAndUpdate(id, {
              name,
              mrp,
              price,
              description,
              variant,
              images: [{ url: result.secure_url, publicId: result.public_id }],
              updatedAt: Date.now(),
            });
            return res
              .status(200)
              .json({ message: "Product updated successfully" });
          },
        );
        stream.end(req.file.buffer);
      } else {
        await Product.findByIdAndUpdate(id, {
          name,
          mrp,
          price,
          description,
          variant,
          images: product.images,
          updatedAt: Date.now(),
        });
        return res
          .status(200)
          .json({ message: "Product updated successfully" });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Error in updating product" });
    }
  },
);

router.patch("/enable-disable-product", authMiddleware, async (req, res) => {
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

router.delete("/delete-product", authMiddleware, async (req, res) => {
  try {
    const { id } = req.query;
    const product = await Product.findById(id);
    if (product.images[0]?.publicId)
      await cloudinary.uploader.destroy(product.images[0].publicId);
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

router.get("/generate-description", authMiddleware, async (req, res) => {
  const { input } = req.query;
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

router.post(
  "/upload-image",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      const stream = cloudinary.uploader.upload_stream(
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

module.exports = router;
