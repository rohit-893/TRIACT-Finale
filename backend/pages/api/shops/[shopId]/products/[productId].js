import connectDB from "../../../../../lib/db.js";
import Product from "../../../../../models/Product.js";
import Shop from "../../../../../models/Shop.js";
import { ownerMiddleware } from "../../../../../lib/auth.js"; // Use general auth, not owner-only


// This is the updated handler with role-based permissions
async function handler(req, res) {
  
  const { shopId, productId } = req.query;

  // Security Check: Ensure the user belongs to the shop
  if (req.user.shopId !== shopId) {
    return res.status(403).json({
      message: "You do not have permission to modify products in this shop.",
    });
  }

  await connectDB();

  const product = await Product.findOne({ _id: productId, shopId });
  if (!product) {
    return res.status(404).json({ message: "Product not found in this shop." });
  }

  switch (req.method) {
    case "PUT":
      try {
        const { price, stock } = req.body;
        const updateData = {};

        // Only allow owners to change the price
        if (price !== undefined) {
          if (req.user.role !== "owner") {
            return res
              .status(403)
              .json({ message: "Only owners can change product prices." });
          }
          updateData.price = price;
        }

        if (stock !== undefined) {
          updateData.stock = stock;
        }

        if (Object.keys(updateData).length === 0) {
          return res
            .status(400)
            .json({ message: "No valid update fields provided." });
        }

        const updatedProduct = await Product.findByIdAndUpdate(
          productId,
          updateData,
          { new: true }
        );
        res.status(200).json({
          message: "Product updated successfully",
          product: updatedProduct,
        });
      } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
      }
      break;

    case "DELETE":
      if (req.user.role !== "owner") {
        return res
          .status(403)
          .json({ message: "Only owners can delete products." });
      }
      try {
        await Product.findByIdAndDelete(productId);
        await Shop.findByIdAndUpdate(shopId, {
          $pull: { products: productId },
        });
        res.status(200).json({ message: "Product deleted successfully" });
      } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
      }
      break;

    default:
      res.setHeader("Allow", ["PUT", "DELETE"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

export default ownerMiddleware(handler);
