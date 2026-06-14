const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");

function validateResult(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

const validateAddItemToCart = [
  body("productId")
    .isString()
    .withMessage("Product ID is string")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Product ID is not formate"),
  body("qty")
    .isInt({ gt: 0 })
    .withMessage("Quantity must be a positive integer"),
  validateResult,
];

const validateUpdateItemInCart = [
  body("qty").isInt().withMessage("Quantity must be an integer"),
  validateResult,
];

module.exports = {
  validateResult,
  validateAddItemToCart,
  validateUpdateItemInCart,
};
