const axios = require("axios");
const paymentModel = require("../models/payment.model");

require("dotenv").config();
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function createPayment(req, res) {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
  try {
    const orderId = req.params.orderId;
    // get order
    const orderResponse = await axios.get(
      "http://localhost:3003/api/orders/" + orderId,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const price = orderResponse.data.order.totalPrice;

    const order = await razorpay.orders.create(price);
    const payment = await paymentModel.create({
      order: orderId,
      razorpayorderId: order.id,
      user: req.user.id,
      price: {
        amount: order.amount,
        currency: order.currency,
      },
    });
    return res.status(201).json({ message: "payment created", payment });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Failed to create payment" });
  }
}

async function verifyPayment(req, res) {
  const { razorpayOrderId, razorpayPaymentId, signature } = req.body;
  const secret = process.env.RAZORPAY_KEY_SECRET;

  try {
    const {
      validatePaymentVerification,
    } = require("razorpay/dist/utils/razorpay-utils.js");

    const isValid = validatePaymentVerification(
      { order_id: razorpayOrderId, payment_id: razorpayPaymentId },
      signature,
      secret,
    );

    if (!isValid) {
      return res.status(400).send("Invalid signature");
    }

    const payment = await paymentModel.findOne({
      razorpayorderId: razorpayOrderId,
      status: "PENDING",
    });
    if (!payment) {
      return res.status(404).send("Payment not found");
    }

    payment.paymentId = razorpayPaymentId;
    payment.signature = signature;
    payment.status = "COMPLETED";

    await payment.save();

    res.status(200).json({ message: "Payment verified successfully", payment });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error verifying payment");
  }
}
module.exports = { createPayment, verifyPayment };
