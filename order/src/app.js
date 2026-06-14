const express = require("express");
const cookieParser = require("cookie-parser");
const orderRouter = require("./router/order.routes");

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/api/orders", orderRouter);
module.exports = app;
