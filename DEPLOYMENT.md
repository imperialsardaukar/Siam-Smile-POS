# Siam Smile POS - VPS Deployment Guide

## Quick Start (Ubuntu 20.04+ with Node.js 18+)

```bash
# 1. Clone the repository
git clone <your-repo-url> siam-smile-pos
cd siam-smile-pos

# 2. Install backend dependencies
cd backend && npm install
cd ..

# 3. Install frontend dependencies and build
cd frontend && npm install && npm run build
cd ..

# 4. Create logs directory
mkdir -p logs

# 5. Install PM2 globally
npm install -g pm2

# 6. Start with PM2
pm2 start ecosystem.config.cjs

# 7. Save PM2 config and setup startup script
pm2 save
pm2 startup
# Run the command PM2 outputs (usually: sudo env PATH=... pm2 startup systemd -u <user> --hp /home/<user>)
```

## Environment Variables (Optional)

Create `backend/.env` file:

```bash
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
JWT_SECRET=your-super-secret-jwt-key-change-this
ADMIN_USERNAME=Admin
ADMIN_PASSWORD=YourSecurePassword123
```

## Default Access

- **URL**: http://your-server-ip:3001
- **Admin Username**: Admin (or your custom ADMIN_USERNAME)
- **Admin Password**: Admin$4637 (or your custom ADMIN_PASSWORD)

## PM2 Commands

```bash
pm2 status                    # Check status
pm2 logs siam-smile-pos       # View logs
pm2 restart siam-smile-pos    # Restart app
pm2 stop siam-smile-pos       # Stop app
pm2 delete siam-smile-pos     # Remove from PM2
```

## File Structure After Build

```
siam-smile-pos/
├── backend/
│   ├── server.js           # Main entry point
│   ├── package.json        # Dependencies (NO nanoid!)
│   ├── utils.js            # ID generator (crypto-based)
│   ├── public/             # Frontend build output
│   ├── data/               # Database (auto-created)
│   │   ├── data.json
│   │   └── backups/
│   └── node_modules/
├── frontend/               # Source code (not served)
├── logs/                   # PM2 logs (auto-created)
├── ecosystem.config.cjs    # PM2 configuration
└── package.json            # Root package.json
```

## Troubleshooting

### Port already in use
```bash
sudo lsof -i :3001
sudo kill -9 <PID>
# Or change PORT in ecosystem.config.cjs
```

### Permission denied on logs
```bash
mkdir -p logs
chmod 755 logs
```

### Backend won't start
```bash
cd backend
node server.js
# Check for errors in console
```

## Security Notes

1. **Change default admin password** immediately after first login
2. **Set JWT_SECRET** to a random string in production
3. **Use firewall** to block port 3001 from public (use Nginx reverse proxy with SSL)
4. **Regular backups** - data is stored in `backend/data/data.json`

## Nginx Reverse Proxy (Recommended)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
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
}
```

Enable with:
```bash
sudo ln -s /etc/nginx/sites-available/siam-smile-pos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```
