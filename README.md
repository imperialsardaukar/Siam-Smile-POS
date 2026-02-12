# Siam Smile POS - Production-Grade VPS System

A modern, enterprise-ready POS system built for restaurants, cafés, and small businesses.

**Platform**: Web-based, works on any device with a browser (tablets, phones, laptops)  
**Real-time**: All changes sync instantly across all connected devices using WebSocket  
**Backend & Frontend**: Single Express server serving both API and static assets  
**Database**: Server-side persistent JSON with automatic backups  
**Security**: JWT authentication, password hashing, audit logs  

## Key Features

### Core POS
- ✅ Cashier interface (menu, cart, checkout)
- ✅ Kitchen display (real-time order queue with audio alerts)
- ✅ Admin dashboard (staff, menu, settings, metrics)
- ✅ Real-time synchronization across devices
- ✅ Responsive mobile UI (Tailwind CSS)

### Revenue & Metrics
- ✅ Revenue tracking with daily/weekly/monthly breakdowns
- ✅ Order audit log with timestamps and staff attribution
- ✅ Prep time metrics and averages per order
- ✅ Bestseller tracking and sales analytics
- ✅ Staff performance metrics (orders created, avg time)
- ✅ Manual revenue adjustments with full logging
- ✅ CSV export for orders and analytics

### Advanced Features
- ✅ **Discount & Promo System**: Percentage/fixed-amount codes with expiration
- ✅ **Receipt Printing**: Manual receipt generation with payment method tagging
- ✅ **Payment Methods**: Cash, card, or custom tracking per transaction
- ✅ **Staff Management**: Create accounts with role-based access (Cashier/Kitchen/Both/Manager)
- ✅ **Tax & Service Charge**: Configurable percentages applied automatically
- ✅ **Admin Controls**: Reset or adjust metrics, manage all aspects

## Architecture

**Single Server Model**
```
Express Server (Port 3001)
├── REST API (/auth/*)
├── WebSocket (Socket.IO) - Real-time updates
├── Static Files (React SPA) - Served from /backend/public
└── Data Persistence - /backend/data/data.json with backups
```

No separate ports, no complex deployment – everything runs on one Node process managed by PM2.

## Quick Start (Local Development)

### Prerequisites
- **Node.js** v18 or higher  
- **npm** (comes with Node.js)

### Windows Setup
```bat
# Simply run:
start.bat

# Opens:
# - Backend: http://localhost:3001
# - Frontend: http://localhost:5173 (Vite dev server)
```

### macOS/Linux Setup
```bash
# Install all dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Terminal 1: Start backend
cd backend && npm start

# Terminal 2: Start frontend
cd frontend && npm run dev

# Open http://localhost:5173
```

### Default Credentials
- **Admin**: `Admin` / `Admin$4637` (change in production!)
- Create staff accounts via the Admin panel

## Production Deployment

For deployment on a VPS (DigitalOcean, Azure, AWS, Oracle Cloud), see **[DEPLOY.md](DEPLOY.md)**.

Quick summary:
```bash
# On your VPS (Ubuntu 20.04+)
cd /opt

# Clone/upload project
git clone YOUR_REPO siam-smile-pos
cd siam-smile-pos

# Install and build
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
npm run build

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your secrets

# Run with PM2
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Visit `http://<your-vps-ip>:3001`

## Project Structure

```
siam-smile-pos/
├── backend/
│   ├── server.js           # Main Express + Socket.IO server
│   ├── auth.js             # JWT and password handling
│   ├── storage.js          # JSON persistence
│   ├── validators.js       # Input validation
│   ├── constants.js        # Config from env
│   ├── data/               # Persistent data folder
│   │   ├── data.json       # Single source of truth
│   │   └── backups/        # Auto-created backups
│   ├── public/             # Built frontend (generated)
│   ├── .env.example        # Environment template
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React app
│   │   ├── main.jsx        # Entry point
│   │   ├── pages/          # Page components
│   │   │   ├── Landing.jsx
│   │   │   ├── AdminLogin.jsx
│   │   │   ├── StaffLogin.jsx
│   │   │   ├── Admin.jsx   # Dashboard + metrics
│   │   │   ├── Cashier.jsx # Order creation
│   │   │   └── Kitchen.jsx # Order queue
│   │   ├── components/     # Reusable UI components
│   │   ├── state/          # React context (Auth, Store)
│   │   └── lib/            # Utilities (calc, money, api)
│   ├── vite.config.js      # Builds to ../backend/public
│   └── package.json
│
├── scripts/                # Build scripts
├── ecosystem.config.cjs    # PM2 configuration
├── DEPLOY.md               # Detailed deployment guide
├── README.md               # This file
└── package.json            # Root npm scripts
```

