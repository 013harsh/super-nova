const express = require("express");
const cookieParser = require("cookie-parser");

const app = express();

app.use(express.json());
app.use(cookieParser);

app.get("/", (req, res) => {
  res.status(200).json({ message: "Seller Dashboard is running" });
});

module.exports = app;
