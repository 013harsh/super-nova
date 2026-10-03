const userModel = require("../models/user.model");
const orderModel = require("../models/order.models");
const paymentModel = require("../models/payment.model");
const productModel = require("../models/product.model");

async function getMetrics(req, res) {
  try {
     const sellerId = req.user.id;
    // 1. Get all products owned by this seller
    const products = await productModel.find({ seller: sellerId }).select('_id');
    const productIds = products.map(p => p._id);
    if (productIds.length === 0) {
      return res.status(200).json({ sales: 0, revenue: 0, topProducts: [] });
    }
    // 2. Calculate Total Sales (quantity) and Revenue for this seller's products
    const metrics = await orderModel.aggregate([
      { $unwind: "$items" },
      { $match: { "items.product": { $in: productIds }, status: { $ne: "CANCELLED" } } },
      {
        $group: {
          _id: null,
          sales: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price.amount", "$items.quantity"] } }
        }
      }
    ]);
    // 3. Get Top 5 Products for this seller based on sales volume
    const topProducts = await orderModel.aggregate([
      { $unwind: "$items" },
      { $match: { "items.product": { $in: productIds }, status: { $ne: "CANCELLED" } } },
      {
        $group: {
          _id: "$items.product",
          sales: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price.amount", "$items.quantity"] } }
        }
      },
      { $sort: { sales: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $project: {
          _id: 1,
          sales: 1,
          revenue: 1,
          title: "$productDetails.title",
          price: "$productDetails.price",
          images: "$productDetails.images"
        }
      }
    ]);

    const result = {
      sales: metrics.length > 0 ? metrics[0].sales : 0,
      revenue: metrics.length > 0 ? metrics[0].revenue : 0,
      topProducts: topProducts
    };

    return res.status(200).json(result);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getMetrics,
};
