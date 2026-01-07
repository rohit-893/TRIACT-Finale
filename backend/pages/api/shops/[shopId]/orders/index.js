// backend/pages/api/shops/[shopId]/orders/index.js
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { put } from '@vercel/blob'; // Import Vercel Blob 'put' function
import connectDB from "../../../../../lib/db.js";
import Order from "../../../../../models/Order.js";
import Product from "../../../../../models/Product.js";
import Invoice from "../../../../../models/Invoice.js";
import Shop from "../../../../../models/Shop.js";
import Notification from "../../../../../models/Notification.js";
import { authMiddleware } from "../../../../../lib/auth.js"; // Using authMiddleware which handles CORS
import mongoose from "mongoose";

// PDF Generation function (remains the same)
async function generateInvoicePDF(order, shop, filePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

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
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });
}

// Main API Route Handler
async function handler(req, res) {
  // CORS is handled by authMiddleware now

  const { shopId } = req.query;
  // Authentication check happens in authMiddleware
  // req.user should be available here

  await connectDB();

  switch (req.method) {
    case "POST":
      const { customerName, items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Order must contain items." });
      }

      const session = await mongoose.startSession();
      session.startTransaction();
      let savedOrder = null; // Define savedOrder outside try block for cleanup
      let tempPdfPath = null; // Define tempPdfPath for cleanup

      try {
        // --- 1. Validate items, calculate totals ---
        let totalRevenue = 0;
        let totalCost = 0;
        const processedItems = [];
        for (const item of items) {
          const product = await Product.findById(item.productId).session(session);
          if (!product || product.shopId.toString() !== shopId) {
            throw new Error(`Product with ID ${item.productId} not found or doesn't belong to this shop.`);
          }
          if (product.stock < item.quantity) {
            throw new Error(`Not enough stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
          }
          const itemRevenue = product.price * item.quantity;
          const itemCost = product.cost * item.quantity;
          totalRevenue += itemRevenue;
          totalCost += itemCost;
          processedItems.push({
            productId: item.productId,
            name: product.name,
            quantity: item.quantity,
            price: product.price,
            cost: product.cost,
          });
        }
        const totalProfit = totalRevenue - totalCost;

        // --- 2. Create the Order document ---
        const order = new Order({
          shopId,
          customerName: customerName || "Walk-in Customer",
          billerName: req.user.name, // Get biller name from authenticated user
          items: processedItems,
          total: totalRevenue,
          totalProfit: totalProfit,
        });
        savedOrder = await order.save({ session }); // Assign to outer scope variable

        // --- 3. Update Product Stock and check notifications ---
        for (const item of processedItems) {
          const product = await Product.findById(item.productId).session(session); // Re-fetch needed? Maybe not.
          const newStock = product.stock - item.quantity;
          // Check if stock crossed the threshold
          if (product.stock > product.lowStockThreshold && newStock <= product.lowStockThreshold) {
            await Notification.create([{
              shopId,
              message: `${product.name} is low on stock! Only ${newStock} left.`,
            }], { session });
          }
          // Update stock atomically
          await Product.updateOne({ _id: item.productId }, { $inc: { stock: -item.quantity } }, { session });
        }

        // --- 4. Generate PDF to /tmp directory ---
        const shop = await Shop.findById(shopId).session(session);
        if (!shop) throw new Error("Shop details not found.");

        const tempDir = path.join('/tmp'); // Base /tmp directory
        const filename = `invoice-${savedOrder._id}.pdf`;
        tempPdfPath = path.join(tempDir, filename); // Assign to outer scope variable

        console.log(`Generating PDF to temporary path: ${tempPdfPath}`);
        await generateInvoicePDF(savedOrder, shop, tempPdfPath); // Generate PDF locally in /tmp
        console.log(`Generated PDF successfully at ${tempPdfPath}`);

        // --- 5. Upload PDF from /tmp to Vercel Blob ---
        const pdfBuffer = fs.readFileSync(tempPdfPath); // Read the generated PDF into a buffer
        console.log(`Read PDF buffer, size: ${pdfBuffer.length}`);
        if(pdfBuffer.length === 0) throw new Error("Generated PDF file is empty.");


        // Define a structured path in Blob storage (e.g., invoices/SHOP_ID/invoice-ORDER_ID.pdf)
        const blobPathname = `invoices/${shopId}/${filename}`;
        console.log(`Uploading to Vercel Blob as: ${blobPathname}`);

        // Perform the upload
        const blob = await put(blobPathname, pdfBuffer, {
          access: 'public', // Make it publicly accessible via its URL
          contentType: 'application/pdf' // Set the correct content type
        });
        console.log('Upload successful. Blob URL:', blob.url);
        if (!blob.url) throw new Error("Vercel Blob upload failed, URL not returned.");

        // --- 6. Create Invoice Document with Blob URL ---
        const invoice = new Invoice({
          shopId,
          orderId: savedOrder._id,
          customerName: savedOrder.customerName,
          billerName: savedOrder.billerName,
          total: savedOrder.total,
          pdfPath: blob.url, // SAVE THE PUBLIC BLOB URL
        });
        const savedInvoice = await invoice.save({ session }); // Save invoice doc
        console.log('Invoice document saved with Blob URL:', savedInvoice.pdfPath);

        // --- 7. Clean up temporary file ---
        try {
          fs.unlinkSync(tempPdfPath);
          console.log(`Deleted temporary file: ${tempPdfPath}`);
          tempPdfPath = null; // Reset path after deletion
        } catch (unlinkErr) {
          console.error(`Failed to delete temporary file ${tempPdfPath}:`, unlinkErr);
          // Log error but don't fail the transaction just for this
        }

        // --- 8. Commit Transaction ---
        await session.commitTransaction();
        console.log(`Order ${savedOrder._id} created successfully.`);
        res.status(201).json({
          message: "Order created successfully",
          order: savedOrder,
          invoice: savedInvoice, // Return the saved invoice doc (includes Blob URL)
        });

      } catch (error) {
        await session.abortTransaction();
        console.error("Create Order Error:", error.message, error.stack);

        // Attempt to clean up temp file on error too
        if (tempPdfPath && fs.existsSync(tempPdfPath)) {
          try {
            fs.unlinkSync(tempPdfPath);
            console.log(`Cleaned up temporary file on error: ${tempPdfPath}`);
          } catch (e) {
            console.error(`Failed cleanup temp file on error ${tempPdfPath}:`, e);
          }
        }
        res.status(400).json({ message: error.message || "Failed to create order." });
      } finally {
        session.endSession();
      }
      break;

    case "GET":
      // Existing GET logic to fetch orders
      try {
        const orders = await Order.find({ shopId }).sort({ date: -1 });
        res.status(200).json({ orders });
      } catch (error) {
        console.error("Get Orders Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
      break;

    default:
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// Wrap with auth middleware which handles CORS
export default authMiddleware(handler);