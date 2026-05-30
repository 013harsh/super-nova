const jwt = require("jsonwebtoken");

function authmiddleware(roles = ["user"]) {
  return async function (req, res, next) {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

      req.user = decodedToken;

      next();
    } catch (err) {
      return res.status(401).json({ message: "unauthorized" });
    }
  };
}

module.exports = authmiddleware;
