require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cartRoutes = require("./router/cart.routes");

const app = express();

app.get("/", (req, res) => {
  res.status(200).json({ message: "Cart is running" });
});
app.use(express.json());
app.use(cookieParser());

app.use("/api/cart", cartRoutes);
module.exports = app;
