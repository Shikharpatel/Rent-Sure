# Rent-Sure 🏠

<div align="center">
  <h3>A Full-Stack Web Application Re-imagining Property Rentals</h3>
  <p>Replacing traditional security deposits with a flexible monthly protection plan.</p>
</div>

---

## 🌟 Overview

**Rent-Sure** is an innovative platform engineered to provide a modern alternative to hefty upfront security deposits. By leveraging a monthly protection plan model, Rent-Sure reduces the financial burden on tenants while assuring landlords with robust coverage and an automated claims process.

### ✨ Key Features

- **Role-Based Access Control:** Secure JWT-based authentication for Tenants, Landlords, and Admins.
- **KYC Verification:** Identity and document verification workflows for tenants prior to leasing.
- **Tenant Risk Auto-Assessment:** Automated risk-scoring algorithms evaluating tenant reliability and assigning dynamic risk levels.
- **Property Management:** Landlords can seamlessly list and manage properties from a bespoke dashboard.
- **Policies & Payments:** Generation of custom monthly protection policies and structured recording of premium transactions.
- **Claims Workflow:** A streamlined interface for landlords to file and manage claims against the protection policy.

---

## 📸 Platform Previews

### 🌐 The Rent-Sure Experience
<img src="backend/utils/imagespack/WhatsApp%20Image%202026-04-12%20at%209.20.44%20PM.jpeg" width="800" alt="Landing Page">
<br>
<img src="backend/utils/imagespack/WhatsApp%20Image%202026-04-12%20at%209.21.06%20PM.jpeg" width="800" alt="Features">

### 🛠️ Landlord Dashboard
<img src="backend/utils/imagespack/WhatsApp%20Image%202026-04-12%20at%209.23.30%20PM.jpeg" width="800" alt="Landlord Overview">
<br>
<img src="backend/utils/imagespack/WhatsApp%20Image%202026-04-12%20at%209.23.43%20PM.jpeg" width="800" alt="My Properties">
<br>
<img src="backend/utils/imagespack/WhatsApp%20Image%202026-04-12%20at%209.23.57%20PM.jpeg" width="800" alt="File a Claim">

### 🛡️ Admin Portal (Underwriting & Fraud)
<img src="backend/utils/imagespack/WhatsApp%20Image%202026-04-12%20at%209.22.44%20PM.jpeg" width="800" alt="KYC Inbox">
<br>
<img src="backend/utils/imagespack/WhatsApp%20Image%202026-04-12%20at%209.21.38%20PM.jpeg" width="800" alt="Policies Under Review">
<br>
<img src="backend/utils/imagespack/WhatsApp%20Image%202026-04-12%20at%209.22.17%20PM.jpeg" width="800" alt="Claims Under Review">
<br>
<img src="backend/utils/imagespack/WhatsApp%20Image%202026-04-12%20at%209.23.00%20PM.jpeg" width="800" alt="Analytics">

### 🧑‍💼 Tenant Flow
<img src="backend/utils/imagespack/WhatsApp%20Image%202026-04-12%20at%209.24.55%20PM.jpeg" width="800" alt="Tenant KYC Status">

---

## 🏗️ Architecture & Tech Stack

Rent-Sure is built with modern, scalable web technologies:

### 🎨 Frontend
- **Framework:** React + Vite
- **Styling:** Vanilla CSS focusing on a bespoke, premium aesthetic—deep dark modes, dynamic gradients, glassmorphism, and polished micro-animations.

### ⚙️ Backend
- **Environment:** Node.js & Express.js
- **Database:** PostgreSQL (Neon Serverless Database)
- **Authentication:** JWT & `bcrypt`

---

## 📂 Project Structure

```text
rent-sure/
├── backend/          # Node.js + Express API server
│   ├── config/       # Postgres connection & env config
│   ├── controllers/  # API route handlers
│   ├── middleware/   # Authentication & validation
│   ├── models/       # Database queries (pg)
│   └── routes/       # Express route definitions
├── frontend/         # React Application
│   ├── public/       # Static assets
│   └── src/          # Components, Contexts, Pages, and Styles
├── database/         # SQL Schema definitions and seed logic
├── start.bat         # Windows startup script
└── start.js          # Cross-platform startup script
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [PostgreSQL](https://www.postgresql.org/) (or a Neon database instance)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/rent-sure.git
   cd rent-sure
   ```

2. **Configure the Backend**
   ```bash
   cd backend
   npm install
   ```
   Create a `.env` file in the `backend/` directory:
   ```env
   PORT=5000
   DATABASE_URL=your_neon_postgres_connection_string
   JWT_SECRET=your_super_secret_jwt_key
   ```
   *Note: Initialize the database by executing the SQL statements found in `database/schema.sql`.*

3. **Configure the Frontend**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application Locally

A convenient startup script is provided in the project root to run both the frontend and backend servers simultaneously.

```bash
# Run the application (cross-platform)
node start.js

# Or use the Windows batch file
.\start.bat
```

- **Backend API:** `http://localhost:5000`
- **Frontend App:** `http://localhost:5173`

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

This project is open-sourced under the MIT License.
