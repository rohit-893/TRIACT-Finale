# TRIACT - AI-Powered Retail Intelligence System

<div align="center">

![React](https://img.shields.io/badge/React-18-blue?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![Gemini AI](https://img.shields.io/badge/AI-Google_Gemini-8E75B2?logo=google&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css&logoColor=white)

</div>

---

## Overview

**TRIACT** is a modern, full-stack inventory and business management platform designed to digitize small retail operations. Unlike static POS systems, TRIACT integrates **Generative AI** and **Computer Vision** to act as an intelligent business partner.

It empowers shop owners to:

- **Chat with their Data:** Ask natural language questions about sales, profit, and employee performance.
- **Predict the Future:** Forecast stockouts days in advance using historical sales velocity.
- **Automate Entry:** Digitize paper invoices instantly using OCR technology.

---

## Key Features

### Artificial Intelligence Suite

- **RAG Chat Assistant:** Built on **Google Gemini 2.5 Flash**. It uses a **Retrieval-Augmented Generation (RAG)** architecture to fetch real-time database stats (revenue, stock, margins) and provide context-aware business answers in plain English.
- **Stock Forecasting:** A dedicated algorithm analyzes the last 90 days of `Order` data to calculate average daily sales and predict the exact date a product will go out of stock.
- **Smart OCR Scanner:** Powered by **Tesseract.js**. Upload an image of a supplier invoice, and the system automatically extracts item names and quantities to update inventory without manual typing.

### Comprehensive Dashboard

- **Owner View:** Real-time KPI cards for Revenue, Net Profit, and Units Sold. Includes visual charts for monthly revenue trends and category-wise sales distribution.
- **Low Stock Alerts:** Automated system notifications trigger when product stock dips below defined thresholds.

### Point of Sale (POS) & Operations

- **Smart Billing:** Fast, searchable product grid for rapid checkout.
- **PDF Invoicing:** Automatically generates professional PDF invoices using `PDFKit`.
  - **Dev Mode:** Saves locally to filesystem.
  - **Prod Mode:** Uploads to **Vercel Blob** storage for permanent hosting.
- **Employee Management:** Track staff profiles, monthly salaries, and payment status (Paid/Due/Overdue).

---

## Architecture & Tech Stack

The application follows a **Decoupled Monolith** architecture where the frontend and backend are separate but designed to work seamlessly together.

### Frontend (Client)

- **Framework:** React 18 (Vite Build Tool)
- **Styling:** Tailwind CSS (Utility-first) + Framer Motion (Animations)
- **State Management:** React Context API + Custom Hooks (`useAuth`)
- **HTTP Client:** Axios with Interceptors for JWT handling
- **Visuals:** Chart.js for analytics, Lucide React for iconography

### Backend (Server)

- **Runtime:** Node.js
- **Framework:** Next.js (Pages Router used as API Server)
- **Database:** MongoDB Atlas (Mongoose ODM)
- **Authentication:** JSON Web Tokens (JWT) with custom middleware (`authMiddleware`, `ownerMiddleware`)
- **AI Engine:** Google Generative AI SDK (`@google/generative-ai`)

---

### Data Flow Diagram (RAG Chat)

```mermaid
graph LR
    A[User Question] --> B(Backend API)
    B --> C{Fetch DB Data}
    C --> D[Products]
    C --> E[Orders]
    C --> F[Employees]
    D & E & F --> G[Context Construction]
    G --> H[Gemini API]
    H --> I[Natural Language Answer]
    I --> J[Frontend UI]
```

---

## Installation & Setup

### 1. Prerequisites

- Node.js (v18 or higher)
- MongoDB Atlas Account (Free tier works)
- Google AI Studio Account (for Gemini API Key)

### 2. Clone the Repository

```bash
git clone https://github.com/your-username/TRIACT.git
cd TRIACT
```

### 3. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```ini
MONGODB_URI="mongodb+srv://<username>:<password>@cluster.mongodb.net/triact?retryWrites=true&w=majority"
JWT_SECRET="your_super_secret_jwt_key_here"
GEMINI_API_KEY="AIzaSy...<your_gemini_api_key>"
PORT=3001
FRONTEND_URL="http://localhost:5173"
BLOB_READ_WRITE_TOKEN="your_vercel_blob_token"
```

Seed the Database:

```bash
npm run seed
```

Start Backend:

```bash
npm run dev
```

### 4. Frontend Setup

```bash
cd ../frontend
npm install
npm run dev
```

---

## Test Credentials

| Role     | Email              | Password    | Access Level                            |
| -------- | ------------------ | ----------- | --------------------------------------- |
| Owner    | owner1@example.com | Password123 | Full Admin Access, Financials, Settings |
| Employee | rahul@example.com  | Password123 | POS, Salary View, Inventory View        |

---

## API Reference

| Method | Endpoint                   | Description                 | Access |
| ------ | -------------------------- | --------------------------- | ------ |
| POST   | /api/auth/login            | Authenticate user & get JWT | Public |
| GET    | /api/shops/:id/dashboard   | Fetch KPI stats             | Owner  |
| POST   | /api/shops/:id/ai/chat     | Gemini RAG Chat             | Auth   |
| POST   | /api/shops/:id/orders      | Create order & PDF          | Auth   |
| POST   | /api/scan                  | OCR Scan                    | Auth   |
| GET    | /api/shops/:id/ai/forecast | Stock prediction            | Owner  |

---

## Troubleshooting

- Ensure backend runs on port 3001
- FRONTEND_URL must match Vite URL
- MongoDB Atlas IP must be whitelisted
- GEMINI_API_KEY must have quota

---

## Contributing

- Fork the project
- Create feature branch
- Commit changes
- Push and open PR

---
