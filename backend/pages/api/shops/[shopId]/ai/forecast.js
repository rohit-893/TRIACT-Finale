// backend/pages/api/shops/[shopId]/ai/forecast.js
import connectDB from "../../../../../../../lib/db.js";
import Product from "../../../../../../../models/Product.js";
import Order from "../../../../../../../models/Order.js";
import { authMiddleware } from "../../../../../../../lib/auth.js";
import { getOpenAIClient } from "../../../../../../../lib/openai.js";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  await connectDB();
  const { shopId } = req.query;

  if (req.user.shopId !== shopId) {
    return res.status(403).json({ message: "Access denied." });
  }

  try {
    console.log("[AI FORECAST] Fetching products and orders...");

    const products = await Product.find({ shopId });
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const orders = await Order.find({
      shopId,
      date: { $gte: ninetyDaysAgo },
    });

    console.log(
      `[AI FORECAST] Found ${products.length} products and ${orders.length} orders`
    );

    // Calculate sales velocity for each product
    const productSales = {};

    products.forEach((p) => {
      productSales[p._id.toString()] = {
        product: p,
        totalSold: 0,
      };
    });

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const prodId = item.productId.toString();
        if (productSales[prodId]) {
          productSales[prodId].totalSold += item.quantity;
        }
      });
    });

    // Calculate forecast for each product
    const productsWithForecast = await Promise.all(
      Object.values(productSales).map(async ({ product, totalSold }) => {
        const avgDailySales = totalSold / 90;

        let forecastDays = null;
        let forecastText = "N/A";

        if (avgDailySales > 0 && product.stock > 0) {
          forecastDays = Math.floor(product.stock / avgDailySales);
          forecastText = `${forecastDays} days`;
        } else if (product.stock === 0) {
          forecastText = "Out of stock";
        } else if (avgDailySales === 0) {
          forecastText = "No sales data";
        }

        return {
          _id: product._id,
          name: product.name,
          category: product.category,
          price: product.price,
          cost: product.cost,
          stock: product.stock,
          lowStockThreshold: product.lowStockThreshold,
          totalSold90Days: totalSold,
          avgDailySales: parseFloat(avgDailySales.toFixed(2)),
          forecastDays: forecastDays,
          forecastText: forecastText,
        };
      })
    );

    console.log("[AI FORECAST] Forecast calculated for all products");

    res.status(200).json({
      products: productsWithForecast,
    });
  } catch (error) {
    console.error("[AI FORECAST] Error:", error);
    res.status(500).json({
      message: "Failed to generate forecast",
      error: error.message,
    });
  }
}

export default authMiddleware(handler);
