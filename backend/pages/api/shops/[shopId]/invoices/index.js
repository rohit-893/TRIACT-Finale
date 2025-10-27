import connectDB from "../../../../../lib/db.js";
import Invoice from "../../../../../models/Invoice.js";
import { authMiddleware } from "../../../../../lib/auth.js";
import handleCors from '../../../middleware/cors.js';

async function handler(req, res) {
  // --- ADD THIS LINE ---
  await handleCors(req, res); // Run the CORS middleware
  // --------------------
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { shopId } = req.query;
  if (req.user.shopId !== shopId) {
    return res.status(403).json({ message: "Access denied." });
  }

  await connectDB();

  try {
    const invoices = await Invoice.find({ shopId }).sort({ createdAt: -1 });
    res.status(200).json({ invoices });
  } catch (error) {
    console.error("Get Invoices Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export default authMiddleware(handler);
