require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const productRoutes = require("./routes/product.routs");

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use("/api/products", productRoutes);

app.use((err, req, res, next) => {
  if (err) {
    if (
      err.code === "LIMIT_FILE_SIZE" ||
      err.message === "Only image files are allowed!" ||
      err.name === "MulterError"
    ) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
  next();
});

module.exports = app;