## npm Scripts

From the **root directory**:

```bash
# Development (runs both backend and frontend)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# PM2 management (after npm install -g pm2)
npm run pm2:start
npm run pm2:stop
npm run pm2:restart
npm run pm2:logs
```

## State Architecture

All data is managed in a single JSON file (`backend/data/data.json`):

```javascript
{
  "version": 1,
  "settings": { "taxPercent": 5, "serviceChargePercent": 10, "currency": "AED" },
  "categories": [{ "id": "...", "name": "Soft Drinks", ... }],
  "menu": [{ "id": "...", "name": "Cola", "price": 6, ... }],
  "staff": [{ "id": "...", "username": "mai", "passwordHash": "..." }],
  "orders": [{ "id": "...", "status": "done", "items": [...], ... }],
  "revenue": { "total": 1500, "adjustments": [...] },
  "promos": [{ "id": "...", "code": "SUMMER20", "type": "percentage", ... }],
  "discounts": [{ "id": "...", "orderId": "...", "amount": 50, ... }],
  "receipts": [{ "id": "...", "orderId": "...", "paymentMethod": "cash", ... }],
  "metrics": {
    "bestsellers": { "item-id": { "count": 125, "revenue": 750 }, ... },
    "staffPerformance": { "staff-id": { "ordersCreated": 50, "avgTime": 180 }, ... },
    "dailyRevenue": { "2024-02-10": 2500, ... },
    "weeklyRevenue": { "2024-W6": 15000, ... },
    "monthlyRevenue": { "2024-02": 50000, ... },
    "prepTimes": { "order-id": 245, ... },
    "paymentMethods": { "cash": 5000, "card": 3000, "other": 500 }
  },
  "logs": [{ "id": "...", "ts": "2024-02-10T...", "type": "order:create", ... }]
}
```

**Real-time Sync**: Whenever any change is made, the new state is persisted and broadcast to all connected clients via `state:snapshot`.

## Security

1. **Admin Credentials**: Change default username/password immediately in production
2. **JWT Secret**: Generate a strong secret with `openssl rand -base64 32`
3. **HTTPS**: Use Nginx reverse proxy with Let's Encrypt SSL
4. **Firewall**: Only allow necessary ports (3001 or via reverse proxy)
5. **Backups**: Automatic backups created in `backend/data/backups/`
6. **Audit Log**: All important actions logged with timestamps and staff IDs

## Troubleshooting

**Port 3001 already in use?**
```bash
# Kill the process
lsof -i :3001
kill -9 <PID>

# Or change PORT in backend/.env
```

**WebSocket connection failed?**
- Check firewall allows port 3001
- If using reverse proxy (Nginx), ensure it forwards WebSocket headers
- Check browser console for error messages
- In production, CORS is disabled - ensure same-origin access

**Frontend shows blank page or 404?**
- Run `npm run build` to build frontend  
- Verify `backend/public/index.html` exists
- Check backend logs: `pm2 logs siam-smile-pos`

**Can't connect from other devices on LAN?**
- Find your machine's IP: `ipconfig` (Windows) or `ifconfig` (Linux/Mac)
- Visit `http://<your-ip>:3001` from another device on the same network
- Ensure firewall allows port 3001

## Performance

- **Concurrent Users**: Tested up to 50 concurrent users on a single t2.micro instance
- **Scalability**: For 1000+ users, consider migrating to PostgreSQL/SQLite
- **Memory**: Default 500MB limit per process (configurable in ecosystem.config.cjs)

## License

MIT
