# TRIACT - AI-Powered Retail Intelligence System

**TRIACT** is a full-stack inventory and business management platform designed for modern retailers. Unlike traditional POS systems, TRIACT leverages **Generative AI (Google Gemini)** and **OCR (Tesseract.js)** to act as an intelligent partner—predicting stockouts, answering complex business questions, and digitizing physical invoices automatically.

---

## Key Features

### AI-Driven Intelligence
* **RAG Chat Assistant:** Talk to your data. Ask *"How much profit did Rahul make today?"* or *"Which snacks are expiring soon?"* The system uses **Retrieval-Augmented Generation** to fetch live DB stats and generate accurate, natural language answers.
* **Smart Forecasting:** Algorithms analyze the last 90 days of sales velocity to predict exactly when specific products will go out of stock.
* **OCR Invoice Scanning:** Upload a photo of a supplier invoice; **Tesseract.js** runs locally to extract items, match them against your inventory, and auto-update stock levels.

### Shop Management
* **Role-Based Access Control (RBAC):** Distinct portals for **Owners** (full control) and **Employees** (POS & sales only).
* **Interactive Dashboard:** Real-time visualization of Revenue, Profit, and Category performance using **Chart.js**.
* **Employee Payroll:** Track salaries, payment status (Paid/Due), and calculate labor cost percentages vs. revenue.

### Operations & POS
* **Smart POS:** Fast billing interface with dynamic search.
* **Automated Invoicing:** Generates professional PDF invoices instantly using **PDFKit**. In production, these are stored via **Vercel Blob**.
* **Low Stock Alerts:** Real-time notifications when inventory dips below custom thresholds.

---

## Tech Stack

**Frontend (Client)**
* **Framework:** React (Vite)
* **Styling:** Tailwind CSS + Framer Motion (for animations)
* **State/API:** Context API + Axios
* **Visualization:** Chart.js
* **OCR Engine:** Tesseract.js

**Backend (Server)**
* **Runtime:** Node.js
* **Framework:** Next.js (API Routes)
* **Database:** MongoDB (Mongoose ODM)
* **Authentication:** JWT (JSON Web Tokens)
* **AI Integration:** Google Gemini Pro Model (`@google/generative-ai`)
* **File Handling:** PDFKit, Vercel Blob

---

## Installation & Setup

Follow these steps to run TRIACT locally.

### 1. Prerequisites
* Node.js (v18+)
* MongoDB Atlas Connection String
* Google Gemini API Key (Get it from [Google AI Studio](https://aistudio.google.com/))

### 2. Clone Repository
```bash
git clone [https://github.com/your-username/TRIACT.git](https://github.com/your-username/TRIACT.git)
cd TRIACT

```

### 3. Backend Configuration

Navigate to the backend folder and install dependencies:

```bash
cd backend
npm install

```

Create a `.env` file in the `backend/` root:

```ini
# Database
MONGODB_URI="mongodb+srv://<user>:<pass>@cluster.mongodb.net/triact?retryWrites=true&w=majority"

# Security
JWT_SECRET="super_secret_key_change_this"

# AI Service
GEMINI_API_KEY="AIzaSy...<your_api_key>"

# App Config
PORT=3001
FRONTEND_URL="http://localhost:5173"

```

**Seed the Database:**
Populate your database with sample products, sales history, and users for testing.

```bash
npm run seed

```

Start the backend server:

```bash
npm run dev
# Server runs on http://localhost:3001

```

### 4. Frontend Configuration

Open a new terminal, navigate to the frontend folder, and install dependencies:

```bash
cd ../frontend
npm install

```

Start the frontend development server:

```bash
npm run dev
# App runs on http://localhost:5173

```

---

## Test Credentials

After running `npm run seed`, you can log in with these pre-configured accounts:

| Role | Email | Password | Features |
| --- | --- | --- | --- |
| **Owner** | `owner1@example.com` | `Password123` | Full Dashboard, Settings, Employee Mgmt, AI Chat |
| **Employee** | `rahul@example.com` | `Password123` | POS, Salary Info, View Invoices |

---

## Project Structure

```bash
TRIACT/
├── backend/
│   ├── lib/            # DB connection, Auth middleware, Gemini client
│   ├── models/         # Mongoose Schemas (User, Shop, Product, Order)
│   ├── pages/api/      # Next.js API Routes (Controllers)
│   │   ├── auth/       # Login, Register
│   │   └── shops/      # Main business logic endpoints
│   └── seed.js         # Database seeder script
├── frontend/
│   ├── src/
│   │   ├── components/ # Reusable UI (Cards, Charts, Modals)
│   │   ├── context/    # Global Auth State
│   │   ├── pages/      # Views (Dashboard, Chat, InvoiceScan)
│   │   └── services/   # Axios API wrappers

```

## AI Architecture

TRIACT uses a **RAG (Retrieval-Augmented Generation)** architecture for its chat feature:

1. **User Query:** *"How are my beverage sales?"*
2. **Data Fetching:** Backend parallel-fetches summarized sales data, recent orders, and stock levels from MongoDB.
3. **Context Construction:** Data is formatted into a optimized text prompt (reducing token usage).
4. **Inference:** Google Gemini analyzes the context + user query.
5. **Response:** The AI returns a plain-text summary (e.g., *"Beverages revenue is ₹12,000 this month, up 5%..."*) which is displayed in the UI.
