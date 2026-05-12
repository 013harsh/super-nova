const express = require("express");
const validators = require("../middlewares/Validate.middleware");
const authcontroller = require("../controllers/auth.controller");
const authmiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.post(
  "/register",
  validators.registerUservalidations,
  authcontroller.registeruser,
);
router.post("/login", validators.loginValidations, authcontroller.loginuser);

router.get("/me", authmiddleware.authmiddleware, authcontroller.getcurrentuser);

router.get("/logout", authcontroller.logoutuser);

router.get(
  "/me/addresses",
  authmiddleware.authmiddleware,
  authcontroller.getAddresses,
);
router.post(
  "/me/addresses",
  validators.addUserAddressValidations,
  authmiddleware.authmiddleware,
  authcontroller.addAddress,
);

router.delete(
  "/me/addresses/:addressId",
  authmiddleware.authmiddleware,
  authcontroller.deleteAddress,
);

module.exports = router;
