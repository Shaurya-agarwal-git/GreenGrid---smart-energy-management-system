# GreenGrid – Smart Energy Management Information System (EMIS)

[![Status](https://img.shields.io/badge/Status-Production%20Ready-emerald.svg)]()
[![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Django%20%7C%20MySQL%20%7C%20Gemini%20AI-0F2E1E.svg)]()
[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)]()

**GreenGrid** is a complete, enterprise-grade Energy Management Information System (EMIS) engineered for multi-facility industrial plants, commercial office campuses, cold chain warehouses, and academic institutions.

It enables organizations to monitor real-time smart meter electrical telemetry, calculate Time-of-Day (TOD) utility billing in Indian Rupees (₹), track rooftop and ground-mounted solar PV generation, detect abnormal baseload leaks, perform ESG Scope 2 carbon accounting, and receive AI-powered energy optimization insights via Google Gemini.

---

## 1. System Architecture & Features

```
                                      +------------------------+
                                      |   Google Gemini 3.8    |
                                      |      Flash AI API      |
                                      +-----------+------------+
                                                  ^
                                                  | (Context Prompting)
+-----------------------+             +-----------+------------+             +------------------------+
|  React 19 Frontend    | <=========> |   Django REST / Node   | <=========> |  MySQL 8.0 Database    |
|  - Executive KPIs     |  REST APIs  |   Backend Services     |  Django ORM |  - 3NF Normalized      |
|  - Load Curve Charts  |   + JWT     |   - Physics Simulator  |             |  - 30-Day Time Series  |
|  - Smart Meter Grid   |             |   - Tariff Math (INR)  |             |  - Multi-Tenant Schema |
|  - Gemini AI Auditor  |             |   - Carbon ESG Engine  |             |  - Index Partitioning  |
+-----------------------+             +------------------------+             +------------------------+
```

### Core Modules:
1. **Executive Dashboard**: Real-time metrics for Energy Consumption (kWh), Cost in INR (₹), Solar Generation (kWh), Solar Contribution %, Scope 2 Carbon Emissions (kg CO₂e), and Avoided Emissions.
2. **Multi-Facility Management**: Complete CRUD for 5 distinct industrial/commercial facility types with floor area ($m^2$), sanctioned connected load (kW), and solar capacity (kW).
3. **Smart Meter Telemetry & Simulator**: 12 industrial sub-meters measuring 3-phase Line Voltage (V), Line Current (A), Active Demand (kW), Interval kWh, Power Factor, and Frequency (50.0 Hz). Includes live tick generator.
4. **Energy Consumption Analytics**: Diurnal 24-hour load curves, 30-day consumption trends, facility energy intensity benchmarks ($kWh/m^2$), and peak vs. off-peak variance.
5. **Utility Billing Management**: Multi-part industrial tariff calculations (Energy charges, Maximum Demand charges, FPPCA fuel surcharges, Solar Net-Metering feed-in credits, and State Electricity Duty).
6. **Renewable Solar & BESS Monitoring**: Real-time solar irradiance ($W/m^2$), Battery Energy Storage System (BESS) State of Charge (SOC %), self-consumption %, and grid export.
7. **AI-Powered Energy Assistant**: Integrated Google Gemini API (`gemini-3.8-flash`) with dynamic context grounding and rule-based energy engineering fallback.
8. **Rule-Based Anomaly Detection**: Automatic alerts for low power factor ($<0.90$), nocturnal HVAC baseload leaks, and peak contract exceedance.
9. **Report Generation & CSV Export**: Exportable monthly energy audits, utility billing statements, and GHG carbon audit reports.

---

## 2. Technology Stack

- **Frontend**: React 19, Tailwind CSS v4, Plus Jakarta Sans & JetBrains Mono typography, Recharts, Lucide Icons, Motion.
- **Backend**: Python 3.10+, Django 4.2+, Django REST Framework, Simple JWT, Python-dotenv, Pandas.
- **Database**: MySQL 8.0+ / Django ORM with foreign keys, composite indexes, and strict SQL mode.
- **AI Integration**: Google Gemini API (`@google/genai` TypeScript SDK and Python SDK) using model `gemini-3.8-flash`.
- **Runtime Preview**: Full-stack Node/Express engine running on port 3000 mounting Vite with complete DRF REST API compatibility.

---

## 3. Installation & Local Setup

### 3.1 Backend Setup (Django + MySQL)

1. **Clone and enter backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure MySQL Database**:
   Create a database in your local MySQL instance:
   ```sql
   CREATE DATABASE greengrid_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
   Create a `.env` file in `/backend/` (or copy from `.env.example`):
   ```ini
   DEBUG=True
   SECRET_KEY=greengrid-django-secret-key-2026
   DB_ENGINE=mysql
   DB_NAME=greengrid_db
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_HOST=127.0.0.1
   DB_PORT=3306
   GEMINI_API_KEY=your_gemini_api_key
   GRID_EMISSION_FACTOR=0.82
   ```

5. **Run Migrations & Seed Sample Data**:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   python manage.py seed_data
   ```

6. **Start Django REST Development Server**:
   ```bash
   python manage.py runserver 8000
   ```

---

### 3.2 Frontend & Full-Stack Dev Server

1. **Install Node dependencies**:
   ```bash
   npm install
   ```

2. **Run the Full-Stack Application**:
   ```bash
   npm run dev
   ```
   The application will be live at `http://localhost:3000`.

---

## 4. Demo Login Accounts

| Role | Username | Password | Access Privileges |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin` | `adminpassword123` | Full system access: add/edit facilities, tariffs, meters, manage users. |
| **Facility Manager** | `manager` | `managerpassword123` | Operational access: monitor assigned facility, log readings, view bills. |
| **Viewer** | `viewer` | `viewerpassword123` | Read-only executive dashboard, reports, and energy charts. |

*(Quick Role Switching is also built directly into the UI header for fast evaluation.)*

---

## 5. Mathematical Formulas Implemented

1. **Three-Phase Active Power Calculation**:
   $$P (\text{kW}) = \frac{\sqrt{3} \times V_{L-L} \times I_L \times \cos(\phi)}{1000}$$

2. **Grid Carbon Emissions (Scope 2 GHG Protocol)**:
   $$\text{Emissions (kg CO}_2\text{e)} = \text{Grid Consumption (kWh)} \times \text{Grid Emission Factor (0.82 kg CO}_2\text{e/kWh)}$$

3. **Renewable Solar Contribution**:
   $$\text{Renewable \%} = \left( \frac{\text{Solar Energy Generated (kWh)}}{\text{Total Facility Energy Consumption (kWh)}} \right) \times 100$$

4. **Multi-Part Utility Electricity Bill**:
   $$\text{Total Bill (₹)} = \text{Energy Charges} + \text{Demand Charges} + \text{FPPCA Surcharge} - \text{Solar Export Rebate} + \text{Taxes}$$
