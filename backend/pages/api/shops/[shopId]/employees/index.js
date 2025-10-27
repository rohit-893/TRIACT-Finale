import connectDB from "../../../../../lib/db.js";
import User from "../../../../../models/User.js";
import Shop from "../../../../../models/Shop.js";
import { ownerMiddleware } from "../../../../../lib/auth.js";
import handleCors from '../../../../../middleware/cors.js';

async function handler(req, res) {
  // --- ADD THIS LINE ---
  await handleCors(req, res); // Run the CORS middleware
  // --------------------
  const { shopId } = req.query;

  if (req.user.shopId !== shopId) {
    return res.status(403).json({
      message: "You do not have permission to manage employees for this shop.",
    });
  }

  await connectDB();

  switch (req.method) {
    case "GET":
      try {
        const shop = await Shop.findById(shopId).populate({
          path: "employees",
          select: "-passwordHash",
        });

        if (!shop) {
          return res.status(404).json({ message: "Shop not found." });
        }

        res.status(200).json({ employees: shop.employees });
      } catch (error) {
        console.error("Get Employees Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
      break;
    case "POST":
      try {
        const { name, email, password, salary } = req.body;
        if (
          !name ||
          !email ||
          !password ||
          !salary ||
          salary.amount === undefined
        ) {
          return res.status(400).json({
            message:
              "Missing required fields: name, email, password, salary amount.",
          });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res
            .status(409)
            .json({ message: "A user with this email already exists." });
        }

        const newEmployee = new User({
          name,
          email,
          passwordHash: password,
          role: "employee",
          shopId,
          salary: {
            amount: salary.amount,
            status: salary.status || "pending",
            nextPaymentDate: salary.nextPaymentDate || null,
          },
        });

        const savedEmployee = await newEmployee.save();

        await Shop.findByIdAndUpdate(shopId, {
          $push: { employees: savedEmployee._id },
        });

        const employeeResponse = { ...savedEmployee._doc };
        delete employeeResponse.passwordHash;

        res.status(201).json({
          message: "Employee added successfully",
          employee: employeeResponse,
        });
      } catch (error) {
        console.error("Add Employee Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
      break;
    default:
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

export default ownerMiddleware(handler);
