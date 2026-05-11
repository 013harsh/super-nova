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

module.exports = router;
