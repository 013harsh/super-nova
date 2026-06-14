const jwt = require("jsonwebtoken");

function authmiddleware(roles = ["user"]) {
  return async function (req, res, next) {
    const token =
      req.cookies?.token || req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "unauthorized" });
    }
    try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      console.log("DECODED:", decodedToken);
      req.user = decodedToken;
      next();
    } catch (err) {
      return res.status(401).json({ success: false, message: "unauthorized" });
    }
  };
}

module.exports = authmiddleware;
