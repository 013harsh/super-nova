const express = require("express");
const { connect } = require("./borker/borker");
const setListeners = require("./borker/linstners");
const app = express();
app.use(express.json());

connect().then(() => {
  setListeners();
});

app.get("/", (req, res) => {
  res.send("Server is running");
});

module.exports = app;
