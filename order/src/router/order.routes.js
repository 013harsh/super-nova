const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const orderController = require("../controller/order.controller");
const validation = require("../middleware/order.validation");

router.post(
  "/",
  authMiddleware(["user"]),
  validation.createorderValidations,
  orderController.createOrder,
);

router.get("/me", authMiddleware(["user"]), orderController.getUserOrders);
router.get("/:id", authMiddleware(["user"]), orderController.getOrderById);
router.post(
  "/:id/cancel",
  authMiddleware(["user"]),
  orderController.cancelOrder,
);
router.patch(
  "/:id",
  authMiddleware(["user", "admin"]),
  orderController.updateOrderAddress,
);

module.exports = router;
