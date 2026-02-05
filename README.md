# PowerTrack v2 - Solar Energy Monitoring System

PowerTrack v2 is a comprehensive solar energy monitoring platform designed for educational and government institutions in West Java. It provides real-time telemetry ingestion, interactive public leaderboards, and administrative dashboards for maintaining solar infrastructure.

## System Architecture

### Frontend Application
- **Framework**: React 18 with TypeScript and Vite 5
- **UI Toolkit**: TailwindCSS 3 for responsive design
- **Visualization**: Recharts and ECharts for high-performance data plotting
- **Mapping**: Leaflet interactive maps for geospatial visualization
- **State Management**: React Context API for authentication and WebSocket data
- **Routing**: React Router 6 with protected route guards

### Backend Services
- **Runtime**: Node.js 20+ with Express 4
- **Database**: PostgreSQL 14 (Supabase) with connection pooling
- **Real-time**: Custom WebSocket server (`ws` library) for sub-second telemetry broadcasting
- **Authentication**: 
  - **User**: JWT (JSON Web Tokens) with secure HTTP headers
  - **Hardware**: API Key validation with hashed storage
- **Validation**: Zod and Express-Validator for strict request schema enforcement

## Key Features

1.  **Public Leaderboard & Analytics**
    - Real-time ranking of schools based on Specific Yield (kWh/kWp).
    - Interactive energy graphs with adjustable time ranges (1W, 30D, 6M, 1Y).
    - "Today's Production" live feed updated every few seconds.

2.  **Telemetry Ingestion Platform**
    - High-throughput endpoint for IoT devices (ESP32/Data Loggers).
    - Supports HTTP REST and MQTT protocols.
    - Automatic latency tracking via server-side timestamps.
    - Strictly typed payload validation to prevent data corruption.

3.  **Administrative Control Room**
    - Role-Based Access Control (RBAC): System Admins, School Admins, Viewers.
    - Device Provisioning Wizard: Step-by-step guide to generating API keys and configuration code.
    - Live Diagnostics: Monitor ingestion events, drift, and system health in real-time.
    - User Management: Invite, assign, and manage user roles across organizations.

## Getting Started

### Prerequisites
- Node.js 18.0.0 or higher
- npm or pnpm package manager
- Git

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/YashBhardwaj21/powertrack-v2.git
    cd powertrack-v2
    ```

2.  **Backend Setup**
    Navigate to the backend directory and install dependencies:
    ```bash
    cd backend
    npm install
    ```

    Create a `.env` file in the `backend` directory with your credentials:
    ```env
    NODE_ENV=development
    PORT=3001
    FRONTEND_URL=http://localhost:3000
    DATABASE_URL=postgresql://user:password@host:5432/postgres
    JWT_SECRET=your_secure_secret
    WS_PORT=3002
    ```

    Start the development server:
    ```bash
    npm run dev
    ```

3.  **Frontend Setup**
    Open a new terminal in the project root:
    ```bash
    npm install
    ```

    Create a `.env.local` file in the root directory:
    ```env
    VITE_API_BASE_URL=http://localhost:3001/api/v1
    VITE_WS_URL=ws://localhost:3002
    ```

    Start the frontend application:
    ```bash
    npm run dev
    ```

    Access the application at `http://localhost:3000`.

## Hardware Integration Guide

To connect a new solar inverter or data logger:

1.  Log in as a System Admin.
2.  Navigate to **Control Room**.
3.  Click **"Manage"** or **"Register New Org"**.
4.  Follow the **Device Wizard** to generate a unique `X-API-KEY`.
5.  Configure your hardware to send POST requests to the ingestion endpoint:

**Endpoint:** `http://<your-server>/api/v1/telemetry/ingest`
**Header:** `X-API-KEY: <your-api-key>`
**Payload (JSON):**
```json
{
  "power_w": 2500.5,
  "voltage": 230.2,
  "current_a": 10.8,
  "daily_kwh": 12.5
}
```

## Security Implementation

- **Session Security**: Authentication tokens are stored in `sessionStorage` to ensure sessions are terminated upon browser closure, mitigating session hijacking risks on shared computers.
- **Data Integrity**: All incoming telemetry data is validated against strict schemas types. Invalid packets are rejected immediately.
- **Rate Limiting**: API endpoints are protected against brute-force and DDoS attacks using `express-rate-limit`.
- **CORS Policy**: Strict Cross-Origin Resource Sharing policies prevent unauthorized domain access.

## Support

For technical assistance or feature requests, please contact the development team or submit an issue in the repository issue tracker.
