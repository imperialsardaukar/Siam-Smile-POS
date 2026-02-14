# Safe Deployment Update Guide

## ⚠️ CRITICAL: Data Preservation Notice

This update includes database schema changes that are **100% backward compatible**. Your existing data will be preserved automatically.

---

## What's New in This Update

### 1. Cashier Item Detail Modal
- Click the expand icon (top-left of menu items) to view full details
- See large product images, descriptions, and prices
- Add to order directly from the modal

### 2. Enhanced Receipt System
- After payment, you'll see "Print receipt?" prompt
- Receipts include randomized thank-you messages
- Cashier can view Past Orders and reprint receipts
- Admin can view and print receipts from Orders panel

### 3. Menu Item Availability Toggle
- Admin can mark items as "Unavailable" in Menu panel
- Unavailable items are visually dimmed in Cashier view
- Cashier cannot add unavailable items to orders
- Real-time sync across all devices

### 4. Menu Backup/Restore
- Export complete menu (categories + items) to JSON file
- Import with "Merge" mode (safe, keeps existing data)
- Import with "Replace" mode (replaces everything - use with caution)
- Useful for setting up new locations or recovering from issues

---

## Safe Deployment Steps

### Step 1: Create Pre-Update Backup
```bash
cd /opt/siam-smile-pos

# Create timestamped backup
cp backend/data/data.json "backend/data/backups/pre-update-$(date +%Y%m%d-%H%M%S).json"

# Verify backup was created
ls -la backend/data/backups/
```

### Step 2: Pull Latest Code
```bash
cd /opt/siam-smile-pos
git pull origin main
```

### Step 3: Install Dependencies
```bash
# Root dependencies
npm install

# Backend dependencies
cd backend && npm install && cd ..

# Frontend dependencies
cd frontend && npm install && cd ..
```

### Step 4: Build Frontend
```bash
cd /opt/siam-smile-pos
npm run build
```

### Step 5: Zero-Downtime Reload
```bash
# PM2 reload (keeps the app running during restart)
pm2 reload siam-smile-pos

# Or if you need to restart completely:
# pm2 restart siam-smile-pos
```

### Step 6: Verify Deployment
```bash
# Check health endpoint
curl http://localhost:3001/health

# View recent logs
pm2 logs siam-smile-pos --lines 20

# Check PM2 status
pm2 status
```

---

## Post-Deployment Verification

### Verify Menu Items Still Present
1. Log in as Admin
2. Go to Menu panel
3. Confirm all menu items are visible
4. Check that all images and descriptions are intact

### Test New Features
1. **Item Detail Modal**: Go to Cashier, click expand icon on any menu item
2. **Availability Toggle**: In Admin Menu, click "Disable" on an item, check Cashier view
3. **Receipt Flow**: Create a test order, complete payment, see print prompt
4. **Backup/Export**: In Admin Menu, click Backup button, verify JSON downloads

### Verify Real-Time Sync
1. Open Cashier view on one device/browser
2. Toggle an item's availability in Admin on another device
3. Confirm Cashier view updates immediately

---

## Rollback Instructions (If Needed)

If anything goes wrong, you can rollback:

```bash
# Stop the app
pm2 stop siam-smile-pos

# Restore from pre-update backup
cp backend/data/backups/pre-update-YYYYMMDD-HHMMSS.json backend/data/data.json

# Go back to previous code version
git log --oneline -5  # Find previous commit
git checkout <previous-commit-hash>

# Rebuild
npm run build

# Restart
pm2 start siam-smile-pos
```

---

## Troubleshooting

### Issue: Menu items missing after update
**Solution:** Check if migration ran. Look in logs for "migration" messages. If needed, manually add fields:
```bash
# Stop app
pm2 stop siam-smile-pos

# The migration runs automatically on next start
pm2 start siam-smile-pos
```

### Issue: Frontend shows blank page
**Solution:** Rebuild frontend
```bash
cd /opt/siam-smile-pos
npm run build
pm2 reload siam-smile-pos
```

### Issue: Socket.IO connection errors
**Solution:** Check firewall and Nginx config
```bash
# Test locally
curl http://localhost:3001/health

# Check firewall
ufw status

# If using Nginx, verify config
nginx -t
```

### Issue: Receipt printing not working
**Solution:** This is browser-based printing. Ensure:
- Popups are allowed for your domain
- Browser's print dialog opens
- For thermal printers, use system print settings

---

## Data Migration Details

### New Fields Added (Auto-Migrated)
| Field | Default | Description |
|-------|---------|-------------|
| `menu[].unavailable` | `false` | Whether item can be ordered |
| `menu[].description` | `""` | Item description text |

### Migration Behavior
- ✅ Existing items keep their current values
- ✅ Missing fields are added with safe defaults
- ✅ No data loss occurs
- ✅ Migration runs automatically on server start
- ✅ Backup created before any changes

---

## Files Changed in This Update

### Backend
- `backend/server.js` - New socket events, receipt generation
- `backend/storage.js` - Data migration logic

### Frontend
- `frontend/src/pages/Cashier.jsx` - Item modal, receipt flow, past orders
- `frontend/src/pages/Admin.jsx` - Availability toggle, backup/restore
- `frontend/src/styles.css` - Print styles

### Documentation
- `DEPLOY.md` - Added update instructions
- `FEATURES_IMPLEMENTATION_SUMMARY.md` - Complete feature documentation
- `DEPLOY_UPDATE_GUIDE.md` - This file

---

## Support

If you encounter issues:
1. Check logs: `pm2 logs siam-smile-pos`
2. Verify health: `curl http://localhost:3001/health`
3. Check data file: `cat backend/data/data.json | head -50`
4. Review backup files: `ls -la backend/data/backups/`

---

**Update Version:** 1.1.0  
**Release Date:** 2026-02-14  
**Status:** Production Ready ✅
