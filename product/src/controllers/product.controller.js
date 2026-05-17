const Product = require("../models/product.model");
const { uploadMultipleImages } = require("../services/imageUpload.service");

const createProduct = async (req, res) => {
  try {
    const { title, description, price, currency } = req.body;
    const seller = req.user?.id;

    if (!title || !price) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const uploadedImages = await uploadMultipleImages(req.files, "/products");
    const product = await Product.create({
      title,
      description,
      price: { amount: Number(price), currency: currency || "INR" },
      seller,
      images: uploadedImages,
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Error creating product:", error);
    }

    res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: error.message,
    });
  }
};

module.exports = {
  createProduct,
};
