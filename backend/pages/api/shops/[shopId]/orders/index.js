// backend/pages/api/shops/[shopId]/orders/index.js

import connectDB from "../../../../../lib/db.js";
import Order from "../../../../../models/Order.js";
import Product from "../../../../../models/Product.js";
import Invoice from "../../../../../models/Invoice.js";
import Notification from "../../../../../models/Notification.js";
import { authMiddleware } from "../../../../../lib/auth.js";
import { put } from "@vercel/blob";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

// Helper to generate invoice PDF and return buffer
function generateInvoicePDF(invoice, order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc.fontSize(20).text("INVOICE", { align: "center" });
    doc.moveDown();

    // Invoice details
    doc.fontSize(12);
    doc.text(`Invoice ID: ${invoice._id}`);
    doc.text(`Date: ${new Date(order.date).toLocaleDateString("en-IN")}`);
    doc.text(`Customer: ${order.customerName}`);
    doc.text(`Biller: ${order.billerName}`);
    doc.moveDown();

    // Table header
    doc.fontSize(10).text("Items:", { underline: true });
    doc.moveDown(0.5);

    // Items
    order.items.forEach((item, index) => {
      doc.text(
        `${index + 1}. ${item.name} - Qty: ${item.quantity} x ₹${item.price} = ₹${
          item.quantity * item.price
        }`
      );
    });

    doc.moveDown();
    doc.fontSize(12).text(`Total: ₹${order.total}`, { align: "right" });

    doc.end();
  });
}

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  await connectDB();
  const { shopId } = req.query;
  const { customerName, items } = req.body;

  // ===== DETAILED LOGGING =====
  console.log("[ORDER] Received request body:", JSON.stringify(req.body, null, 2));
  console.log("[ORDER] Items received:", items);
  console.log("[ORDER] User from token:", req.user);
  console.log("[ORDER] Biller name will be:", req.user?.name);

  // ===== VALIDATION =====
  if (req.user.shopId !== shopId) {
    return res.status(403).json({ message: "Access denied." });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    console.error("[ORDER] Validation failed: items is invalid");
    return res.status(400).json({ message: "Order must contain items." });
  }

  if (!req.user || !req.user.name) {
    console.error("[ORDER] Validation failed: billerName missing from token");
    return res.status(400).json({ message: "Biller name not found in authentication token." });
  }

  try {
    // Validate and prepare order items
    let total = 0;
    let totalProfit = 0;
    const orderItems = [];

    console.log("[ORDER] Starting product validation for", items.length, "items");

    for (const item of items) {
      console.log(`[ORDER] Processing product: ${item.productId}, quantity: ${item.quantity}`);

      const product = await Product.findOne({
        _id: item.productId,
        shopId: shopId,
      });

      console.log(`[ORDER] Product found:`, product ? product.name : "NOT FOUND");

      if (!product) {
        console.error(`[ORDER] ERROR: Product ${item.productId} not found in shop ${shopId}`);
        return res.status(400).json({
          message: `Product not found: ${item.productId}`,
        });
      }

      console.log(`[ORDER] Product "${product.name}" - Stock: ${product.stock}, Requested: ${item.quantity}`);

      if (product.stock < item.quantity) {
        console.error(`[ORDER] ERROR: Insufficient stock for "${product.name}"`);
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
        });
      }

      const itemTotal = product.price * item.quantity;
      const itemCost = product.cost * item.quantity;
      const itemProfit = itemTotal - itemCost;

      orderItems.push({
        productId: product._id,
        name: product.name,
        quantity: item.quantity,
        price: product.price,
        cost: product.cost,
      });

      total += itemTotal;
      totalProfit += itemProfit;

      // Update stock
      product.stock -= item.quantity;
      await product.save();
      console.log(`[ORDER] Updated stock for "${product.name}": ${product.stock + item.quantity} → ${product.stock}`);

      // Create low stock notification if needed
      if (product.stock <= product.lowStockThreshold) {
        const existingNotification = await Notification.findOne({
          shopId: shopId,
          message: {
            $regex: `Low stock alert: ${product.name}`,
            $options: "i",
          },
          isRead: false,
        });

        if (!existingNotification) {
          await Notification.create({
            shopId: shopId,
            message: `Low stock alert: ${product.name} has only ${product.stock} units left`,
            isRead: false,
          });
          console.log(`[ORDER] Created low stock notification for "${product.name}"`);
        }
      }
    }

    console.log("[ORDER] All products validated. Creating order...");
    console.log("[ORDER] Total:", total, "Profit:", totalProfit);

    // Create order
    const newOrder = await Order.create({
      shopId: shopId,
      customerName: customerName || "Walk-in Customer",
      billerName: req.user.name,
      items: orderItems,
      total: total,
      totalProfit: totalProfit,
      date: new Date(),
    });

    console.log("[ORDER] Order created:", newOrder._id);

    // ===== PDF GENERATION WITH ENVIRONMENT DETECTION =====
    let pdfPath = "";
    const isDevelopment = process.env.NODE_ENV !== "production";

    try {
      const invoiceBuffer = await generateInvoicePDF(
        { _id: newOrder._id },
        newOrder
      );

      if (isDevelopment) {
        // DEVELOPMENT: Save to local file system
        console.log("[INVOICE] Development mode: Saving PDF locally");

        const invoicesDir = path.join(process.cwd(), "public", "invoices");

        // Create directory if it doesn't exist
        if (!fs.existsSync(invoicesDir)) {
          fs.mkdirSync(invoicesDir, { recursive: true });
          console.log("[INVOICE] Created invoices directory:", invoicesDir);
        }

        const filename = `invoice-${newOrder._id}.pdf`;
        const filepath = path.join(invoicesDir, filename);

        fs.writeFileSync(filepath, invoiceBuffer);
        pdfPath = `/invoices/${filename}`;

        console.log("[INVOICE] PDF saved locally at:", filepath);
      } else {
        // PRODUCTION: Upload to Vercel Blob
        console.log("[INVOICE] Production mode: Uploading to Vercel Blob");

        const blob = await put(`invoice-${newOrder._id}.pdf`, invoiceBuffer, {
          access: "public",
          contentType: "application/pdf",
        });

        pdfPath = blob.url;
        console.log("[INVOICE] PDF uploaded to Vercel Blob:", pdfPath);
      }

      // Create invoice record
      await Invoice.create({
        shopId: shopId,
        orderId: newOrder._id,
        pdfPath: pdfPath,
        customerName: newOrder.customerName,
        billerName: newOrder.billerName,
        total: newOrder.total,
        date: newOrder.date,
      });

      console.log("[INVOICE] Invoice record created");
    } catch (pdfError) {
      // If PDF generation fails, log but don't fail the order
      console.error("[INVOICE] PDF generation failed:", pdfError);
      console.log("[INVOICE] Order created successfully, but invoice PDF failed");

      // Create invoice record with error path
      await Invoice.create({
        shopId: shopId,
        orderId: newOrder._id,
        pdfPath: "/invoices/error.pdf",
        customerName: newOrder.customerName,
        billerName: newOrder.billerName,
        total: newOrder.total,
        date: newOrder.date,
      });
    }

    res.status(201).json({
      message: "Order created successfully",
      order: newOrder,
      invoicePath: pdfPath,
    });
  } catch (error) {
    console.error("[ORDER] Error:", error);
    res.status(500).json({ 
      message: "Internal Server Error", 
      error: error.message 
    });
  }
}

export default authMiddleware(handler);
