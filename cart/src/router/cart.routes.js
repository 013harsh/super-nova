const express = require("express");
const router = express.Router();
const authmiddleware = require("../middleware/auth.middleware");
const cartcontroller = require("../controllers/cart.controllers");
const validation = require("../middleware/validation.middleware");

router.get("/", authmiddleware(["user"]), cartcontroller.getCart);

router.post(
  "/items",
  validation.validateAddItemToCart,
  authmiddleware(["user"]),
  cartcontroller.addItemTocart,
);

router.patch(
  "/items/:productId",
  validation.validateUpdateItemInCart,
  authmiddleware(["user"]),
  cartcontroller.updateItemTocart,
);

router.delete(
  "/items/:productId",
  authmiddleware(["user"]),
  cartcontroller.removeItemTocart,
);

router.delete("/", authmiddleware(["user"]), cartcontroller.clearCart);

module.exports = router;
