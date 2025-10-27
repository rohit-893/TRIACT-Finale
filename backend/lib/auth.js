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
  // --- RUN CORS FIRST ---
  try {
    await handleCors(req, res);
  } catch (error) {
     // Handle potential errors from the CORS middleware itself
     console.error("Error in CORS middleware:", error);
     // You might want to return a specific error response here
     return res.status(500).json({ message: "CORS configuration error" });
  }

  // --- ADDED CHECK: If it was an OPTIONS request, CORS middleware handled it, so we can stop. ---
  if (req.method === 'OPTIONS') {
    // Response already sent by handleCors or the underlying cors middleware
    // Return explicitly to prevent further execution in this middleware
    return;
  }
  // --- END ADDED CHECK ---
  const authHeader = req.headers.authorization;
  console.log(`AuthMiddleware: Received headers for path ${req.url}`); // Keep logging
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    
    return res
      .status(401)
      .json({ message: "Authorization token not found or invalid" });
  }
  const token = authHeader.split(" ")[1];
  // try {
  //   const decoded = jwt.verify(token, JWT_SECRET);
  //   req.user = decoded;
  //   return handler(req, res);
  // } catch (error) {
  //   // --- ADD THIS LINE ---
  //   console.error("JWT Verification Error:", error.message, "Token:", token);
  //   // --------------------
  //   return res.status(401).json({ message: "Invalid or expired token" });
  // }
  try {
    // Ensure JWT_SECRET is actually being passed if it exists
    if (!JWT_SECRET) throw new Error("JWT_SECRET is not configured on the server.");

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    console.log("AuthMiddleware: Token verified successfully for user:", decoded.email);
    return handler(req, res); // Call the actual API route handler
  } catch (error) {
    console.error(
        `AuthMiddleware: JWT Verification FAILED! Path: ${req.url}, Error: ${error.message}, Token (first 10 chars): ${token.substring(0, 10)}...`,
        "Secret used (first 5 chars):", JWT_SECRET ? JWT_SECRET.substring(0, 5) + "..." : "MISSING!"
    );
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// --- Modify ownerMiddleware similarly ---
export const ownerMiddleware = (handler) =>
  authMiddleware(async (req, res) => { // It already uses authMiddleware which now handles CORS
    // The check below only runs AFTER successful auth + CORS
    if (req.user.role !== "owner") {
       console.error(`OwnerMiddleware: Access denied for user role: ${req.user.role} on path ${req.url}`);
      return res
        .status(403)
        .json({ message: "Access denied. Owner role required." });
    }
    return handler(req, res);
  });
