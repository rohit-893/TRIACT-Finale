import connectDB from "../../../../../lib/db.js";
import Product from "../../../../../models/Product.js";
import Shop from "../../../../../models/Shop.js";
import { authMiddleware } from "../../../../../lib/auth.js";
import handleCors from '../../../middleware/cors.js';

async function handler(req, res) {
  // --- ADD THIS LINE ---
  await handleCors(req, res); // Run the CORS middleware
  // --------------------
  const { shopId } = req.query;

  if (req.user.shopId !== shopId) {
    return res
      .status(403)
      .json({ message: "Access denied to this shop's resources." });
  }

  await connectDB();

  switch (req.method) {
    case "GET":
      try {
        const products = await Product.find({ shopId }).sort({ createdAt: -1 });
        res.status(200).json({ products });
      } catch (error) {
        console.error("Get Products Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
      break;

    case "POST":
      if (req.user.role !== "owner") {
        return res
          .status(403)
          .json({ message: "Only owners can add new products." });
      }

      try {
        const { name, category, price, cost, stock } = req.body;
        if (
          !name ||
          !category ||
          price === undefined ||
          cost === undefined ||
          stock === undefined
        ) {
          return res
            .status(400)
            .json({
              message: "Missing required product fields, including cost.",
            });
        }

        const newProduct = new Product({
          shopId,
          name,
          category,
          price,
          cost,
          stock,
        });

        const savedProduct = await newProduct.save();

        await Shop.findByIdAndUpdate(shopId, {
          $push: { products: savedProduct._id },
        });

        res.status(201).json({
          message: "Product added successfully",
          product: savedProduct,
        });
      } catch (error) {
        console.error("Add Product Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
      break;

    default:
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

export default authMiddleware(handler);
