# Audit Summary – Siam Smile POS

## Issues Found and Fixed

### 1. Revenue Integrity Bugs

- **order:delete** – Deleting a non-done order did not subtract its subtotal from revenue. Fixed so revenue is reduced by the order subtotal when the order is deleted.
- **order:update** – Updating order items did not adjust revenue. Fixed so revenue is recalculated when items change (new subtotal − old subtotal).

### 2. Staff Roles

- Staff previously had no role enforcement; all staff could access Cashier and Kitchen.
- **Changes**: Added `role` (cashier / kitchen / both / manager) to staff:
  - Enforced in `App.jsx` Guards for `/cashier` and `/kitchen`
  - Role stored in backend and returned on staff login
  - Admin UI: role selector when creating staff and role dropdown for existing staff
  - Backend: `staff:setRole` event and migration for existing staff (default `role: "both"`)

### 3. Input Validation

- **requireNumber** – Only accepted numbers; JSON often sends strings (e.g. `"6"`).
- **Fix**: `requireNumber` now accepts numeric strings and returns the parsed number; callers use this for `price`, `qty`, etc.

### 4. Order Edit/Delete UI

- Backend supported `order:update` and `order:delete`, but the frontend had no UI.
- **Fix**: Added an **Orders** tab in Admin to view, edit (note), and delete non-done orders.

### 5. Category Edit/Delete UI

- Backend supported these operations, but the Admin UI only had “Add”.
- **Fix**: Added Edit and Delete for categories in the Menu panel.

### 6. Broadcast Optimization

- `persistAndBroadcast` emitted both the specific event (e.g. `orders:updated`) and `state:snapshot`.
- Frontend only listens to `state:snapshot`.
- **Fix**: Simplified to broadcast only `state:snapshot` to avoid redundant events.

---

## Oracle / Production Readiness

### Backend

- **PORT**: Uses `process.env.PORT` (default 3001).
- **HOST**: Uses `process.env.HOST` (default `0.0.0.0`) for all interfaces.
- **Admin credentials**: Configurable via `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
- **Static serving**: Optionally serves the frontend from `backend/public` when present.
- **Console**: Logs `listening on ${HOST}:${PORT}` instead of localhost.

### Frontend

- **API / Socket URL**: Uses `VITE_API_BASE` when set; otherwise dev uses `http://localhost:3001` and production uses `window.location.origin` (same-origin).
- **Socket**: Removed `transports: ["websocket"]` so Socket.IO can fall back to polling when needed.
- **Reconnect**: Uses `reconnectionAttempts: 20` and `reconnectionDelay: 1000`.

### Deployment

- **PM2**: Added `ecosystem.config.cjs` for production.
- **Docs**: Added `DEPLOY.md` with deployment steps for Oracle Cloud VM.
- **`.env.example`**: Added for frontend API configuration.

---

## Performance and Reliability

- **Socket listeners**: All socket listeners are removed in the cleanup function to avoid leaks.
- **Kitchen alert**: `useLoudBeep` cleans up its interval and `AudioContext` on unmount.
- **Persistence**: State is written to disk via `atomicWrite` (write to `.tmp` then rename).

---

## Remaining Limitations

1. **Single-instance only**: One backend process; no clustering. Data is in a single JSON file; multiple backends would need shared storage.
2. **Admin credentials**: Still have defaults; production should set `ADMIN_PASSWORD` (and optionally `ADMIN_USERNAME`) via env.
3. **JWT_SECRET**: Default value exists; production should set `JWT_SECRET`.
4. **Orders edit UI**: Admin order edit supports changing the note only; full item editing would require more UI.
