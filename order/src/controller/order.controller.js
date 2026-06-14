const orderModel = require("../models/order.models");
const axios = require("axios");

async function createOrder(req, res) {
  const user = req.user;
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];
  try {
    const cartResponse = await axios.get(`http://localhost:3002/api/cart`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const products = await Promise.all(
      cartResponse.data.cart.items.map(async (item) => {
        return (
          await axios.get(
            `http://localhost:3001/api/products/${item.productId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          )
        ).data.product;
      }),
    );

    let priceAmount = 0;
    const orderItems = cartResponse.data.cart.items.map((item) => {
      const product = products.find((p) => p._id == item.productId);
      if (product.stock < item.quantity) {
        throw new Error(`${product.title} is not in stock`);
      }

      const intemTotal = product.price.amount * item.qty;
      priceAmount += intemTotal;

      return {
        product: item.productId,
        quantity: item.qty,
        price: {
          amount: intemTotal,
          currency: product.price.currency,
        },
      };
    });
    const order = await orderModel.create({
      user: user.id,
      items: orderItems,
      status: "PENDING",
      totalPrice: {
        amount: priceAmount,
        currency: "INR",
      },
      shippingAddress: {
        street: req.body.shippingAddress.street,
        city: req.body.shippingAddress.city,
        state: req.body.shippingAddress.state,
        pincode: req.body.shippingAddress.pincode,
        country: req.body.shippingAddress.country,
      },
    });

    res.status(201).json({ message: "Order created successfully", order });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "internal server erroe ", error });
  }
}

async function getUserOrders(req, res) {
  const user = req.user;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  try {
    const totalOrder = await orderModel.countDocuments({ user: user.id });
    const orders = await orderModel
      .find({ user: user.id })
      .skip(skip)
      .limit(limit);
    res.status(200).json({
      orders,
      meta: {
        total: totalOrder,
        page,
        limit,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "internal server erroe ", error });
  }
}

async function getOrderById(req, res) {
  const user = req.user;
  const oderId = req.params.id;
  try {
    const order = await orderModel.findById(oderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.user.toString() !== user.id) {
      return res
        .status(403)
        .json({ message: "Forbidden: you do not have access" });
    }
    res.status(200).json({ order });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "internal server erroe ", error });
  }
}

async function cancelOrder(req, res) {
  const user = req.user;
  const orderId = req.params.id;
  try {
    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.user.toString() !== user.id) {
      return res.status(403).json({ message: "Forbidden: you do not have access" });
    }

    if (order.status === "PENDING" || order.status === "PAID") {
        order.status = "CANCELLED";
        await order.save();
        return res.status(200).json({ message: "Order cancelled successfully", order });
    } else {
        return res.status(400).json({ message: `Order cannot be cancelled in ${order.status} status` });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "internal server error", error });
  }
}

async function updateOrderAddress(req, res) {
  const user = req.user;
  const orderId = req.params.id;
  try {
    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.user.toString() !== user.id) {
      return res.status(403).json({ message: "Forbidden: you do not have access" });
    }
    
    if (order.status !== "PENDING") {
       return res.status(400).json({ message: "Cannot update address after payment is captured" });
    }

    if (!req.body.shippingAddress) {
       return res.status(400).json({ message: "Shipping address is required" });
    }

    order.shippingAddress = req.body.shippingAddress;
    await order.save();
    res.status(200).json({ message: "Address updated successfully", order });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "internal server error", error });
  }
}

module.exports = { createOrder, getUserOrders, getOrderById, cancelOrder, updateOrderAddress };
