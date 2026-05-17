const { body, validationResult, param } = require("express-validator");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((error) => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value,
      })),
    });
  }

  next();
};

const validateCreateProduct = [
  body("title")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be between 3 and 200 characters"),

  body("description")
    .optional()
    .isString()
    .withMessage("description must be a String")
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description must not exceed 2000 characters"),

  body("price")
    .notEmpty()
    .withMessage("Price is required")
    .bail()
    .isFloat({ gt: 0 })
    .withMessage("Price must be a positive number greater than 0"),

  body("currency")
    .optional()
    .isIn(["USD", "INR"])
    .withMessage("Currency must be either USD or INR"),
  handleValidationErrors,
];

const validateUpdateProduct = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be between 3 and 200 characters")
    .escape(),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description must not exceed 2000 characters")
    .escape(),

  body("price")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Price must be a positive number greater than 0")
    .toFloat(),

  body("currency")
    .optional()
    .trim()
    .isIn(["USD", "INR"])
    .withMessage("Currency must be either USD or INR")
    .toUpperCase(),

  handleValidationErrors,
];

const validateProductId = [
  param("id").optional().isMongoId().withMessage("Invalid product ID format"),

  handleValidationErrors,
];

module.exports = {
  validateCreateProduct,
  validateUpdateProduct,
  validateProductId,
  handleValidationErrors,
};
