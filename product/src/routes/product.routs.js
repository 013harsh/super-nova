const express = require("express");
const productcontroller= require("../controllers/product.controller");
const createAuthMiddleware = require('../middlewares/auth.middlerware');
const upload = require("../middlewares/upload.middleware");
const { validateCreateProduct } = require("../middlewares/validation.middleware");

const router = express.Router();

router.post(
  "/",
  createAuthMiddleware(['admin', 'seller']),
  upload.array("images", 5),
  validateCreateProduct,
  productcontroller.createProduct
);

module.exports = router;
