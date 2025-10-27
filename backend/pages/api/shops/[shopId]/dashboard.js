import connectDB from "../../../../lib/db.js";
import Order from "../../../../models/Order.js";
import Product from "../../../../models/Product.js";
import { ownerMiddleware } from "../../../../lib/auth.js";
import mongoose from "mongoose";


async function handler(req, res) {
  
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  await connectDB();
  const { shopId } = req.query;

  if (req.user.shopId !== shopId) {
    return res
      .status(403)
      .json({ message: "Access denied to this shop's data." });
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOf30DaysAgo = new Date();
    startOf30DaysAgo.setDate(now.getDate() - 30);

    const totalProductTypes = await Product.countDocuments({ shopId });
    const totalProductQuantityResult = await Product.aggregate([
      { $match: { shopId: new mongoose.Types.ObjectId(shopId) } },
      { $group: { _id: null, total: { $sum: "$stock" } } },
    ]);
    const totalProductQuantity = totalProductQuantityResult[0]?.total || 0;
    const lowStockItems = await Product.find({
      shopId,
      $expr: { $lte: ["$stock", "$lowStockThreshold"] },
    }).limit(5);

    const monthlySales = await Order.aggregate([
      {
        $match: {
          shopId: new mongoose.Types.ObjectId(shopId),
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: { $multiply: ["$items.quantity", "$items.price"] },
          },
          totalCost: {
            $sum: { $multiply: ["$items.quantity", "$productDetails.cost"] },
          },
          unitsSold: { $sum: "$items.quantity" },
        },
      },
    ]);

    const revenueThisMonth = monthlySales[0]?.totalRevenue || 0;
    const unitsSoldThisMonth = monthlySales[0]?.unitsSold || 0;
    const profitThisMonth =
      revenueThisMonth - (monthlySales[0]?.totalCost || 0);

    const revenueTrend = await Order.aggregate([
      {
        $match: {
          shopId: new mongoose.Types.ObjectId(shopId),
          date: { $gte: startOf30DaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          totalRevenue: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const salesByCategory = await Order.aggregate([
      { $match: { shopId: new mongoose.Types.ObjectId(shopId) } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.category",
          totalSales: {
            $sum: { $multiply: ["$items.quantity", "$items.price"] },
          },
        },
      },
    ]);

    res.status(200).json({
      totalProductTypes,
      totalProductQuantity,
      lowStockItems,
      unitsSoldThisMonth,
      revenueThisMonth,
      profitThisMonth,
      revenueTrend: revenueTrend || [],
      salesByCategory: salesByCategory || [],
    });
  } catch (error) {
    console.error("Dashboard Data Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export default ownerMiddleware(handler);
