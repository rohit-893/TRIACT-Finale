import connectDB from "../../lib/db.js";
import Product from "../../models/Product.js";
import { authMiddleware } from "../../lib/auth.js";
import handleCors from '../../middleware/cors.js';

const parseInvoiceText = (text) => {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const items = [];
  const lineRegex = /^(.*?)\s+(\d+)\s+Rs\./;

  for (const line of lines) {
    const match = line.trim().match(lineRegex);
    if (match) {
      items.push({
        quantity: parseInt(match[2], 10),
        name: match[1].trim(),
        rawLine: line,
      });
    }
  }
  return items;
};

async function handler(req, res) {
  // --- ADD THIS LINE ---
    await handleCors(req, res); // Run the CORS middleware
    // --------------------
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { shopId } = req.user;
  const { extractedText } = req.body;

  if (!extractedText) {
    return res.status(400).json({ message: "extractedText is required." });
  }

  await connectDB();
  try {
    console.log("--- [SCAN INVOICE] ATTEMPT ---");
    const parsedItems = parseInvoiceText(extractedText);
    console.log("[SCAN INVOICE] Parsed items:", parsedItems);

    const shopProducts = await Product.find({ shopId });

    const results = parsedItems.map((item) => {
      const lowerCaseItemName = item.name.toLowerCase();
      const matchedProduct = shopProducts.find(
        (p) =>
          p.name.toLowerCase().includes(lowerCaseItemName) ||
          lowerCaseItemName.includes(p.name.toLowerCase())
      );

      return {
        rawLine: item.rawLine,
        parsedQuantity: item.quantity,
        parsedName: item.name,
        status: matchedProduct ? "MATCHED" : "UNMATCHED",
        matchedProduct: matchedProduct
          ? {
              _id: matchedProduct._id,
              name: matchedProduct.name,
              stock: matchedProduct.stock,
            }
          : null,
      };
    });

    console.log("[SCAN INVOICE] Analysis complete. Sending results.");
    res.status(200).json({ results });
  } catch (error) {
    console.error("--- [SCAN INVOICE] CRITICAL ERROR ---:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export default authMiddleware(handler);
