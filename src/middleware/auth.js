const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Extract token (remove 'Bearer ' prefix)
    const token = authHeader.substring(7);

    // Verify access token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user info to request
    req.user = decoded;
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: "Token expired",
        code: "TOKEN_EXPIRED"
      });
    }
    
    return res.status(401).json({ 
      message: "Invalid token",
      code: "INVALID_TOKEN"
    });
  }
};