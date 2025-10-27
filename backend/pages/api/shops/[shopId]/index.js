import connectDB from "../../../../lib/db.js";
import Shop from "../../../../models/Shop.js";
import { authMiddleware, ownerMiddleware } from "../../../../lib/auth.js";
import handleCors from '../../../../middleware/cors.js';

async function handler(req, res) {
  // --- ADD THIS LINE ---
  await handleCors(req, res); // Run the CORS middleware
  // --------------------
  const { shopId } = req.query;

  if (req.user.shopId !== shopId) {
    return res.status(403).json({ message: "Access denied." });
  }

  await connectDB();

  switch (req.method) {
    case "GET":
      try {
        const shop = await Shop.findById(shopId).select("-employees -products");
        if (!shop) {
          return res.status(404).json({ message: "Shop not found." });
        }
        res.status(200).json({ shop });
      } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
      }
      break;

    case "PUT":
      // The PUT logic is wrapped in ownerMiddleware for role-specific access
      return ownerMiddleware(async (req, res) => {
        try {
          const { shopName, address } = req.body;
          const updatedShop = await Shop.findByIdAndUpdate(
            shopId,
            { shopName, address },
            { new: true }
          );
          res
            .status(200)
            .json({ message: "Shop updated successfully", shop: updatedShop });
        } catch (error) {
          res.status(500).json({ message: "Internal Server Error" });
        }
      })(req, res);

    default:
      res.setHeader("Allow", ["GET", "PUT"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

export default authMiddleware(handler);
