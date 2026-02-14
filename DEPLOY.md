# Siam Smile POS - VPS Deployment Guide

Complete guide for deploying Siam Smile POS on any Ubuntu VPS (DigitalOcean, Azure, AWS, Oracle Cloud, etc.)

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│           SINGLE SERVER MODEL               │
│                                             │
│  Port 3001                                  │
│  ┌─────────────────────────────────────┐   │
│  │   Express Server                    │   │
│  │   ├── REST API (/auth/*)            │   │
│  │   ├── Socket.IO (WebSocket)         │   │
│  │   └── Static Files (React SPA)      │   │
│  │       └── Built frontend            │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Data: backend/data/data.json               │
│  Backups: backend/data/backups/             │
└─────────────────────────────────────────────┘
```

**Key Principles:**
- Single Node.js process on single port
- Same-origin only (no CORS in production)
- Built-in JSON database with automatic backups
- JWT authentication with hashed passwords

---

## Prerequisites

- **Ubuntu 20.04+** (or any Linux distro)
- **Node.js 18+**
- **npm** (comes with Node.js)
- **PM2** (optional but recommended for production)

---

## Quick Deploy (Fresh Ubuntu VPS)

### 1. Connect to Your VPS

```bash
ssh root@YOUR_VPS_IP
```

### 2. Install Node.js 18+

```bash
# Update package list
apt update && apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version
```

### 3. Install PM2 (Process Manager)

```bash
npm install -g pm2
```

### 4. Clone/Upload the Project

**Option A: Clone from Git**
```bash
cd /opt
git clone YOUR_REPO_URL siam-smile-pos
cd siam-smile-pos
```

**Option B: Upload via SCP**
```bash
# From your local machine:
scp -r /path/to/siam-smile-pos root@YOUR_VPS_IP:/opt/
ssh root@YOUR_VPS_IP
```

### 5. Install Dependencies & Build

```bash
cd /opt/siam-smile-pos

# Install all dependencies (root, backend, frontend)
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Build frontend (outputs to backend/public)
npm run build
```

### 6. Configure Environment

```bash
cd /opt/siam-smile-pos/backend

# Create environment file
cat > .env << 'EOF'
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_USERNAME=Admin
ADMIN_PASSWORD=YourSecureAdminPassword123
EOF

# IMPORTANT: Change the JWT_SECRET and admin password!
```

Generate a secure JWT secret:
```bash
openssl rand -base64 32
```

### 7. Test the Application

```bash
cd /opt/siam-smile-pos/backend
npm start
```

You should see:
```
=================================
Siam Smile POS v1.0.0
Environment: production
Listening on 0.0.0.0:3001
=================================
```

Test the health endpoint:
```bash
curl http://localhost:3001/health
```

Stop the test (Ctrl+C) and continue to PM2 setup.

### 8. Start with PM2 (Production)

```bash
cd /opt/siam-smile-pos

# Start with PM2
pm2 start ecosystem.config.cjs

# Save PM2 config to restart on boot
pm2 save
pm2 startup systemd

# Run the command that PM2 outputs, e.g.:
# env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root
```

### 9. Configure Firewall

```bash
# Allow SSH (if not already allowed)
ufw allow 22/tcp

# Allow the application port
ufw allow 3001/tcp

# Enable firewall
ufw --force enable

# Check status
ufw status
```

### 10. Access Your Application

```
http://YOUR_VPS_IP:3001
```

Login with the admin credentials you set in the `.env` file.

---

## Using Nginx as Reverse Proxy (Optional but Recommended)

For production with HTTPS and custom domain:

### 1. Install Nginx

```bash
apt install -y nginx
```

### 2. Create Nginx Config

```bash
cat > /etc/nginx/sites-available/siam-smile-pos << 'EOF'
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable the site
ln -s /etc/nginx/sites-available/siam-smile-pos /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # Remove default site

# Test and reload
nginx -t
systemctl reload nginx
```

### 3. Setup HTTPS with Let's Encrypt

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Obtain certificate
certbot --nginx -d your-domain.com

# Follow the prompts
```

### 4. Update Firewall

```bash
ufw allow 'Nginx Full'
ufw delete allow 3001/tcp  # Close direct access
```

---

## Management Commands

### View Logs
```bash
# PM2 logs
pm2 logs siam-smile-pos

# Follow logs
pm2 logs siam-smile-pos --lines 100

# System logs
journalctl -u pm2-root -f
```

### Restart Application
```bash
cd /opt/siam-smile-pos
pm2 restart siam-smile-pos
```

### Update Application (After Code Changes)
```bash
cd /opt/siam-smile-pos

# Pull latest changes
git pull

# Rebuild
npm run build

# Restart
pm2 restart siam-smile-pos
```

### Safe Update Deployment (Preserves All Data)

**⚠️ IMPORTANT: This update includes database migrations. Follow these steps exactly to preserve your existing menu items, orders, and all data.**

```bash
cd /opt/siam-smile-pos

# 1. Create a manual backup first (safety precaution)
cp backend/data/data.json "backend/data/backups/pre-update-$(date +%Y%m%d-%H%M%S).json"

# 2. Pull the latest code
git pull

# 3. Install dependencies (if package.json changed)
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 4. Build the frontend
npm run build

# 5. Reload with PM2 (zero-downtime restart)
pm2 reload siam-smile-pos

# 6. Verify the application is running
sleep 2
curl http://localhost:3001/health

# 7. Check logs for any migration messages
pm2 logs siam-smile-pos --lines 20
```

**What This Update Includes:**
1. **Menu Item Availability Toggle** - Admin can mark items as unavailable (real-time sync to cashier)
2. **Expand Menu Item Modal** - Cashier can view item details with photo and description
3. **Enhanced Receipt System** - Print receipts with randomized closing messages
4. **Past Orders for Cashier** - View and reprint receipts for recent orders
5. **Menu Backup/Restore** - Export and import menu data (JSON format)
6. **Backward-Compatible Migrations** - Automatically adds new fields to existing data

**Data Preservation Notes:**
- ✅ All existing menu items are preserved
- ✅ All existing categories are preserved  
- ✅ All order history is preserved
- ✅ New fields (`unavailable`, `description`) are auto-added with safe defaults
- ✅ Backward compatibility maintained for all existing data

### Check Application Status
```bash
pm2 status
pm2 monit  # Real-time monitor
```

### Backup Data
```bash
# Data is automatically backed up to backend/data/backups/
# Manual backup:
cp -r /opt/siam-smile-pos/backend/data/backups /backup/location/

# Or backup just the data file:
cp /opt/siam-smile-pos/backend/data/data.json /backup/data-$(date +%Y%m%d).json
```

---

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3001
lsof -i :3001

# Kill it
kill -9 <PID>
```

### Permission Denied
```bash
# Ensure data directory is writable
chmod -R 755 /opt/siam-smile-pos/backend/data
```

### Cannot Connect from Browser
```bash
# Check firewall
ufw status

# Check if app is running
curl http://localhost:3001/health

# Check PM2 status
pm2 status
```

### WebSocket Connection Failed
```bash
# Check Nginx config includes WebSocket headers
# Ensure firewall allows the port
# Check browser console for CORS errors (should be none in production)
```

### Database Corruption
```bash
# Stop the app
pm2 stop siam-smile-pos

# Restore from backup
cp /opt/siam-smile-pos/backend/data/backups/data-BACKUP_DATE.json \
   /opt/siam-smile-pos/backend/data/data.json

# Restart
pm2 start siam-smile-pos
```

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Set to `production` for production |
| `PORT` | `3001` | HTTP port to listen on |
| `HOST` | `0.0.0.0` | Bind address (0.0.0.0 = all interfaces) |
| `JWT_SECRET` | *(dev only)* | Secret for JWT signing - **CHANGE IN PROD** |
| `ADMIN_USERNAME` | `Admin` | Admin login username |
| `ADMIN_PASSWORD` | `Admin$4637` | Admin login password - **CHANGE IN PROD** |

---

## Security Checklist

- [ ] Changed default JWT_SECRET (use `openssl rand -base64 32`)
- [ ] Changed default admin username and password
- [ ] Firewall configured (only allow necessary ports)
- [ ] HTTPS enabled (via Nginx + Let's Encrypt)
- [ ] Regular backups configured
- [ ] PM2 configured to restart on boot

---

## File Structure on VPS

```
/opt/siam-smile-pos/
├── backend/
│   ├── server.js          # Main Express server
│   ├── public/            # Built frontend (generated)
│   ├── data/
│   │   ├── data.json      # Main database
│   │   └── backups/       # Automatic backups
│   ├── auth.js            # JWT & password handling
│   ├── constants.js       # Environment config
│   ├── storage.js         # JSON persistence
│   └── validators.js      # Input validation
├── frontend/              # Source code (not served in prod)
├── scripts/               # Build scripts
├── ecosystem.config.cjs   # PM2 configuration
├── package.json           # Root package
└── DEPLOY.md             # This file
```

---

## Support

For issues or questions:
1. Check logs: `pm2 logs`
2. Test health endpoint: `curl http://localhost:3001/health`
3. Verify firewall: `ufw status`
4. Check disk space: `df -h`
