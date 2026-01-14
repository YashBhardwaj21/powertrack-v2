# PowerTrack v2 - Solar Energy Monitoring System

A complete full-stack application for monitoring solar energy generation across West Java schools, featuring real-time telemetry, public leaderboards, and administrative dashboards.

## 🚀 Features

### Frontend
- ✅ **Public Leaderboard** - Community solar energy rankings
- ✅ **Real-time Dashboard** - Live telemetry from solar installations
- ✅ **Authentication** - Secure JWT-based login system
- ✅ **WebSocket Updates** - Real-time data streaming
- ✅ **Responsive Design** - TailwindCSS-powered UI
- ✅ **Interactive Maps** - Leaflet integration for school locations
- ✅ **Analytics Charts** - Recharts for data visualization

### Backend
- ✅ **RESTful API** - Complete Express.js API server
- ✅ **PostgreSQL Database** - Supabase-hosted with proper schema
- ✅ **JWT Authentication** - Secure user authentication
- ✅ **WebSocket Server** - Real-time telemetry broadcasting
- ✅ **Hardware Integration** - API key authentication for ESP32 devices
- ✅ **Input Validation** - Express-validator on all endpoints
- ✅ **Security** - Helmet, CORS, rate limiting

## 📁 Project Structure

```
powertrack-v2/
├── backend/                 # Node.js/Express backend
│   ├── src/
│   │   ├── config/         # Environment configuration
│   │   ├── db/             # Database connection
│   │   ├── middleware/     # Auth, validation middleware
│   │   ├── routes/         # API endpoints
│   │   ├── types/          # TypeScript types
│   │   ├── websocket/      # WebSocket server
│   │   ├── scripts/        # Migration & seed scripts
│   │   └── server.ts       # Main server file
│   ├── schema.sql          # Database schema
│   ├── package.json
│   └── tsconfig.json
│
├── components/             # React components
├── pages/                  # React pages
├── services/               # API service layer
├── App.tsx                 # Main React app
├── index.tsx               # Entry point
├── package.json
└── vite.config.ts
```

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 18+ and npm/pnpm
- Supabase account (free tier works)
- Git

### 1. Clone Repository

```bash
cd powertrack-v2
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:

```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# JWT Configuration
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRY=24h

# WebSocket
WS_PORT=3002
```

Run migrations and seed data:

```bash
npm run db:migrate
npm run db:seed
```

Start backend server:

```bash
npm run dev
```

### 3. Frontend Setup

```bash
# In project root
npm install
```

Create/update `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_WS_URL=ws://localhost:3002
```

Start frontend:

```bash
npm run dev
```

### 4. Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api/v1
- **Health Check**: http://localhost:3001/health

### 5. Login Credentials

After seeding:
- **Admin**: `admin@powertrack.com` / `admin123`
- **School Admins**: Check backend console output for emails / `school123`

## 🔌 Hardware Integration

### ESP32 Configuration

Get your school's API key from the database or admin panel, then use this code:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "YOUR_WIFI";
const char* password = "YOUR_PASSWORD";
const char* apiUrl = "http://your-server:3001/api/v1/telemetry/ingest";
const char* apiKey = "your-school-api-key";

void sendTelemetry(float power, float voltage, float current) {
    HTTPClient http;
    http.begin(apiUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-KEY", apiKey);
    
    String payload = "{\"power_w\":" + String(power) + 
                     ",\"voltage\":" + String(voltage) + 
                     ",\"current_a\":" + String(current) + "}";
    
    http.POST(payload);
    http.end();
}
```

## 📊 Database Schema

### Main Tables

- **users** - User accounts with roles (admin, school_admin, viewer)
- **schools** - School information and API keys
- **telemetry** - Time-series solar energy data
- **alerts** - System alerts and warnings

See `backend/schema.sql` for complete schema.

## 🔐 API Authentication

### User Authentication (JWT)

```javascript
// Login
const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
});
const { token } = await response.json();

// Use token in subsequent requests
fetch('/api/v1/dashboard/summary', {
    headers: { 'Authorization': `Bearer ${token}` }
});
```

### Hardware Authentication (API Key)

```javascript
fetch('/api/v1/telemetry/ingest', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': 'school-api-key'
    },
    body: JSON.stringify({ power_w, voltage, current_a })
});
```

## 🌐 Deployment

### Backend Deployment

Recommended platforms:
- **Railway** (easiest)
- **Render**
- **DigitalOcean App Platform**
- **Heroku**

Set environment variables in platform dashboard and deploy from Git.

### Frontend Deployment

Recommended platforms:
- **Vercel** (recommended)
- **Netlify**
- **Cloudflare Pages**

Update `.env.local` with production API URLs before deploying.

### Database

Supabase is already cloud-hosted. Just ensure:
1. Connection pooling is enabled
2. Backups are configured
3. IP whitelist includes your backend server

## 🧪 Testing

### Test Backend API

```bash
# Health check
curl http://localhost:3001/health

# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@powertrack.com","password":"admin123"}'

# Get leaderboard
curl http://localhost:3001/api/v1/dashboard/leaderboard
```

### Test Hardware Ingestion

```bash
curl -X POST http://localhost:3001/api/v1/telemetry/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your-api-key" \
  -d '{"power_w":2500,"voltage":230,"current_a":10.87}'
```

## 📝 Development Notes

### Key Changes from Previous Version

- ❌ Removed all mock authentication
- ❌ Removed localStorage-based fake sessions
- ❌ Removed placeholder API endpoints
- ❌ Removed simulation code
- ✅ Added complete Node.js/Express backend
- ✅ Added PostgreSQL database with proper schema
- ✅ Added JWT authentication
- ✅ Added WebSocket real-time updates
- ✅ Added hardware API key authentication

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite 5
- TailwindCSS 3
- React Router 6
- Recharts 2
- Leaflet 1.9

**Backend:**
- Node.js 20+
- Express 4
- PostgreSQL 14 (Supabase)
- WebSocket (ws)
- JWT + bcrypt
- TypeScript

## 🐛 Troubleshooting

### "Cannot connect to database"
- Check `DATABASE_URL` in backend `.env`
- Verify Supabase project is active
- Check IP whitelist in Supabase settings

### "WebSocket connection failed"
- Ensure backend is running on port 3002
- Check firewall settings
- Verify `VITE_WS_URL` in frontend `.env.local`

### "Invalid credentials" on login
- Ensure database is seeded (`npm run db:seed`)
- Check email/password combination
- Verify JWT_SECRET is set in backend

### Frontend shows "Failed to fetch"
- Ensure backend is running
- Check `VITE_API_BASE_URL` matches backend port
- Verify CORS is configured correctly

## 📄 License

MIT

## 👥 Support

For issues or questions, please check:
1. Backend README: `backend/README.md`
2. Database schema: `backend/schema.sql`
3. API endpoints: Backend README API section

---

**Built with ❤️ for West Java Schools**
