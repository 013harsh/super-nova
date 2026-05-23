const mongoose = require("mongoose");
const productModel = require("../models/product.model");
const {
  uploadMultipleImages,
  deleteMultipleImages,
} = require("../services/imageUpload.service");

async function createProduct(req, res) {
  try {
    const { title, description, price, currency } = req.body;
    const seller = req.user?.id || req.body.seller;

    if (!title || !price) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const uploadedImages = await uploadMultipleImages(req.files, "/products");
    const product = await productModel.create({
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
}

async function getProducts(req, res) {
  const { q, minprice, maxprice, skip = 0, limit = 20 } = req.query;

  const filter = {};

  if (q) {
    filter.$text = { $search: q };
  }
  if (minprice) {
    filter["price.amount"] = {
      ...filter["price.amount"],
      $gte: Number(minprice),
    };
  }
  if (maxprice) {
    filter["price.amount"] = {
      ...filter["price.amount"],
      $lte: Number(maxprice),
    };
  }
  const product = await productModel
    .find(filter)
    .skip(Number(skip))
    .limit(Math.min(Number(limit), 20));

  return res.status(200).json({
    data: product,
  });
}

async function getProductById(req, res) {
  const { id } = req.params;
  const product = await productModel.findById(id);
  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }
  return res.status(200).json({
    product: product,
  });
}

async function updateProduct(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid product ID",
    });
  }

  const product = await productModel.findOne({
    _id: id,
  });
  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }

  if (product.seller.toString() !== req.user.id) {
    return res.status(403).json({
      message: "Insufficient permissions",
    });
  }

  const allowedUpdates = ["title", "description", "price", "currency"];

  for (const key of Object.keys(req.body)) {
    if (allowedUpdates.includes(key)) {
      if (key === "price") {
        if (typeof req.body.price === "object" && req.body.price !== null) {
          const amount =
            req.body.price.amount !== undefined
              ? Number(req.body.price.amount)
              : product.price.amount;
          const currency =
            req.body.price.currency !== undefined
              ? req.body.price.currency
              : product.price.currency;
          product.price = { amount, currency };
        } else {
          product.price = {
            amount: Number(req.body.price),
            currency: product.price.currency,
          };
        }
      } else if (key === "currency") {
        product.price = {
          amount: product.price.amount,
          currency: req.body.currency,
        };
      } else {
        product[key] = req.body[key];
      }
    }
  }

  await product.save();

  return res.status(200).json({
    success: true,
    message: "Product updated successfully",
    data: product,
  });
}

async function deleteProduct(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid product ID",
    });
  }

  const product = await productModel.findOne({
    _id: id,
  });
  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }

  if (product.seller.toString() !== req.user.id) {
    return res.status(403).json({
      message: "Insufficient permissions",
    });
  }

  if (product.images && product.images.length > 0) {
    await deleteMultipleImages(product.images);
  }

  await productModel.findByIdAndDelete(id);

  return res.status(200).json({
    success: true,
    message: "deleted successfully",
  });
}

async function getProductsBySeller(req, res) {
  const seller = req.user;
  const { skip = 0, limit = 20 } = req.query;

  const product = await productModel
    .find({
      seller: seller.id,
    })
    .skip(Number(skip))
    .limit(Math.min(Number(limit), 20));

  return res.status(200).json({
    success: true,
    data: product,
  });
}
module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductsBySeller,
};
