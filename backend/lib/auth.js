// backend/lib/auth.js
import jwt from "jsonwebtoken";

// --- Configuration ---
const JWT_SECRET = process.env.JWT_SECRET; // Read from Vercel Environment Variables
const allowedOrigin = process.env.FRONTEND_URL || 'https://triact-frontend.vercel.app'; // Read from Vercel env var, fallback for safety

// --- Initial Check ---
if (!JWT_SECRET) {
  console.error("CRITICAL: JWT_SECRET environment variable is missing or empty!");
}
if (!allowedOrigin) {
    console.warn("WARN: FRONTEND_URL environment variable is missing. Using default allowed origin.");
} else {
    console.log("Allowed CORS Origin:", allowedOrigin);
}

// --- Auth Middleware ---
export const authMiddleware = (handler) => async (req, res) => {
  // --- 1. Explicitly Handle CORS Preflight (OPTIONS Request) ---
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin); // Use the configured origin
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    console.log(`AuthMiddleware: Responding OK to OPTIONS preflight for path ${req.url}`);
    res.status(200).end(); // Respond 200 OK and END the response here
    return; // Stop further execution for OPTIONS requests
  }

  // --- 2. Proceed with Authentication for non-OPTIONS requests ---
  const authHeader = req.headers.authorization;
  console.log(`AuthMiddleware: Received headers for path ${req.url}, Method: ${req.method}`); // Keep logging

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error(`AuthMiddleware: No Bearer token found for path ${req.url}. Headers:`, JSON.stringify(req.headers));
    return res.status(401).json({ message: "Authorization token not found or invalid" });
  }
  const token = authHeader.split(" ")[1];

  // --- 3. Verify JWT Token ---
  console.log("AuthMiddleware: Verifying token. Secret used (first 5 chars):", JWT_SECRET ? JWT_SECRET.substring(0, 5) + "..." : "MISSING!");

  try {
    if (!JWT_SECRET) {
      console.error(`AuthMiddleware: JWT_SECRET is missing during verification for path ${req.url}`);
      throw new Error("JWT_SECRET is not configured on the server.");
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach user payload to the request object
    console.log("AuthMiddleware: Token verified successfully for user:", decoded.email, `Path: ${req.url}`);

    // --- 4. Call the actual API route handler ---
    return handler(req, res);

  } catch (error) {
    // Log the specific verification error
    console.error(
        `AuthMiddleware: JWT Verification FAILED! Path: ${req.url}, Error: ${error.message}, Token (first 10 chars): ${token ? token.substring(0, 10) + "..." : "N/A"}`,
        "Secret used (first 5 chars):", JWT_SECRET ? JWT_SECRET.substring(0, 5) + "..." : "MISSING!"
    );
    return res.status(401).json({ message: `Invalid or expired token. Error: ${error.message}` }); // Include error message for debugging
  }
};

// --- Owner Middleware (Wraps Auth Middleware) ---
export const ownerMiddleware = (handler) =>
  authMiddleware(async (req, res) => { // It implicitly runs authMiddleware first
    // This check only runs AFTER successful auth + CORS
    if (req.user.role !== "owner") {
      console.error(`OwnerMiddleware: Access denied for user role: ${req.user?.role || 'unknown'} on path ${req.url}`);
      return res.status(403).json({ message: "Access denied. Owner role required." });
    }
    // Call the actual API route handler if user is owner
    return handler(req, res);
  });

// --- Function to Sign Tokens (Used in login.js) ---
export const signToken = (user) => {
  if (!JWT_SECRET) {
    throw new Error("Cannot sign token: JWT_SECRET is not configured.");
  }
  const payload = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    shopId: user.shopId,
    // Avoid including sensitive info like passwordHash
    // Include salary details if needed by the frontend directly after login
    salary: user.salary ? { amount: user.salary.amount, status: user.salary.status } : undefined,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d", // Token expires in 7 days
  });
};