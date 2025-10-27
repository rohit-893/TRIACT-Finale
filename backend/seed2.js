import "dotenv/config";
import mongoose from "mongoose";
import User from "./models/User.js";
import Shop from "./models/Shop.js";
import Product from "./models/Product.js";
import Order from "./models/Order.js"; // Keep import to clear the collection
import Invoice from "./models/Invoice.js"; // Keep import to clear the collection
import Notification from "./models/Notification.js"; // Keep import to clear the collection
import path from 'path';
import fs from 'fs';

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected for seeding (seed2.js)...");

    // Clear existing data
    console.log("Clearing old data...");
    await Invoice.deleteMany({});
    await Notification.deleteMany({});
    await Order.deleteMany({}); // Clear any previous orders
    await Product.deleteMany({});
    await User.deleteMany({});
    await Shop.deleteMany({});

     // Clear old invoice files
     const invoicesDir = path.join(process.cwd(), "public", "invoices");
     if (fs.existsSync(invoicesDir)) {
       const files = fs.readdirSync(invoicesDir);
       for (const file of files) {
         if (file !== '.gitkeep') { // Keep the .gitkeep file
            fs.unlinkSync(path.join(invoicesDir, file));
         }
       }
       console.log("Cleared old invoice files.");
     }

    console.log("Old data cleared.");

    // --- Create Specific Owner ---
    const owner = await User.create({
      name: "Rohit Kumar",
      email: "rohit123@gmail.com",
      passwordHash: "Rohit1234", // Will be hashed by pre-save hook
      role: "owner",
    });
    console.log(`Owner ${owner.name} created.`);

    // --- Create Specific Shop ---
    const shop = await Shop.create({
      shopName: "Rohit Medical Store",
      ownerId: owner._id,
      address: "Koramangala, Bengaluru", // Added Bengaluru for clarity
    });
    await User.findByIdAndUpdate(owner._id, { shopId: shop._id });
    console.log(`Shop ${shop.shopName} created and linked to owner.`);

    // --- Create Generic Employees ---
    const employee1 = await User.create({
      name: "Staff Member 1",
      email: "staff1@rohitmed.com",
      passwordHash: "Password123", // Will be hashed
      role: "employee",
      shopId: shop._id,
      salary: { amount: 15000, status: 'pending' },
    });
    const employee2 = await User.create({
      name: "Staff Member 2",
      email: "staff2@rohitmed.com",
      passwordHash: "Password123", // Will be hashed
      role: "employee",
      shopId: shop._id,
      salary: { amount: 16000, status: 'pending' },
    });
    console.log("Generic employees created.");

    // Link employees to shop
    shop.employees.push(employee1._id, employee2._id);

    // --- Create 100 Medical Products ---
    console.log("Creating 100 medical products...");
    const productsData = [
      // Pain Relief (10)
      { shopId: shop._id, name: "Crocin Pain Relief Tablet", category: "Pain Relief", price: 35, cost: 28, stock: 150 },
      { shopId: shop._id, name: "Moov Pain Relief Spray 80g", category: "Pain Relief", price: 190, cost: 150, stock: 80 },
      { shopId: shop._id, name: "Volini Pain Relief Gel 75g", category: "Pain Relief", price: 175, cost: 140, stock: 90 },
      { shopId: shop._id, name: "Disprin Regular Effervescent Tablet", category: "Pain Relief", price: 15, cost: 10, stock: 200 },
      { shopId: shop._id, name: "Combiflam Tablet", category: "Pain Relief", price: 40, cost: 30, stock: 180 },
      { shopId: shop._id, name: "Iodex Balm 40g", category: "Pain Relief", price: 130, cost: 105, stock: 100 },
      { shopId: shop._id, name: "Saridon Tablet", category: "Pain Relief", price: 45, cost: 35, stock: 250 },
      { shopId: shop._id, name: "Nise Gel 30g", category: "Pain Relief", price: 95, cost: 75, stock: 70 },
      { shopId: shop._id, name: "Sumo Tablet", category: "Pain Relief", price: 110, cost: 85, stock: 120 },
      { shopId: shop._id, name: "Flexon MR Tablet", category: "Pain Relief", price: 30, cost: 22, stock: 160 },

      // Cold & Flu (10)
      { shopId: shop._id, name: "Vicks Vaporub 50ml", category: "Cold & Flu", price: 150, cost: 120, stock: 110 },
      { shopId: shop._id, name: "Strepsils Honey & Lemon Lozenges", category: "Cold & Flu", price: 45, cost: 35, stock: 300 },
      { shopId: shop._id, name: "Otrivin Oxy Fast Relief Nasal Spray", category: "Cold & Flu", price: 105, cost: 85, stock: 90 },
      { shopId: shop._id, name: "Benadryl Cough Syrup 150ml", category: "Cold & Flu", price: 125, cost: 100, stock: 75 },
      { shopId: shop._id, name: "Coldact Flu Plus Tablet", category: "Cold & Flu", price: 50, cost: 40, stock: 150 },
      { shopId: shop._id, name: "Sinarest Tablet", category: "Cold & Flu", price: 65, cost: 50, stock: 140 },
      { shopId: shop._id, name: "Cheston Cold Tablet", category: "Cold & Flu", price: 55, cost: 42, stock: 160 },
      { shopId: shop._id, name: "Honitus Cough Syrup 100ml", category: "Cold & Flu", price: 90, cost: 70, stock: 100 },
      { shopId: shop._id, name: "Karvol Plus Inhalant Capsule", category: "Cold & Flu", price: 70, cost: 55, stock: 120 },
      { shopId: shop._id, name: "Nasivion Classic Adult Nasal Spray", category: "Cold & Flu", price: 95, cost: 78, stock: 85 },

      // First Aid (10)
      { shopId: shop._id, name: "Dettol Antiseptic Liquid 250ml", category: "First Aid", price: 150, cost: 125, stock: 100 },
      { shopId: shop._id, name: "Band-Aid Assorted Pack", category: "First Aid", price: 50, cost: 40, stock: 250 },
      { shopId: shop._id, name: "Savlon Antiseptic Liquid 100ml", category: "First Aid", price: 70, cost: 55, stock: 130 },
      { shopId: shop._id, name: "Hansaplast Cotton Crepe Bandage", category: "First Aid", price: 120, cost: 95, stock: 80 },
      { shopId: shop._id, name: "Betadine Ointment 15g", category: "First Aid", price: 115, cost: 90, stock: 95 },
      { shopId: shop._id, name: "Soframycin Skin Cream 30g", category: "First Aid", price: 60, cost: 48, stock: 110 },
      { shopId: shop._id, name: "Gauze Roll 10cm x 3m", category: "First Aid", price: 40, cost: 30, stock: 150 },
      { shopId: shop._id, name: "Micropore Surgical Tape 1 inch", category: "First Aid", price: 55, cost: 42, stock: 140 },
      { shopId: shop._id, name: "Burnol Cream 20g", category: "First Aid", price: 75, cost: 60, stock: 100 },
      { shopId: shop._id, name: "Absorbent Cotton Wool 100g", category: "First Aid", price: 65, cost: 50, stock: 120 },

      // Vitamins & Supplements (15)
      { shopId: shop._id, name: "Revital H Woman Tablet", category: "Vitamins & Supplements", price: 340, cost: 270, stock: 60 },
      { shopId: shop._id, name: "Neurobion Forte Tablet", category: "Vitamins & Supplements", price: 40, cost: 30, stock: 200 },
      { shopId: shop._id, name: "Shelcal 500 Tablet", category: "Vitamins & Supplements", price: 110, cost: 85, stock: 150 },
      { shopId: shop._id, name: "Limcee Vitamin C Chewable Tablet", category: "Vitamins & Supplements", price: 25, cost: 18, stock: 300 },
      { shopId: shop._id, name: "Evion 400 Capsule", category: "Vitamins & Supplements", price: 38, cost: 29, stock: 250 },
      { shopId: shop._id, name: "Zincovit Tablet", category: "Vitamins & Supplements", price: 105, cost: 80, stock: 180 },
      { shopId: shop._id, name: "Supradyn Daily Multivitamin Tablet", category: "Vitamins & Supplements", price: 60, cost: 45, stock: 220 },
      { shopId: shop._id, name: "Seven Seas Cod Liver Oil Capsule", category: "Vitamins & Supplements", price: 300, cost: 240, stock: 70 },
      { shopId: shop._id, name: "Becosules Capsule", category: "Vitamins & Supplements", price: 50, cost: 38, stock: 260 },
      { shopId: shop._id, name: "Ferronomic Plus Capsule", category: "Vitamins & Supplements", price: 90, cost: 70, stock: 130 },
      { shopId: shop._id, name: "Ostocalcium B12 Syrup", category: "Vitamins & Supplements", price: 150, cost: 120, stock: 80 },
      { shopId: shop._id, name: "Maxirich Multivitamin Capsule", category: "Vitamins & Supplements", price: 120, cost: 95, stock: 110 },
      { shopId: shop._id, name: "Calcimax Forte Tablet", category: "Vitamins & Supplements", price: 130, cost: 100, stock: 100 },
      { shopId: shop._id, name: "Absolut 3G Capsule", category: "Vitamins & Supplements", price: 200, cost: 160, stock: 75 },
      { shopId: shop._id, name: "Ensure Diabetes Care Powder 400g", category: "Vitamins & Supplements", price: 750, cost: 600, stock: 50 },

      // Digestive Health (10)
      { shopId: shop._id, name: "Digene Acidity & Gas Relief Gel 200ml", category: "Digestive Health", price: 130, cost: 105, stock: 100 },
      { shopId: shop._id, name: "Eno Fruit Salt Lemon Sachet", category: "Digestive Health", price: 10, cost: 7, stock: 500 },
      { shopId: shop._id, name: "Pudin Hara Pearls", category: "Digestive Health", price: 55, cost: 42, stock: 200 },
      { shopId: shop._id, name: "Gelusil MPS Antacid Antigas Liquid 200ml", category: "Digestive Health", price: 110, cost: 88, stock: 110 },
      { shopId: shop._id, name: "Omez 20 Capsule", category: "Digestive Health", price: 60, cost: 45, stock: 180 }, // Example - Often prescription but common OTC request
      { shopId: shop._id, name: "Cremaffin Plus Syrup 225ml", category: "Digestive Health", price: 190, cost: 150, stock: 70 },
      { shopId: shop._id, name: "Isabgol Husk (Psyllium) 100g", category: "Digestive Health", price: 140, cost: 110, stock: 90 },
      { shopId: shop._id, name: "Eldoper Capsule", category: "Digestive Health", price: 25, cost: 18, stock: 250 },
      { shopId: shop._id, name: "Vizylac Capsule", category: "Digestive Health", price: 80, cost: 60, stock: 160 }, // Probiotic
      { shopId: shop._id, name: "Unienzyme Tablet", category: "Digestive Health", price: 70, cost: 55, stock: 170 }, // Digestive Enzyme

      // Personal Care (15)
      { shopId: shop._id, name: "Himalaya Neem Face Wash 100ml", category: "Personal Care", price: 140, cost: 110, stock: 90 },
      { shopId: shop._id, name: "Nivea Creme 60ml", category: "Personal Care", price: 100, cost: 80, stock: 120 },
      { shopId: shop._id, name: "Dove Cream Beauty Bathing Bar 100g", category: "Personal Care", price: 60, cost: 48, stock: 200 },
      { shopId: shop._id, name: "Pears Pure & Gentle Soap 125g", category: "Personal Care", price: 75, cost: 60, stock: 180 },
      { shopId: shop._id, name: "Boroplus Antiseptic Cream 19ml", category: "Personal Care", price: 40, cost: 30, stock: 250 },
      { shopId: shop._id, name: "Vaseline Intensive Care Lotion 100ml", category: "Personal Care", price: 110, cost: 85, stock: 130 },
      { shopId: shop._id, name: "Dettol Skincare Soap 75g", category: "Personal Care", price: 45, cost: 35, stock: 220 },
      { shopId: shop._id, name: "Listerine Cool Mint Mouthwash 250ml", category: "Personal Care", price: 160, cost: 130, stock: 80 },
      { shopId: shop._id, name: "Colgate Total Advanced Toothpaste 120g", category: "Personal Care", price: 125, cost: 100, stock: 100 },
      { shopId: shop._id, name: "Oral-B Pro-Health Toothbrush", category: "Personal Care", price: 70, cost: 55, stock: 150 },
      { shopId: shop._id, name: "Gillette Guard Razor", category: "Personal Care", price: 25, cost: 18, stock: 300 },
      { shopId: shop._id, name: "Stayfree Secure XL Wings Sanitary Pads", category: "Personal Care", price: 40, cost: 30, stock: 190 },
      { shopId: shop._id, name: "Whisper Ultra Clean XL+ Wings Sanitary Pads", category: "Personal Care", price: 90, cost: 70, stock: 160 },
      { shopId: shop._id, name: "Clean & Clear Foaming Face Wash 100ml", category: "Personal Care", price: 135, cost: 105, stock: 95 },
      { shopId: shop._id, name: "Sunsilk Stunning Black Shine Shampoo 180ml", category: "Personal Care", price: 120, cost: 95, stock: 110 },

      // Baby Care (10)
      { shopId: shop._id, name: "Johnson's Baby Powder 200g", category: "Baby Care", price: 150, cost: 120, stock: 80 },
      { shopId: shop._id, name: "Himalaya Baby Lotion 200ml", category: "Baby Care", price: 180, cost: 145, stock: 70 },
      { shopId: shop._id, name: "Pampers Active Baby Diapers Medium", category: "Baby Care", price: 600, cost: 480, stock: 50 }, // Pack price
      { shopId: shop._id, name: "MamyPoko Pants Extra Absorb Diapers Large", category: "Baby Care", price: 550, cost: 440, stock: 60 }, // Pack price
      { shopId: shop._id, name: "Sebamed Baby Rash Cream 50ml", category: "Baby Care", price: 250, cost: 200, stock: 65 },
      { shopId: shop._id, name: "Chicco Baby Moments Soap 100g", category: "Baby Care", price: 80, cost: 65, stock: 100 },
      { shopId: shop._id, name: "Woodward's Gripe Water 130ml", category: "Baby Care", price: 65, cost: 50, stock: 120 },
      { shopId: shop._id, name: "Himalaya Baby Wipes 72s", category: "Baby Care", price: 190, cost: 150, stock: 90 },
      { shopId: shop._id, name: "Farlex Baby Drops", category: "Baby Care", price: 100, cost: 80, stock: 75 }, // Example name
      { shopId: shop._id, name: "Bonnisan Liquid 100ml", category: "Baby Care", price: 85, cost: 68, stock: 110 },

      // Health Devices & Others (10)
      { shopId: shop._id, name: "Accu-Chek Active Glucose Meter Kit", category: "Health Devices", price: 1400, cost: 1100, stock: 30 },
      { shopId: shop._id, name: "Omron HEM-7120 Digital BP Monitor", category: "Health Devices", price: 1800, cost: 1450, stock: 25 },
      { shopId: shop._id, name: "Dr. Morepen BG-03 Gluco One Strips (50)", category: "Health Devices", price: 850, cost: 680, stock: 40 },
      { shopId: shop._id, name: "Digital Thermometer", category: "Health Devices", price: 150, cost: 110, stock: 100 },
      { shopId: shop._id, name: "Hot Water Bag", category: "Health Devices", price: 250, cost: 190, stock: 60 },
      { shopId: shop._id, name: "Durex Condoms - Extra Time", category: "Sexual Wellness", price: 150, cost: 120, stock: 90 }, // Example
      { shopId: shop._id, name: "Manforce Condoms - Dotted", category: "Sexual Wellness", price: 80, cost: 60, stock: 120 }, // Example
      { shopId: shop._id, name: "Prega News Pregnancy Test Kit", category: "Wellness", price: 60, cost: 45, stock: 150 },
      { shopId: shop._id, name: "ORS Apple Drink 200ml", category: "Wellness", price: 35, cost: 25, stock: 200 },
      { shopId: shop._id, name: "Electral Powder Sachet", category: "Wellness", price: 22, cost: 16, stock: 300 },

       // Eye/Ear Care (5)
      { shopId: shop._id, name: "Ciplox Eye/Ear Drops 5ml", category: "Eye/Ear Care", price: 20, cost: 15, stock: 100 }, // Example, often prescription
      { shopId: shop._id, name: "Refresh Tears Eye Drops 10ml", category: "Eye/Ear Care", price: 140, cost: 110, stock: 80 },
      { shopId: shop._id, name: "Otocin-Ear Drops 5ml", category: "Eye/Ear Care", price: 50, cost: 38, stock: 90 }, // Example name
      { shopId: shop._id, name: "Clearwax Ear Drops 10ml", category: "Eye/Ear Care", price: 75, cost: 58, stock: 70 },
      { shopId: shop._id, name: "I-Kul Eye Drops 10ml", category: "Eye/Ear Care", price: 55, cost: 40, stock: 110 },

       // Ayurvedic/Herbal (5)
      { shopId: shop._id, name: "Dabur Chyawanprash 500g", category: "Ayurvedic", price: 200, cost: 160, stock: 60 },
      { shopId: shop._id, name: "Himalaya Liv.52 DS Tablet", category: "Ayurvedic", price: 150, cost: 120, stock: 90 },
      { shopId: shop._id, name: "Patanjali Divya Swasari Pravahi 200ml", category: "Ayurvedic", price: 100, cost: 80, stock: 70 },
      { shopId: shop._id, name: "Zandu Pancharishta 450ml", category: "Ayurvedic", price: 140, cost: 115, stock: 80 },
      { shopId: shop._id, name: "Baidyanath Triphala Churna 100g", category: "Ayurvedic", price: 50, cost: 38, stock: 120 },


    ];
    const products = await Product.insertMany(productsData);
    shop.products = products.map((p) => p._id);
    await shop.save(); // Saves employees and products to the shop document
    console.log(`${products.length} products created.`);

    // --- NO ORDERS CREATED ---
    console.log("Skipping order generation as requested.");

    console.log("Database seeding (seed2.js) completed successfully! 🎉");
  } catch (error) {
    console.error("Error during seeding (seed2.js):", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
  }
};

seedData();