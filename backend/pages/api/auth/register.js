import connectDB from "../../../lib/db.js";
import User from "../../../models/User.js";
import Shop from "../../../models/Shop.js";
import handleCors from '../../../middleware/cors.js'; // <-- ADD IMPORT


export default async function handler(req, res) {
  await handleCors(req, res); // <-- ADD THIS LINE FIRST
  
    // --- ADD THIS LOG ---
    console.log("Received request method:", req.method); // Keep logging if desired
  
    if (req.method !== "POST") {
      console.error("Method was not POST, returning 405.");
      return res.status(405).json({ message: "Method Not Allowed" });
    }


  await connectDB();
  const { name, email, password, role, shopId } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  if (role === "employee" && !shopId) {
    return res
      .status(400)
      .json({ message: "Employees must be associated with a shopId" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "User with this email already exists" });
    }
    if (role === "employee") {
      const shop = await Shop.findById(shopId);
      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }
    }
    const user = new User({
      name,
      email,
      passwordHash: password,
      role,
      shopId: role === "employee" ? shopId : null,
    });
    const newUser = await user.save();
    if (role === "employee") {
      await Shop.findByIdAndUpdate(shopId, {
        $push: { employees: newUser._id },
      });
    }
    const userResponse = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      shopId: newUser.shopId,
    };
    res
      .status(201)
      .json({ message: "User registered successfully", user: userResponse });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
