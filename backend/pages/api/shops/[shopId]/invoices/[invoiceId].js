import fs from "fs";
import path from "path";
import connectDB from "../../../../../lib/db";
import Invoice from "../../../../../models/Invoice";
import { authMiddleware } from "../../../../../lib/auth";


async function handler(req, res) {
  
  // --- ADDED: Handle OPTIONS explicitly if needed (though handleCors should cover it) ---
   if (req.method === 'OPTIONS') {
     console.log(`Invoice Route: Responding OK to OPTIONS preflight.`);
     res.status(200).end();
     return;
   }
  // --- END ADDED ---

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { shopId, invoiceId } = req.query;

  // Authentication check (req.user is added by authMiddleware)
  if (!req.user || req.user.shopId !== shopId) {
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

    // --- CHANGE: Construct path to /tmp ---
    // Extract filename from the potentially misleading saved path
    const filename = path.basename(invoice.pdfPath); // e.g., "invoice-68ffbabd4b5f34cd0ea95f0e.pdf"
    const filePath = path.join('/tmp', 'invoices', filename); // Construct path to /tmp/invoices/FILENAME
    // --- END CHANGE ---
    console.log(`Attempting to read invoice PDF from: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      console.error(
        `Invoice file NOT FOUND in /tmp for invoice ${invoiceId} at path ${filePath}`
      );
      return res
        .status(404)
        .json({ message: "Invoice file not found on server (temporary storage). It might have expired or failed to save." });
    }

    // --- CHANGE: Stream the file ---
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${filename}"` // Use the extracted filename
    );

    const fileStream = fs.createReadStream(filePath);

    // Handle errors during streaming
    fileStream.on('error', (err) => {
        console.error('Error streaming PDF file:', err);
        // Check if headers were already sent
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error reading invoice file.' });
        } else {
            // If headers are sent, we can't send a JSON error, just end the stream abruptly
            res.end();
        }
    });
    // --- END CHANGE ---
  } catch (error) {
    console.error("Get Invoice [invoiceId] Error:", error);
    if (!res.headersSent) {
        res.status(500).json({ message: "Internal Server Error" });
    } else {
         res.end();
    }
  }
}

export default authMiddleware(handler);
