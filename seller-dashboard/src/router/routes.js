const express = require("express");
const { authmiddleware } = require("../middlewares/auth.middleware");
const controller = require("../controllers/controller");

const router = express.Router();

router.get("/metrics", authmiddleware(["seller"]), controller.getMetrics);

module.exports = router;
