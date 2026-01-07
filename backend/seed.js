// backend/seed.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import Shop from './models/Shop.js';
import Product from './models/Product.js';
import Order from './models/Order.js';
import Invoice from './models/Invoice.js';
import Notification from './models/Notification.js';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Helper function to generate random dates over past 90 days
const getRandomDate = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 90); // Go back 90 days
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
};

// Helper to pick random items from an array
const getRandomItems = (array, count) => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📡 MongoDB connected for seeding...');

    // === CLEAR EXISTING DATA ===
    console.log('🗑️  Clearing old data...');
    await Invoice.deleteMany({});
    await Notification.deleteMany({});
    await Order.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({});
    await Shop.deleteMany({});

    // Clear old invoice files
    const invoicesDir = path.join(process.cwd(), 'public', 'invoices');
    if (fs.existsSync(invoicesDir)) {
      const files = fs.readdirSync(invoicesDir);
      for (const file of files) {
        if (file !== '.gitkeep') {
          fs.unlinkSync(path.join(invoicesDir, file));
        }
      }
    }
    console.log('✅ Old data cleared.\n');

    // === CREATE OWNER AND SHOP ===
    console.log('👤 Creating owner and shop...');
    const owner = await User.create({
      name: 'Ankit Sharma',
      email: 'owner1@example.com',
      passwordHash: 'Password123',
      role: 'owner',
    });

    const shop = await Shop.create({
      shopName: "Ankit's General Store",
      ownerId: owner._id,
      address: '123 MG Road, Narnaund, Haryana',
    });

    await User.findByIdAndUpdate(owner._id, { shopId: shop._id });
    console.log(`✅ Shop created: ${shop.shopName}\n`);

    // === CREATE EMPLOYEES ===
    console.log('👥 Creating employees...');
    const employee1 = await User.create({
      name: 'Rahul Kumar',
      email: 'rahul@example.com',
      passwordHash: 'Password123',
      role: 'employee',
      shopId: shop._id,
      salary: { amount: 18000, status: 'pending' },
    });

    const employee2 = await User.create({
      name: 'Priya Singh',
      email: 'priya@example.com',
      passwordHash: 'Password123',
      role: 'employee',
      shopId: shop._id,
      salary: { amount: 20000, status: 'paid' },
    });

    shop.employees.push(employee1._id, employee2._id);
    await shop.save();
    console.log('✅ Employees created.\n');

    // === CREATE 50+ PRODUCTS WITH VARIED STOCK LEVELS ===
    console.log('📦 Creating 50+ products...');
    const productsData = [
      // **Beverages** (Fast-moving products)
      { name: 'Coca-Cola 500ml', category: 'Beverages', price: 40, cost: 30, stock: 150 },
      { name: 'Pepsi 500ml', category: 'Beverages', price: 40, cost: 30, stock: 120 },
      { name: 'Sprite 500ml', category: 'Beverages', price: 40, cost: 30, stock: 100 },
      { name: 'Fanta 500ml', category: 'Beverages', price: 40, cost: 30, stock: 90 },
      { name: 'Thums Up 500ml', category: 'Beverages', price: 40, cost: 30, stock: 110 },
      { name: 'Bisleri Water 1L', category: 'Beverages', price: 20, cost: 15, stock: 200 },
      { name: 'Red Bull 250ml', category: 'Beverages', price: 125, cost: 95, stock: 50 },
      { name: 'Monster Energy 500ml', category: 'Beverages', price: 150, cost: 110, stock: 40 },
      { name: 'Frooti 200ml', category: 'Beverages', price: 20, cost: 14, stock: 90 },
      { name: 'Maaza 200ml', category: 'Beverages', price: 20, cost: 14, stock: 85 },
      { name: 'Real Juice 1L', category: 'Beverages', price: 150, cost: 115, stock: 45 },

      // **Snacks** (Medium-fast moving)
      { name: 'Lays Classic 50g', category: 'Snacks', price: 20, cost: 14, stock: 120 },
      { name: 'Kurkure Masala 50g', category: 'Snacks', price: 20, cost: 14, stock: 100 },
      { name: 'Bingo Mad Angles 50g', category: 'Snacks', price: 20, cost: 14, stock: 95 },
      { name: 'Haldirams Bhujia 200g', category: 'Snacks', price: 60, cost: 45, stock: 70 },
      { name: 'Pringles Original 100g', category: 'Snacks', price: 120, cost: 90, stock: 35 },
      { name: 'Maggi 2-Minute Noodles', category: 'Snacks', price: 14, cost: 10, stock: 150 },
      { name: 'Top Ramen Noodles', category: 'Snacks', price: 15, cost: 11, stock: 130 },
      { name: 'Parle-G Biscuit 200g', category: 'Snacks', price: 20, cost: 15, stock: 180 },
      { name: 'Britannia Good Day 100g', category: 'Snacks', price: 30, cost: 22, stock: 110 },
      { name: 'Oreo Biscuits 150g', category: 'Snacks', price: 40, cost: 30, stock: 85 },

      // **Staples** (Slow-medium moving)
      { name: 'Aashirvaad Atta 5kg', category: 'Staples', price: 240, cost: 190, stock: 40 },
      { name: 'India Gate Basmati Rice 1kg', category: 'Staples', price: 130, cost: 100, stock: 60 },
      { name: 'Tata Sampann Toor Dal 1kg', category: 'Staples', price: 160, cost: 110, stock: 75 },
      { name: 'Fortune Sunlite Oil 1L', category: 'Staples', price: 150, cost: 115, stock: 55 },
      { name: 'Tata Salt 1kg', category: 'Staples', price: 30, cost: 20, stock: 200 },
      { name: 'Sugar 1kg', category: 'Staples', price: 45, cost: 35, stock: 150 },
      { name: 'Rajdhani Besan 500g', category: 'Staples', price: 70, cost: 45, stock: 80 },
      { name: 'MTR Rava Idli Mix 500g', category: 'Staples', price: 105, cost: 70, stock: 50 },

      // **Personal Care** (Medium moving)
      { name: 'Colgate Toothpaste 200g', category: 'Personal Care', price: 120, cost: 85, stock: 65 },
      { name: 'Dettol Soap 125g', category: 'Personal Care', price: 40, cost: 28, stock: 100 },
      { name: 'Dove Shampoo 200ml', category: 'Personal Care', price: 180, cost: 130, stock: 45 },
      { name: 'Pantene Conditioner 180ml', category: 'Personal Care', price: 210, cost: 155, stock: 35 },
      { name: 'Head & Shoulders 200ml', category: 'Personal Care', price: 230, cost: 170, stock: 40 },
      { name: 'Fair & Lovely Cream 50g', category: 'Personal Care', price: 130, cost: 95, stock: 55 },
      { name: 'Gillette Razor 5 Pack', category: 'Personal Care', price: 250, cost: 185, stock: 30 },
      { name: 'Nivea Body Lotion 400ml', category: 'Personal Care', price: 320, cost: 240, stock: 25 },

      // **Dairy** (Fast moving)
      { name: 'Amul Milk 1L', category: 'Dairy', price: 60, cost: 50, stock: 100 },
      { name: 'Mother Dairy Curd 400g', category: 'Dairy', price: 45, cost: 35, stock: 80 },
      { name: 'Amul Butter 100g', category: 'Dairy', price: 55, cost: 42, stock: 60 },
      { name: 'Amul Cheese Slice 200g', category: 'Dairy', price: 140, cost: 110, stock: 40 },

      // **Household** (Slow moving)
      { name: 'Vim Dishwash Gel 500ml', category: 'Household', price: 110, cost: 80, stock: 50 },
      { name: 'Tide Detergent 1kg', category: 'Household', price: 180, cost: 135, stock: 45 },
      { name: 'Harpic Toilet Cleaner 500ml', category: 'Household', price: 105, cost: 75, stock: 55 },
      { name: 'Colin Glass Cleaner 500ml', category: 'Household', price: 120, cost: 88, stock: 40 },
      { name: 'Scotch Brite Scrubber Pack of 3', category: 'Household', price: 85, cost: 60, stock: 70 },

      // **Confectionery** (Fast moving)
      { name: 'Dairy Milk Chocolate 40g', category: 'Confectionery', price: 40, cost: 30, stock: 120 },
      { name: '5 Star Chocolate 22g', category: 'Confectionery', price: 10, cost: 7, stock: 180 },
      { name: 'KitKat 37g', category: 'Confectionery', price: 30, cost: 22, stock: 100 },
      { name: 'Eclairs Candy 100g', category: 'Confectionery', price: 20, cost: 14, stock: 150 },
      { name: 'Mentos Roll', category: 'Confectionery', price: 10, cost: 7, stock: 200 },
    ];

    const products = await Product.insertMany(
      productsData.map((p) => ({ ...p, shopId: shop._id }))
    );
    shop.products = products.map((p) => p._id);
    await shop.save();
    console.log(`✅ ${products.length} products created.\n`);

    // === CREATE REALISTIC ORDERS OVER 90 DAYS ===
    console.log('📝 Creating 150+ orders over past 90 days...');
    
    const orderCount = 150;
    const billers = [owner.name, employee1.name, employee2.name];
    const customerNames = [
      'Walk-in Customer',
      'Rajesh Kumar',
      'Priya Verma',
      'Amit Singh',
      'Sunita Devi',
      'Rahul Sharma',
      'Anita Patel',
      'Vikas Gupta',
    ];

    for (let i = 0; i < orderCount; i++) {
      // Pick 2-5 random products
      const numItems = Math.floor(Math.random() * 4) + 2;
      const selectedProducts = getRandomItems(products, numItems);

      // Define sales velocity for different categories (how often they sell)
      const categoryVelocity = {
        'Beverages': 0.15,      // 15% chance per order
        'Snacks': 0.12,         // 12% chance
        'Dairy': 0.13,          // 13% chance
        'Confectionery': 0.14,  // 14% chance
        'Personal Care': 0.06,  // 6% chance
        'Staples': 0.04,        // 4% chance
        'Household': 0.03       // 3% chance
      };

      const orderItems = selectedProducts
        .filter(product => Math.random() < (categoryVelocity[product.category] || 0.1))
        .map((product) => {
          const quantity = Math.floor(Math.random() * 5) + 1;
          return {
            productId: product._id,
            name: product.name,
            quantity,
            price: product.price,
            cost: product.cost,
          };
        });

      if (orderItems.length === 0) continue; // Skip if no items

      const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const totalProfit = orderItems.reduce(
        (sum, item) => sum + (item.price - item.cost) * item.quantity,
        0
      );

      const order = await Order.create({
        shopId: shop._id,
        customerName: customerNames[Math.floor(Math.random() * customerNames.length)],
        billerName: billers[Math.floor(Math.random() * billers.length)],
        items: orderItems,
        total,
        totalProfit,
        date: getRandomDate(),
      });

      // Update product stock
      for (const item of orderItems) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity },
        });
      }
    }

    console.log(`✅ ${orderCount} orders created with realistic sales patterns.\n`);

    // === CREATE LOW STOCK NOTIFICATIONS ===
    console.log('🔔 Creating low stock notifications...');
    const lowStockProducts = await Product.find({
      shopId: shop._id,
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    });

    for (const product of lowStockProducts) {
      await Notification.create({
        shopId: shop._id,
        message: `Low stock alert: ${product.name} has only ${product.stock} units left.`,
        isRead: false,
      });
    }
    console.log(`✅ ${lowStockProducts.length} low stock notifications created.\n`);

    console.log('🎉 ===== DATABASE SEEDING COMPLETE! =====');
    console.log('\n📊 Summary:');
    console.log(`   • 1 Shop: ${shop.shopName}`);
    console.log(`   • 1 Owner + 2 Employees`);
    console.log(`   • ${products.length} Products across 7 categories`);
    console.log(`   • ${orderCount} Orders over 90 days`);
    console.log(`   • ${lowStockProducts.length} Low Stock Alerts`);
    console.log('\n🔐 Login Credentials:');
    console.log('   Owner: owner1@example.com / Password123');
    console.log('   Employee 1: rahul@example.com / Password123');
    console.log('   Employee 2: priya@example.com / Password123');
    console.log('\n🚀 Run: npm run dev (backend) & npm run dev (frontend)');
    console.log('📈 Forecast data will now show meaningful predictions!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error);
    process.exit(1);
  }
};

seedData();
