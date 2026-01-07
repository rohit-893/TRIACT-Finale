// backend/lib/schemas.js

// This is a simplified, text-based representation of your Mongoose models
// for the AI to understand.

export const SCHEMAS = `
You have access to the following Mongoose models and schemas:

1.  **Product Model** (Collection: "products")
    * Description: Represents a single product in the shop's inventory.
    * Schema:
        {
          "shopId": { "type": "ObjectId", "ref": "Shop" },
          "name": { "type": "String" },
          "category": { "type": "String" },
          "price": { "type": "Number" }, // Selling price to customer
          "cost": { "type": "Number" }, // Purchase cost from supplier
          "stock": { "type": "Number" }, // Current quantity in stock
          "lowStockThreshold": { "type": "Number" } // Threshold for low stock alert
        }

2.  **Order Model** (Collection: "orders")
    * Description: Represents a single sale/order made. Contains calculated revenue and profit.
    * Schema:
        {
          "shopId": { "type": "ObjectId", "ref": "Shop" },
          "customerName": { "type": "String" },
          "billerName": { "type": "String" }, // The employee who made the sale
          "items": [
            {
              "productId": { "type": "ObjectId", "ref": "Product" },
              "name": { "type": "String" }, // Name at time of sale
              "quantity": { "type": "Number" },
              "price": { "type": "Number" }, // Selling price at time of sale
              "cost": { "type": "Number" } // Cost price at time of sale
            }
          ],
          "total": { "type": "Number" }, // Total Revenue for the order
          "totalProfit": { "type": "Number" }, // Total Profit calculated for the order (total revenue - total cost of items)
          "date": { "type": "Date" } // Date the order was created
        }

3.  **Invoice Model** (Collection: "invoices")
    * Description: Stores the PDF invoice reference for an order.
    * Schema:
        {
          "shopId": { "type": "ObjectId", "ref": "Shop" },
          "orderId": { "type": "ObjectId", "ref": "Order" },
          "pdfPath": { "type": "String" }, // Relative path to the PDF file
          "customerName": { "type": "String" },
          "billerName": { "type": "String" },
          "total": { "type": "Number" }, // Matches the Order total (Revenue)
          "date": { "type": "Date" } // Date the invoice/order was created
        }

4.  **User Model** (Collection: "users")
    * Description: Represents an owner or employee. Contains salary details.
    * Schema:
        {
          "name": { "type": "String" },
          "email": { "type": "String" },
          "role": { "type": "String", "enum": ["owner", "employee"] },
          "shopId": { "type": "ObjectId", "ref": "Shop" },
          "salary": {
            "amount": { "type": "Number" }, // Monthly salary amount
            "status": { "type": "String", "enum": ["paid", "pending"] } // Current payment status
            // Note: 'passwordHash' is excluded for security
          }
        }

5.  **Notification Model** (Collection: "notifications")
    * Description: Stores alerts, primarily for low stock.
    * Schema:
        {
          "shopId": { "type": "ObjectId", "ref": "Shop" },
          "message": { "type": "String" }, // The notification text
          "isRead": { "type": "Boolean" }, // Whether the owner has seen it
          "createdAt": { "type": "Date" } // When the notification was created
        }

6.  **Shop Model** (Collection: "shops")
    * Description: Represents the shop itself with its name, address, and related information.
    * Schema:
        {
          "shopName": { "type": "String" }, // Name of the shop
          "ownerId": { "type": "ObjectId", "ref": "User" }, // Owner of the shop
          "address": { "type": "String" }, // Physical address/location of the shop
          "employees": [{ "type": "ObjectId", "ref": "User" }], // Array of employee IDs
          "products": [{ "type": "ObjectId", "ref": "Product" }] // Array of product IDs
        }
`;
