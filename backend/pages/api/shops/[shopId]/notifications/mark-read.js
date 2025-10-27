import connectDB from "../../../../../lib/db.js";
import Notification from "../../../../../models/Notification.js";
import { authMiddleware } from "../../../../../lib/auth.js";
import handleCors from '../../../../../middleware/cors.js';

async function handler(req, res) {
  // --- ADD THIS LINE ---
  await handleCors(req, res); // Run the CORS middleware
  // --------------------
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  await connectDB();
  const { shopId } = req.query;
  if (req.user.shopId !== shopId) {
    return res.status(403).json({ message: "Access denied." });
  }
  try {
    await Notification.updateMany(
      { shopId, isRead: false },
      { $set: { isRead: true } }
    );
    res.status(200).json({ message: "Notifications marked as read." });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export default authMiddleware(handler);
