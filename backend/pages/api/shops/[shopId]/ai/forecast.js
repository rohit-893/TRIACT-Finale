// backend/pages/api/shops/[shopId]/ai/forecast.js

import connectDB from '../../../../../lib/db.js';
import Product from '../../../../../models/Product.js';
import Order from '../../../../../models/Order.js';
import { authMiddleware } from '../../../../../lib/auth.js';
import mongoose from 'mongoose';

const FORECAST_DAYS = 90;

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  await connectDB();
  const { shopId } = req.query;

  if (req.user.shopId !== shopId) {
    return res.status(403).json({ message: 'Access denied.' });
  }

  try {
    // Get sales history from past 90 days
    const salesHistoryDate = new Date();
    salesHistoryDate.setDate(salesHistoryDate.getDate() - FORECAST_DAYS);

    const salesData = await Order.aggregate([
      {
        $match: {
          shopId: new mongoose.Types.ObjectId(shopId),
          date: { $gte: salesHistoryDate },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          totalSold: { $sum: '$items.quantity' },
        },
      },
    ]);

    const salesMap = new Map();
    salesData.forEach((item) => {
      salesMap.set(item._id.toString(), item.totalSold);
    });

    // Get all products
    const products = await Product.find({ shopId }).lean();

    // Calculate forecast for each product
    const forecastResults = products.map((product) => {
      const totalSold = salesMap.get(product._id.toString()) || 0;
      const averageDailySales = totalSold / FORECAST_DAYS;

      let daysUntilStockOut;
      if (averageDailySales === 0) {
        daysUntilStockOut = Infinity;
      } else {
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
    console.error('Forecast Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

export default authMiddleware(handler);
