const UserModel = require("../models/user.model");
const jwt = require("jsonwebtoken");

async function authmiddleware(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    const user = decodedToken;

    req.user = user;

    next();
  } catch (err) {
    return res.status(401).json({ message: "unauthorized" });
  }
}

module.exports = { authmiddleware };
