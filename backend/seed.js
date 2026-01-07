// backend/seed.js

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Shop from "./models/Shop.js";
import Product from "./models/Product.js";
import Order from "./models/Order.js";
import Invoice from "./models/Invoice.js";
import Notification from "./models/Notification.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not defined in .env file");
  process.exit(1);
}

// Helper function to generate random dates
const randomDate = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date;
};

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    console.log("🗑️  Clearing existing data...");
    await User.deleteMany({});
    await Shop.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Invoice.deleteMany({});
    await Notification.deleteMany({});
    console.log("✅ All collections cleared");

    // ===== 1. CREATE USERS =====
    console.log("\n👤 Creating users...");

    // Owner
    const owner = await User.create({
      name: "Ankit Sharma",
      email: "owner1@example.com",
      passwordHash: "Password123",
      role: "owner",
      shopId: null,
    });
    console.log(`✅ Created owner: ${owner.name}`);

    // Employees (will link to shop later)
    const employee1 = await User.create({
      name: "Rahul Kumar",
      email: "rahul@example.com",
      passwordHash: "Password123",
      role: "employee",
      shopId: null,
      salary: {
        amount: 25000,
        status: "pending",
        nextPaymentDate: new Date(2026, 0, 15), // Jan 15, 2026
      },
    });

    const employee2 = await User.create({
      name: "Priya Singh",
      email: "priya@example.com",
      passwordHash: "Password123",
      role: "employee",
      shopId: null,
      salary: {
        amount: 28000,
        status: "paid",
        nextPaymentDate: new Date(2026, 1, 1), // Feb 1, 2026
      },
    });

    const employee3 = await User.create({
      name: "Amit Verma",
      email: "amit@example.com",
      passwordHash: "Password123",
      role: "employee",
      shopId: null,
      salary: {
        amount: 22000,
        status: "pending",
        nextPaymentDate: new Date(2026, 0, 20), // Jan 20, 2026
      },
    });

    console.log(`✅ Created ${3} employees`);

    // ===== 2. CREATE SHOP =====
    console.log("\n🏪 Creating shop...");

    const shop = await Shop.create({
      shopName: "Sharma General Store",
      ownerId: owner._id,
      address: "Shop No. 45, Main Market, Narnaund, Haryana - 126049",
      employees: [employee1._id, employee2._id, employee3._id],
      products: [], // Will populate after creating products
    });

    // Update users with shopId
    await User.updateMany(
      { _id: { $in: [owner._id, employee1._id, employee2._id, employee3._id] } },
      { shopId: shop._id }
    );

    console.log(`✅ Created shop: ${shop.shopName}`);

    // ===== 3. CREATE PRODUCTS =====
    console.log("\n📦 Creating products...");

    const categories = {
      Beverages: [
        { name: "Coca-Cola 500ml", price: 40, cost: 30, stock: 150 },
        { name: "Pepsi 500ml", price: 40, cost: 30, stock: 120 },
        { name: "Sprite 500ml", price: 40, cost: 30, stock: 100 },
        { name: "Mountain Dew 500ml", price: 40, cost: 30, stock: 80 },
        { name: "Bisleri Water 1L", price: 20, cost: 15, stock: 200 },
        { name: "Red Bull 250ml", price: 125, cost: 100, stock: 50 },
        { name: "Frooti 200ml", price: 20, cost: 15, stock: 90 },
        { name: "Real Juice 1L", price: 150, cost: 120, stock: 45 },
      ],
      Snacks: [
        { name: "Lays Classic 50g", price: 20, cost: 15, stock: 180 },
        { name: "Kurkure Masala 50g", price: 20, cost: 15, stock: 8 }, // Low stock
        { name: "Haldiram Bhujia 200g", price: 60, cost: 45, stock: 95 },
        { name: "Bingo Mad Angles", price: 20, cost: 15, stock: 110 },
        { name: "Uncle Chips 50g", price: 20, cost: 15, stock: 75 },
        { name: "Pringles 100g", price: 120, cost: 95, stock: 30 },
      ],
      Dairy: [
        { name: "Amul Milk 500ml", price: 30, cost: 25, stock: 85 },
        { name: "Mother Dairy Curd 400g", price: 40, cost: 32, stock: 60 },
        { name: "Amul Butter 100g", price: 55, cost: 45, stock: 7 }, // Low stock
        { name: "Amul Cheese Slice 200g", price: 130, cost: 105, stock: 40 },
        { name: "Nestle Milk Powder 400g", price: 320, cost: 270, stock: 25 },
      ],
      Groceries: [
        { name: "Tata Salt 1kg", price: 22, cost: 18, stock: 150 },
        { name: "Fortune Oil 1L", price: 180, cost: 150, stock: 55 },
        { name: "India Gate Basmati Rice 5kg", price: 450, cost: 380, stock: 35 },
        { name: "Tata Tea Gold 500g", price: 240, cost: 200, stock: 40 },
        { name: "Aashirvaad Atta 5kg", price: 275, cost: 235, stock: 50 },
        { name: "Maggi Noodles Pack of 12", price: 144, cost: 120, stock: 9 }, // Low stock
      ],
      Bakery: [
        { name: "Britannia Bread 400g", price: 40, cost: 32, stock: 45 },
        { name: "Parle-G Biscuits 200g", price: 25, cost: 20, stock: 120 },
        { name: "Sunfeast Dark Fantasy 75g", price: 30, cost: 24, stock: 85 },
        { name: "Britannia Good Day 100g", price: 35, cost: 28, stock: 70 },
        { name: "McVities Digestive 250g", price: 80, cost: 65, stock: 40 },
      ],
      "Personal Care": [
        { name: "Colgate Toothpaste 200g", price: 120, cost: 95, stock: 55 },
        { name: "Dettol Soap 125g", price: 45, cost: 35, stock: 90 },
        { name: "Head & Shoulders 340ml", price: 380, cost: 310, stock: 25 },
        { name: "Fair & Lovely 50g", price: 140, cost: 115, stock: 30 },
        { name: "Parachute Coconut Oil 200ml", price: 110, cost: 88, stock: 45 },
      ],
      Stationery: [
        { name: "Classmate Notebook 180 Pages", price: 50, cost: 38, stock: 60 },
        { name: "Reynolds Pen Blue", price: 10, cost: 7, stock: 150 },
        { name: "Apsara Pencil Pack of 10", price: 40, cost: 30, stock: 80 },
        { name: "Fevicol 100ml", price: 35, cost: 28, stock: 45 },
      ],
    };

    const allProducts = [];

    for (const [category, items] of Object.entries(categories)) {
      for (const item of items) {
        const product = await Product.create({
          shopId: shop._id,
          name: item.name,
          category: category,
          price: item.price,
          cost: item.cost,
          stock: item.stock,
          lowStockThreshold: 10,
        });
        allProducts.push(product);
      }
      console.log(`✅ Created ${items.length} products in ${category}`);
    }

    // Update shop with products
    await Shop.findByIdAndUpdate(shop._id, {
      products: allProducts.map((p) => p._id),
    });

    console.log(`✅ Total products created: ${allProducts.length}`);

    // ===== 4. CREATE ORDERS =====
    console.log("\n🛒 Creating orders...");

    const billers = [employee1.name, employee2.name, employee3.name];
    const customerNames = [
      "Walk-in Customer",
      "Rajesh Gupta",
      "Sunita Devi",
      "Vikas Sharma",
      "Neha Patel",
      "Ramesh Kumar",
      "Pooja Singh",
      "Amit Joshi",
      "Kavita Verma",
      "Suresh Reddy",
    ];

    const orders = [];

    // Create 100 orders over the past 90 days
    for (let i = 0; i < 100; i++) {
      const numItems = Math.floor(Math.random() * 4) + 1; // 1-4 items per order
      const orderItems = [];
      let totalRevenue = 0;
      let totalCost = 0;

      // Select random products for this order
      const selectedProducts = [];
      for (let j = 0; j < numItems; j++) {
        const randomProduct = allProducts[Math.floor(Math.random() * allProducts.length)];
        selectedProducts.push(randomProduct);
      }

      // Build order items
      for (const product of selectedProducts) {
        const quantity = Math.floor(Math.random() * 5) + 1; // 1-5 units
        const itemRevenue = product.price * quantity;
        const itemCost = product.cost * quantity;

        orderItems.push({
          productId: product._id,
          name: product.name,
          quantity: quantity,
          price: product.price,
          cost: product.cost,
        });

        totalRevenue += itemRevenue;
        totalCost += itemCost;
      }

      const totalProfit = totalRevenue - totalCost;

      const order = await Order.create({
        shopId: shop._id,
        customerName: customerNames[Math.floor(Math.random() * customerNames.length)],
        billerName: billers[Math.floor(Math.random() * billers.length)],
        items: orderItems,
        total: totalRevenue,
        totalProfit: totalProfit,
        date: randomDate(90), // Random date within last 90 days
      });

      orders.push(order);
    }

    console.log(`✅ Created ${orders.length} orders`);

    // ===== 5. CREATE INVOICES =====
    console.log("\n📄 Creating invoices...");

    const invoices = [];

    for (const order of orders) {
      const invoice = await Invoice.create({
        shopId: shop._id,
        orderId: order._id,
        pdfPath: `/invoices/invoice-${order._id}.pdf`,
        customerName: order.customerName,
        billerName: order.billerName,
        total: order.total,
        date: order.date,
      });
      invoices.push(invoice);
    }

    console.log(`✅ Created ${invoices.length} invoices`);

    // ===== 6. CREATE NOTIFICATIONS =====
    console.log("\n🔔 Creating notifications...");

    const lowStockProducts = allProducts.filter((p) => p.stock <= p.lowStockThreshold);

    const notifications = [];

    for (const product of lowStockProducts) {
      const notification = await Notification.create({
        shopId: shop._id,
        message: `Low stock alert: ${product.name} has only ${product.stock} units left`,
        isRead: Math.random() > 0.5, // 50% read, 50% unread
        createdAt: randomDate(7), // Within last 7 days
      });
      notifications.push(notification);
    }

    // Add some general notifications
    const generalNotifications = [
      "Monthly sales target achieved! 🎉",
      "New product category added successfully",
      "System maintenance scheduled for next Sunday",
    ];

    for (const msg of generalNotifications) {
      const notification = await Notification.create({
        shopId: shop._id,
        message: msg,
        isRead: false,
        createdAt: randomDate(5),
      });
      notifications.push(notification);
    }

    console.log(`✅ Created ${notifications.length} notifications`);

    // ===== SUMMARY =====
    console.log("\n" + "=".repeat(50));
    console.log("📊 DATABASE SEEDING SUMMARY");
    console.log("=".repeat(50));
    console.log(`👤 Users: ${await User.countDocuments()}`);
    console.log(`   - Owners: ${await User.countDocuments({ role: "owner" })}`);
    console.log(`   - Employees: ${await User.countDocuments({ role: "employee" })}`);
    console.log(`🏪 Shops: ${await Shop.countDocuments()}`);
    console.log(`📦 Products: ${await Product.countDocuments()}`);
    console.log(`   - Categories: ${Object.keys(categories).length}`);
    console.log(`   - Low Stock Items: ${lowStockProducts.length}`);
    console.log(`🛒 Orders: ${await Order.countDocuments()}`);
    console.log(`📄 Invoices: ${await Invoice.countDocuments()}`);
    console.log(`🔔 Notifications: ${await Notification.countDocuments()}`);
    console.log("=".repeat(50));

    // Calculate and display statistics
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalProfit = orders.reduce((sum, order) => sum + order.totalProfit, 0);
    const avgOrderValue = totalRevenue / orders.length;

    console.log("\n💰 FINANCIAL SUMMARY");
    console.log("=".repeat(50));
    console.log(`Total Revenue: ₹${totalRevenue.toFixed(2)}`);
    console.log(`Total Profit: ₹${totalProfit.toFixed(2)}`);
    console.log(`Average Order Value: ₹${avgOrderValue.toFixed(2)}`);
    console.log(`Profit Margin: ${((totalProfit / totalRevenue) * 100).toFixed(2)}%`);
    console.log("=".repeat(50));

    console.log("\n🔐 TEST CREDENTIALS");
    console.log("=".repeat(50));
    console.log("Owner Account:");
    console.log("  Email: owner1@example.com");
    console.log("  Password: Password123");
    console.log("\nEmployee Accounts:");
    console.log("  1. rahul@example.com / Password123 (Salary: Pending)");
    console.log("  2. priya@example.com / Password123 (Salary: Paid)");
    console.log("  3. amit@example.com / Password123 (Salary: Pending)");
    console.log("=".repeat(50));

    console.log("\n✅ Database seeding completed successfully!");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedDatabase();
