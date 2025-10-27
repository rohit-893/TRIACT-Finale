import fs from "fs";
import path from "path";
import connectDB from "../../../../../lib/db";
import Invoice from "../../../../../models/Invoice";
import { authMiddleware } from "../../../../../lib/auth";

async function handler(req, res) {
  // --- ADD THIS LINE ---
  await handleCors(req, res); // Run the CORS middleware
  // --------------------
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { shopId, invoiceId } = req.query;

  if (req.user.shopId !== shopId) {
    return res
      .status(403)
      .json({ message: "Access denied to this shop's resources." });
  }

  await connectDB();

  try {
    const invoice = await Invoice.findOne({ _id: invoiceId, shopId });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    const filePath = path.join(process.cwd(), "public", invoice.pdfPath);

    if (!fs.existsSync(filePath)) {
      console.error(
        `File not found for invoice ${invoiceId} at path ${filePath}`
      );
      return res
        .status(404)
        .json({ message: "Invoice file not found on server." });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="invoice-${invoice.orderId}.pdf"`
    );

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Get Invoice Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export default authMiddleware(handler);
