# PowerTrack Backend API

Production-ready Node.js/Express backend for the PowerTrack solar monitoring system.

## Features

- ✅ **JWT Authentication** - Secure user authentication with bcrypt password hashing
- ✅ **PostgreSQL Database** - Supabase-hosted PostgreSQL with proper schema
- ✅ **RESTful API** - Complete API endpoints for all frontend needs
- ✅ **WebSocket Server** - Real-time telemetry updates
- ✅ **Hardware Integration** - API key-based authentication for ESP32 devices
- ✅ **Input Validation** - Express-validator for all endpoints
- ✅ **Rate Limiting** - Protection against API abuse
- ✅ **Security** - Helmet, CORS, and secure headers

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
# Copy from example
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Get these from your Supabase project settings
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres

# Generate a secure random string for JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRY=24h

WS_PORT=3002
```

### 3. Run Database Migrations

```bash
npm run db:migrate
```

This will create all necessary tables (users, schools, telemetry, alerts).

### 4. Seed Sample Data

```bash
npm run db:seed
```

This creates:
- 5 sample schools in West Java
- Admin user: `admin@powertrack.com` / `admin123`
- School admin users (password: `school123`)
- 7 days of sample telemetry data
- Sample alerts

### 5. Start Development Server

```bash
npm run dev
```

The server will start on:
- **API**: http://localhost:3001/api/v1
- **WebSocket**: ws://localhost:3002
- **Health Check**: http://localhost:3001/health

## API Endpoints

### Authentication

- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/verify` - Verify JWT token

### Dashboard

- `GET /api/v1/dashboard/summary` - Complete dashboard data
- `GET /api/v1/dashboard/leaderboard` - Public leaderboard
- `GET /api/v1/dashboard/energy-logs?school_id=X` - Energy logs for a school

### Telemetry

- `POST /api/v1/telemetry/ingest` - Hardware data ingestion (requires API key)
- `GET /api/v1/telemetry/:schoolId/latest` - Latest telemetry
- `GET /api/v1/telemetry/:schoolId/history` - Historical telemetry
- `GET /api/v1/telemetry/all/latest` - All schools latest data

### Schools

- `GET /api/v1/schools` - List all schools
- `GET /api/v1/schools/:id` - Get school by ID
- `POST /api/v1/schools` - Create school (admin only)
- `PUT /api/v1/schools/:id` - Update school (admin only)
- `GET /api/v1/schools/:id/api-key` - Get school API key
- `POST /api/v1/schools/:id/regenerate-api-key` - Regenerate API key (admin)

## Hardware Integration

### ESP32 Example

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* apiUrl = "http://your-server:3001/api/v1/telemetry/ingest";
const char* apiKey = "your-school-api-key"; // Get from database

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

## WebSocket Protocol

### Client Connection

```javascript
const ws = new WebSocket('ws://localhost:3002');

ws.onopen = () => {
    // Subscribe to specific school or all schools
    ws.send(JSON.stringify({
        type: 'subscribe',
        schoolId: 'school-uuid' // or 'all'
    }));
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    if (message.type === 'telemetry_update') {
        console.log('New telemetry:', message.data);
    }
};
```

## Production Deployment

### Build for Production

```bash
npm run build
npm start
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-domain.com
DATABASE_URL=postgresql://...
JWT_SECRET=<strong-random-secret>
```

### Recommended Hosting

- **Backend**: Railway, Render, DigitalOcean App Platform
- **Database**: Supabase (already configured)
- **WebSocket**: Same server as API

## Security Considerations

1. **Always use HTTPS** in production
2. **Keep JWT_SECRET secure** and never commit to git
3. **Rotate API keys** periodically
4. **Monitor rate limits** and adjust as needed
5. **Regular database backups** (Supabase handles this automatically)

## Troubleshooting

### Database Connection Error

- Verify `DATABASE_URL` is correct
- Check Supabase project is active
- Ensure IP is whitelisted in Supabase (or use 0.0.0.0/0 for development)

### WebSocket Connection Failed

- Ensure `WS_PORT` is not blocked by firewall
- Check if port 3002 is available
- Verify frontend `VITE_WS_URL` matches backend port

### Authentication Errors

- Verify `JWT_SECRET` is set
- Check token expiry settings
- Ensure frontend sends `Authorization: Bearer <token>` header

## License

MIT
