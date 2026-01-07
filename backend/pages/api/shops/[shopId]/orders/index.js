// backend/pages/api/shops/[shopId]/orders/index.js

import connectDB from "../../../../../lib/db.js";
import Order from "../../../../../models/Order.js";
import Product from "../../../../../models/Product.js";
import Invoice from "../../../../../models/Invoice.js";
import Notification from "../../../../../models/Notification.js";
import Shop from "../../../../../models/Shop.js";
import { authMiddleware } from "../../../../../lib/auth.js";
import { put } from "@vercel/blob";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

// ===== FIXED: Generate PDF and return buffer =====
function generateInvoicePDF(order, shop) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    // Collect PDF data into buffer
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const formatCurrency = (amount) => `Rs. ${(amount || 0).toFixed(2)}`;

    // Header
    doc.fontSize(20).text(shop.shopName, { align: "center" });
    doc.fontSize(10).text(shop.address || "", { align: "center" });
    doc.moveDown(2);

    // Invoice Title
    doc.fontSize(16).text("INVOICE", { align: "left" });
    const detailsTop = doc.y;
    doc.fontSize(11).text(`Invoice #: ${order._id}`, 50, detailsTop);
    doc.text(`Customer: ${order.customerName}`, 50, detailsTop + 15);

    // Date & Biller Info
    doc.text(`Date: ${new Date(order.date).toLocaleString("en-IN")}`, 300, detailsTop, { align: "right" });
    doc.text(`Billed by: ${order.billerName}`, 300, detailsTop + 15, { align: "right" });
    doc.moveDown(3);

    // Table Header
    const tableTop = doc.y;
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Item", 50, tableTop);
    doc.text("Quantity", 250, tableTop, { width: 100, align: "right" });
    doc.text("Unit Price", 350, tableTop, { width: 100, align: "right" });
    doc.text("Total", 450, tableTop, { width: 100, align: "right" });
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Table Rows
    let y = tableTop + 25;
    doc.font("Helvetica").fontSize(10);
    order.items.forEach((item) => {
      doc.text(item.name, 50, y);
      doc.text(item.quantity.toString(), 250, y, { width: 100, align: "right" });
      doc.text(formatCurrency(item.price), 350, y, { width: 100, align: "right" });
      doc.text(formatCurrency(item.quantity * item.price), 450, y, { width: 100, align: "right" });
      y += 20;
    });

    doc.moveTo(50, y).lineTo(550, y).stroke();
    doc.moveDown();

    // Grand Total
    doc.font("Helvetica-Bold").fontSize(14)
      .text(`Grand Total: ${formatCurrency(order.total)}`, 300, doc.y + 10, { width: 250, align: "right" });

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
    // ===== FETCH SHOP DETAILS =====
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

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

      if (!product) {
        console.error(`[ORDER] ERROR: Product ${item.productId} not found`);
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
      console.log(`[ORDER] Updated stock for "${product.name}"`);

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
          console.log(`[ORDER] Created low stock notification`);
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

    // ===== PDF GENERATION =====
    let pdfPath = "";
    let savedInvoice = null;
    const isDevelopment = process.env.NODE_ENV !== "production";

    try {
      console.log("[INVOICE] Generating PDF...");
      const invoiceBuffer = await generateInvoicePDF(newOrder, shop);
      console.log("[INVOICE] PDF buffer generated, size:", invoiceBuffer.length);

      if (isDevelopment) {
        // DEVELOPMENT: Save to local file system
        console.log("[INVOICE] Development mode: Saving PDF locally");

        const invoicesDir = path.join(process.cwd(), "public", "invoices");

        if (!fs.existsSync(invoicesDir)) {
          fs.mkdirSync(invoicesDir, { recursive: true });
          console.log("[INVOICE] Created invoices directory");
        }

        const filename = `invoice-${newOrder._id}.pdf`;
        const filepath = path.join(invoicesDir, filename);

        fs.writeFileSync(filepath, invoiceBuffer);
        pdfPath = `/invoices/${filename}`;

        console.log("[INVOICE] PDF saved locally:", pdfPath);
      } else {
        // PRODUCTION: Upload to Vercel Blob
        console.log("[INVOICE] Production mode: Uploading to Vercel Blob");

        const blob = await put(`invoice-${newOrder._id}.pdf`, invoiceBuffer, {
          access: "public",
          contentType: "application/pdf",
        });

        pdfPath = blob.url;
        console.log("[INVOICE] PDF uploaded:", pdfPath);
      }

      // Create invoice record
      savedInvoice = await Invoice.create({
        shopId: shopId,
        orderId: newOrder._id,
        pdfPath: pdfPath,
        customerName: newOrder.customerName,
        billerName: newOrder.billerName,
        total: newOrder.total,
        date: newOrder.date,
      });

      console.log("[INVOICE] Invoice record created:", savedInvoice._id);
    } catch (pdfError) {
      console.error("[INVOICE] PDF generation failed:", pdfError);

      // Create invoice record with error path
      savedInvoice = await Invoice.create({
        shopId: shopId,
        orderId: newOrder._id,
        pdfPath: "/invoices/error.pdf",
        customerName: newOrder.customerName,
        billerName: newOrder.billerName,
        total: newOrder.total,
        date: newOrder.date,
      });
      
      pdfPath = "/invoices/error.pdf";
    }

    // ===== RETURN COMPLETE RESPONSE =====
    res.status(201).json({
      message: "Order created successfully",
      order: newOrder,
      invoice: savedInvoice,
      invoicePath: pdfPath,
    });
  } catch (error) {
    console.error("[ORDER] Error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

export default authMiddleware(handler);
