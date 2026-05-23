const express = require("express");
const productcontroller = require("../controllers/product.controller");
const createAuthMiddleware = require("../middlewares/auth.middlerware");
const upload = require("../middlewares/upload.middleware");
const {
  validateCreateProduct,
  validateUpdateProduct,
} = require("../middlewares/validation.middleware");

const router = express.Router();

router.post(
  "/",
  createAuthMiddleware(["admin", "seller"]),
  upload.array("images", 5),
  validateCreateProduct,
  productcontroller.createProduct,
);

router.get("/", productcontroller.getProducts);

router.patch(
  "/:id",
  createAuthMiddleware(["admin", "seller"]),
  validateUpdateProduct,
  productcontroller.updateProduct,
);
router.delete(
  "/:id",
  createAuthMiddleware(["seller"]),
  productcontroller.deleteProduct,
);

router.get(
  "/seller",
  createAuthMiddleware(["seller"]),
  productcontroller.getProductsBySeller,
);
router.get("/:id", productcontroller.getProductById);
module.exports = router;
