const { body, validationResult } = require("express-validator");

const respondwithvalidationError = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "All required fields must be provided",
      errors: errors.array(),
    });
  }
  next();
};

const registerUservalidations = [
  body("username")
    .isString()
    .withMessage("username must be a string")
    .isLength({ min: 3 })
    .withMessage("username must be at least 3 characters long"),
  body("email").isEmail().withMessage("please enter a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("password must be at least 6 characters long"),
  body("fullName.firstname")
    .isString()
    .withMessage("firstname must be a string")
    .notEmpty()
    .withMessage("firstname is required"),
  body("fullName.lastname")
    .isString()
    .withMessage("lastname must be a string")
    .notEmpty()
    .withMessage("lastname is required"),
  respondwithvalidationError,
];

const loginValidations = [
  body("email").optional().isEmail().withMessage("please enter a valid email"),
  body("username").optional().isString().withMessage("username is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("password must be at least 6 characters long"),
  respondwithvalidationError,
];

const addUserAddressValidations = [
  body("street")
    .isString()
    .withMessage("Street must be a string")
    .notEmpty()
    .withMessage("Street is required"),
  body("city")
    .isString()
    .withMessage("City must be a string")
    .notEmpty()
    .withMessage("City is required"),
  body("state")
    .isString()
    .withMessage("State must be a string")
    .notEmpty()
    .withMessage("State is required"),
  body("pincode")
    .optional()
    .isString()
    .withMessage("Pincode must be a string")
    .notEmpty()
    .withMessage("Pincode is required"),
  body("country")
    .isString()
    .withMessage("Country must be a string")
    .notEmpty()
    .withMessage("Country is required"),
  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be a boolean"),
  respondwithvalidationError,
];

module.exports = {
  registerUservalidations,
  loginValidations,
  addUserAddressValidations,
};
