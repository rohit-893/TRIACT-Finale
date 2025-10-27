import connectDB from "../../../../../lib/db.js";
import User from "../../../../../models/User.js";
import Shop from "../../../../../models/Shop.js";
import { ownerMiddleware } from "../../../../../lib/auth.js";
import handleCors from '../../../../../middleware/cors.js';

async function handler(req, res) {
  // --- ADD THIS LINE ---
  await handleCors(req, res); // Run the CORS middleware
  // --------------------
  const { shopId, employeeId } = req.query;

  if (req.user.shopId !== shopId) {
    return res.status(403).json({
      message: "You do not have permission to manage employees for this shop.",
    });
  }

  await connectDB();

  switch (req.method) {
    case "PUT":
      try {
        const employee = await User.findOne({ _id: employeeId, shopId });
        if (!employee || employee.role !== "employee") {
          return res
            .status(404)
            .json({ message: "Employee not found in this shop." });
        }
        const { salary } = req.body;
        if (!salary) {
          return res
            .status(400)
            .json({ message: "Salary object is required for update." });
        }

        if (salary.amount !== undefined) {
          employee.salary.amount = salary.amount;
        }
        if (salary.status !== undefined) {
          employee.salary.status = salary.status;
        }

        const updatedEmployee = await employee.save();
        const employeeResponse = { ...updatedEmployee._doc };
        delete employeeResponse.passwordHash;
        res.status(200).json({
          message: "Employee updated successfully",
          employee: employeeResponse,
        });
      } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
      }
      break;

    case "DELETE":
      try {
        const deletedUser = await User.findOneAndDelete({
          _id: employeeId,
          shopId: shopId,
        });
        if (!deletedUser) {
          return res.status(404).json({ message: "Employee not found." });
        }
        await Shop.findByIdAndUpdate(shopId, {
          $pull: { employees: employeeId },
        });
        res.status(200).json({ message: "Employee removed successfully" });
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
