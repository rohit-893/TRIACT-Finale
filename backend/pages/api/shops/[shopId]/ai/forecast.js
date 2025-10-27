// backend/pages/api/shops/[shopId]/ai/forecast.js

import connectDB from "../../../../../lib/db.js";
import Product from "../../../../../models/Product.js";
import Order from "../../../../../models/Order.js";
import { authMiddleware } from "../../../../../lib/auth.js";
import mongoose from "mongoose";

// The number of days to look back for sales history
const FORECAST_DAYS = 90;

async function handler(req, res) {
  // --- ADD THIS LINE ---
  await handleCors(req, res); // Run the CORS middleware
  // --------------------
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  await connectDB();
  const { shopId } = req.query;

  // Security check: Ensure the user is authenticated for this shop
  if (req.user.shopId !== shopId) {
    return res.status(403).json({ message: "Access denied." });
  }

  try {
    // === Step 1: Get Historical Sales Data ===
    const salesHistoryDate = new Date();
    salesHistoryDate.setDate(salesHistoryDate.getDate() - FORECAST_DAYS);

    const salesData = await Order.aggregate([
      {
        $match: {
          shopId: new mongoose.Types.ObjectId(shopId),
          date: { $gte: salesHistoryDate },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          totalSold: { $sum: "$items.quantity" },
        },
      },
    ]);

    // Create a Map for efficient lookups: { "productId" => totalSold }
    const salesMap = new Map(
      salesData.map((item) => [item._id.toString(), item.totalSold])
    );

    // === Step 2: Get Current Stock for all products ===
    // .lean() is a performance optimization to get plain JS objects
    const products = await Product.find({ shopId }).lean();

    // === Step 3: Combine data and calculate forecast ===
    const forecastResults = products.map((product) => {
      const totalSold = salesMap.get(product._id.toString()) || 0;
      const averageDailySales = totalSold / FORECAST_DAYS;
      
      let daysUntilStockOut;
      if (averageDailySales <= 0) {
        // If it's not selling, stock out is "Infinity"
        daysUntilStockOut = Infinity;
      } else {
        // Calculate days left
        daysUntilStockOut = product.stock / averageDailySales;
      }

      return {
        ...product,
        forecast: {
          totalSoldLast90Days: totalSold,
          averageDailySales: averageDailySales,
          daysUntilStockOut: daysUntilStockOut,
        },
      };
    });

    res.status(200).json({ products: forecastResults });
  } catch (error) {
    console.error("Forecast Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export default authMiddleware(handler);