const express = require("express");
const cookieParser = require("cookie-parser");
const paymentrouter = require("./router/payment.route");

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use("/api/payments", paymentrouter);

module.exports = app;
