const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const paymentController = require("../controller/payment.controller");

const router = express.Router();

// POST /api/payments/create/:orderId
router.post(
  "/create/:orderId",
  authMiddleware(["user"]),
  paymentController.createPayment,
);

//POST api/payments/verify/:paymentId
router.post(
  "/verify",
  authMiddleware(["user"]),
  paymentController.verifyPayment,
);

module.exports = router;
