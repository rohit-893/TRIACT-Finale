import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "Please define the JWT_SECRET environment variable inside .env"
  );
}

export const signToken = (user) => {
  const payload = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    shopId: user.shopId,
    salary: user.salary,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  });
};

export const authMiddleware = (handler) => async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Authorization token not found or invalid" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return handler(req, res);
  } catch (error) {
    // --- ADD THIS LINE ---
    console.error("JWT Verification Error:", error.message, "Token:", token);
    // --------------------
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const ownerMiddleware = (handler) =>
  authMiddleware(async (req, res) => {
    if (req.user.role !== "owner") {
      return res
        .status(403)
        .json({ message: "Access denied. Owner role required." });
    }
    return handler(req, res);
  });
