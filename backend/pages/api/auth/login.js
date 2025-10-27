import connectDB from "../../../lib/db.js";
import User from "../../../models/User.js";
import { signToken } from "../../../lib/auth.js";

export default async function handler(req, res) {
  // --- ADD THIS BLOCK ---
  if (req.method === 'OPTIONS') {
    // Handle CORS preflight request
    res.setHeader('Access-Control-Allow-Origin', '*'); // Or use your specific frontend URL
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).json({}); // Respond OK
  }
  // --- END OF BLOCK ---
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  await connectDB();
  const { email, password } = req.body;

  console.log("--- [LOGIN] ATTEMPT ---");
  console.log("[LOGIN] Received login request for email:", email);

  try {
    const user = await User.findOne({ email }).select("+passwordHash");

    console.log("[LOGIN] User object found in database:", user);

    if (!user) {
      console.log("[LOGIN] User not found.");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log("[LOGIN] Password does not match.");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log("[LOGIN] Password matches. Generating token.");
    const token = signToken(user);
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      shopId: user.shopId,
    };

    res
      .status(200)
      .json({ message: "Logged in successfully", token, user: userResponse });
  } catch (error) {
    console.error("[LOGIN] CRITICAL ERROR caught in try-catch block:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
