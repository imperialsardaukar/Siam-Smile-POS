const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { Server } = require("socket.io");
const { PORT, NODE_ENV, IS_PRODUCTION } = require("./constants");
const { loadState, saveState } = require("./storage");
const { verifyToken, adminLogin, staffPasswordHash, staffPasswordVerify, signToken } = require("./auth");
const { newId } = require("./utils");
const { assert, requireString, requireNumber } = require("./validators");
const inventory = require("./inventory");
const customers = require("./customers");
const metrics = require("./metrics");

const app = express();

// CORS: Only enable in development mode
if (!IS_PRODUCTION) {
  app.use(cors({ origin: true, credentials: true }));
  console.log("[DEV] CORS enabled for all origins");
}

app.use(express.json({ limit: "2mb" }));

// Request logging in development
if (!IS_PRODUCTION) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

let state = loadState();

// Ensure state has all required fields
function ensureStateStructure() {
  const defaults = {
    version: 1,
    settings: { taxPercent: 0, serviceChargePercent: 0, currency: "AED" },
    categories: [],
    menu: [],
    staff: [],
    orders: [],
    revenue: { total: 0, adjustments: [] },
    logs: [],
    promos: [],
    discounts: [],
    receipts: [],
    inventory: [],
    customers: [],
    inventoryLogs: [],
    metrics: {
      bestsellers: {},
      staffPerformance: {},
      dailyRevenue: {},
      weeklyRevenue: {},
      monthlyRevenue: {},
      prepTimes: {},
      hourlyDistribution: {},
      paymentMethods: { cash: 0, card: 0, other: 0 }
    }
  };

  // Merge defaults with existing state
  for (const [key, value] of Object.entries(defaults)) {
    if (state[key] === undefined) {
      state[key] = JSON.parse(JSON.stringify(value));
    }
  }

  // Ensure nested metrics structure
  if (!state.metrics) state.metrics = defaults.metrics;
  if (!state.metrics.bestsellers) state.metrics.bestsellers = {};
  if (!state.metrics.staffPerformance) state.metrics.staffPerformance = {};
  if (!state.metrics.dailyRevenue) state.metrics.dailyRevenue = {};
  if (!state.metrics.weeklyRevenue) state.metrics.weeklyRevenue = {};
  if (!state.metrics.monthlyRevenue) state.metrics.monthlyRevenue = {};
  if (!state.metrics.prepTimes) state.metrics.prepTimes = {};
  if (!state.metrics.hourlyDistribution) state.metrics.hourlyDistribution = {};
  if (!state.metrics.paymentMethods) state.metrics.paymentMethods = { cash: 0, card: 0, other: 0 };

  saveState(state);
}

ensureStateStructure();

// Never send secrets to clients (even hashed). Clients don't need passwordHash.
function publicState(s) {
  return {
    ...s,
    staff: (s.staff || []).map(({ passwordHash, ...rest }) => rest),
  };
}

function logEvent(type, payload) {
  const entry = {
    id: newId(),
    ts: new Date().toISOString(),
    type,
    payload,
  };
  state.logs.unshift(entry);
  // Keep logs bounded
  state.logs = state.logs.slice(0, 5000);
  return entry;
}

/** Persist state to disk and broadcast full snapshot to all clients. Single source of truth. */
function persistAndBroadcast(io) {
  saveState(state);
  io.emit("state:snapshot", publicState(state));
}

/** Update bestseller tracking */
function trackBestsellers(items) {
  for (const item of items || []) {
    const id = item.itemId;
    if (!state.metrics.bestsellers[id]) {
      state.metrics.bestsellers[id] = { count: 0, revenue: 0 };
    }
    state.metrics.bestsellers[id].count += item.qty;
    state.metrics.bestsellers[id].revenue += item.price * item.qty;
  }
}

/** Update revenue metrics */
function trackRevenue(amount, date = new Date()) {
  const d = new Date(date);
  
  // Daily
  const dayKey = d.toISOString().split('T')[0];
  state.metrics.dailyRevenue[dayKey] = (state.metrics.dailyRevenue[dayKey] || 0) + amount;
  
  // Weekly (ISO week)
  const weekKey = getWeekKey(d);
  state.metrics.weeklyRevenue[weekKey] = (state.metrics.weeklyRevenue[weekKey] || 0) + amount;
  
  // Monthly
  const monthKey = d.toISOString().slice(0, 7); // YYYY-MM
  state.metrics.monthlyRevenue[monthKey] = (state.metrics.monthlyRevenue[monthKey] || 0) + amount;
  
  // Hourly distribution
  const hour = d.getHours();
  state.metrics.hourlyDistribution[hour] = (state.metrics.hourlyDistribution[hour] || 0) + 1;
}

function getWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${weekNo}`;
}

/** Track staff performance */
function trackStaffPerformance(staffId, orderValue, prepTimeSeconds = null) {
  if (!staffId || staffId === 'admin') return;
  
  if (!state.metrics.staffPerformance[staffId]) {
    state.metrics.staffPerformance[staffId] = { 
      ordersCreated: 0, 
      totalRevenue: 0,
      totalPrepTime: 0,
      completedOrders: 0
    };
  }
  
  const perf = state.metrics.staffPerformance[staffId];
  perf.ordersCreated++;
  perf.totalRevenue += orderValue;
  
  if (prepTimeSeconds !== null) {
    perf.totalPrepTime += prepTimeSeconds;
    perf.completedOrders++;
  }
}

// ===== API Routes =====

app.get("/health", (req, res) => {
  res.json({ 
    ok: true, 
    time: new Date().toISOString(),
    version: "1.0.0",
    env: NODE_ENV,
    uptime: process.uptime()
  });
});

app.post("/auth/admin", (req, res) => {
  const { username, password } = req.body || {};
  const token = adminLogin(username, password);
  if (!token) {
    logEvent("auth:failed", { username, type: "admin" });
    return res.status(401).json({ ok: false, error: "Invalid login" });
  }
  logEvent("auth:login", { username, type: "admin" });
  res.json({ ok: true, token, role: "admin" });
});

app.post("/auth/staff", async (req, res) => {
  const { username, password } = req.body || {};
  try {
    requireString(username, "username");
    requireString(password, "password");
    const staff = state.staff.find(s => s.username === username);
    if (!staff) {
      logEvent("auth:failed", { username, type: "staff" });
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }
    if (staff.status !== "active") {
      return res.status(403).json({ ok: false, error: "Account inactive" });
    }
    const ok = await staffPasswordVerify(password, staff.passwordHash);
    if (!ok) {
      logEvent("auth:failed", { username, type: "staff" });
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }
    const token = signToken({ role: "staff", sub: staff.id, username: staff.username });
    const staffRole = staff.role || "cashier";
    logEvent("auth:login", { username, type: "staff", staffId: staff.id });
    res.json({ 
      ok: true, 
      token, 
      role: "staff", 
      staff: { id: staff.id, username: staff.username, status: staff.status, role: staffRole } 
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Serve frontend build from backend/public
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  
  // SPA fallback - serve index.html for all non-API routes
  app.get("*", (req, res, next) => {
    // Don't interfere with API or socket routes
    if (req.path.startsWith("/auth") || 
        req.path.startsWith("/health") || 
        req.path.startsWith("/socket.io")) {
      return next();
    }
    
    const indexPath = path.join(publicDir, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
  
  console.log(`[${NODE_ENV}] Serving frontend from ${publicDir}`);
} else {
  console.log(`[${NODE_ENV}] WARNING: Frontend build not found at ${publicDir}`);
  console.log(`[${NODE_ENV}] Run 'npm run build' to create the production build.`);
}

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);

// Socket.IO configuration - same origin in production
const ioConfig = {
  cors: IS_PRODUCTION ? undefined : { origin: true, credentials: true },
  transports: ['websocket', 'polling'], // Allow fallback for compatibility
  pingTimeout: 60000,
  pingInterval: 25000,
};

const io = new Server(server, ioConfig);

// Socket auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("missing token"));
  try {
    const claims = verifyToken(token);
    socket.user = claims; // {role, sub, username}
    return next();
  } catch (e) {
    return next(new Error("invalid token"));
  }
});

io.on("connection", (socket) => {
  // Send full state snapshot on connect
  socket.emit("state:snapshot", publicState(state));
  
  if (!IS_PRODUCTION) {
    console.log(`[Socket] Connected: ${socket.user?.role} (${socket.user?.sub})`);
  }

  // Helper guards
  function requireAdmin() {
    assert(socket.user?.role === "admin", "Admin only");
  }
  function requireStaffOrAdmin() {
    assert(socket.user?.role === "staff" || socket.user?.role === "admin", "Auth required");
  }

  // ===== Settings =====
  socket.on("settings:update", (payload, cb) => {
    try {
      requireAdmin();
      const { taxPercent, serviceChargePercent, currency } = payload || {};
      if (taxPercent !== undefined) requireNumber(taxPercent, "taxPercent");
      if (serviceChargePercent !== undefined) requireNumber(serviceChargePercent, "serviceChargePercent");
      
      state.settings = {
        ...state.settings,
        ...(taxPercent !== undefined ? { taxPercent } : {}),
        ...(serviceChargePercent !== undefined ? { serviceChargePercent } : {}),
        ...(currency !== undefined ? { currency } : {}),
      };
      
      logEvent("settings:update", { by: socket.user?.role, username: socket.user?.username, taxPercent, serviceChargePercent, currency });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // ===== Categories =====
  socket.on("category:create", (payload, cb) => {
    try {
      requireAdmin();
      const { name } = payload || {};
      requireString(name, "name");
      const cat = { id: newId(), name, sortOrder: state.categories.length + 1 };
      state.categories.push(cat);
      logEvent("category:create", { by: socket.user?.role, username: socket.user?.username, cat });
      persistAndBroadcast(io);
      cb?.({ ok: true, category: cat });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("category:update", (payload, cb) => {
    try {
      requireAdmin();
      const { id, name, sortOrder } = payload || {};
      requireString(id, "id");
      const cat = state.categories.find(c => c.id === id);
      assert(cat, "Category not found");
      if (name !== undefined) requireString(name, "name");
      if (sortOrder !== undefined) requireNumber(sortOrder, "sortOrder");
      if (name !== undefined) cat.name = name;
      if (sortOrder !== undefined) cat.sortOrder = sortOrder;
      logEvent("category:update", { by: socket.user?.role, username: socket.user?.username, id, name, sortOrder });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("category:delete", (payload, cb) => {
    try {
      requireAdmin();
      const { id } = payload || {};
      requireString(id, "id");
      state.categories = state.categories.filter(c => c.id !== id);
      // Also unassign from menu items
      state.menu.forEach(m => { if (m.categoryId === id) m.categoryId = ""; });
      logEvent("category:delete", { by: socket.user?.role, username: socket.user?.username, id });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // ===== Menu =====
  socket.on("menu:create", (payload, cb) => {
    try {
      requireAdmin();
      const { name, price, categoryId, imageUrl, description } = payload || {};
      requireString(name, "name");
      const priceNum = requireNumber(price, "price");
      const item = {
        id: newId(),
        name,
        price: priceNum,
        categoryId: categoryId || "",
        imageUrl: imageUrl || "",
        description: description || "",
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      state.menu.push(item);
      logEvent("menu:create", { by: socket.user?.role, username: socket.user?.username, item });
      persistAndBroadcast(io);
      cb?.({ ok: true, item });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("menu:update", (payload, cb) => {
    try {
      requireAdmin();
      const { id, name, price, categoryId, imageUrl, isActive, description } = payload || {};
      requireString(id, "id");
      const item = state.menu.find(m => m.id === id);
      assert(item, "Menu item not found");
      if (name !== undefined) requireString(name, "name");
      if (price !== undefined) requireNumber(price, "price");
      if (name !== undefined) item.name = name;
      if (price !== undefined) item.price = requireNumber(price, "price");
      if (categoryId !== undefined) item.categoryId = categoryId;
      if (imageUrl !== undefined) item.imageUrl = imageUrl;
      if (description !== undefined) item.description = description;
      if (isActive !== undefined) item.isActive = !!isActive;
      logEvent("menu:update", { by: socket.user?.role, username: socket.user?.username, id, name, price, categoryId, imageUrl, isActive, description });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("menu:delete", (payload, cb) => {
    try {
      requireAdmin();
      const { id } = payload || {};
      requireString(id, "id");
      state.menu = state.menu.filter(m => m.id !== id);
      logEvent("menu:delete", { by: socket.user?.role, username: socket.user?.username, id });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // ===== Staff =====
  socket.on("staff:create", async (payload, cb) => {
    try {
      requireAdmin();
      const { username, password, role } = payload || {};
      requireString(username, "username");
      requireString(password, "password");
      assert(!state.staff.some(s => s.username === username), "Username already exists");
      const roleVal = role || "cashier";
      assert(["cashier", "kitchen", "manager"].includes(roleVal), "Invalid role");
      const staff = {
        id: newId(),
        username,
        passwordHash: await staffPasswordHash(password),
        status: "active",
        role: roleVal,
        createdAt: new Date().toISOString(),
      };
      state.staff.push(staff);
      logEvent("staff:create", { 
        by: socket.user?.role, 
        username: socket.user?.username, 
        staff: { id: staff.id, username: staff.username, status: staff.status, role: staff.role } 
      });
      persistAndBroadcast(io);
      cb?.({ ok: true, staff: { id: staff.id, username: staff.username, status: staff.status, role: staff.role } });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("staff:setStatus", (payload, cb) => {
    try {
      requireAdmin();
      const { id, status } = payload || {};
      requireString(id, "id");
      requireString(status, "status");
      assert(status === "active" || status === "paused", "Invalid status");
      const staff = state.staff.find(s => s.id === id);
      assert(staff, "Staff not found");
      staff.status = status;
      logEvent("staff:setStatus", { by: socket.user?.role, username: socket.user?.username, id, status });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("staff:setRole", (payload, cb) => {
    try {
      requireAdmin();
      const { id, role } = payload || {};
      requireString(id, "id");
      requireString(role, "role");
      assert(["cashier", "kitchen", "manager"].includes(role), "Invalid role");
      const staff = state.staff.find(s => s.id === id);
      assert(staff, "Staff not found");
      staff.role = role;
      logEvent("staff:setRole", { by: socket.user?.role, username: socket.user?.username, id, role });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("staff:delete", (payload, cb) => {
    try {
      requireAdmin();
      const { id } = payload || {};
      requireString(id, "id");
      state.staff = state.staff.filter(s => s.id !== id);
      logEvent("staff:delete", { by: socket.user?.role, username: socket.user?.username, id });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // ===== Promos =====
  socket.on("promo:create", (payload, cb) => {
    try {
      requireAdmin();
      const { code, type, value, expiryDate, maxUses, maxDiscount } = payload || {};
      requireString(code, "code");
      requireString(type, "type");
      assert(type === "percentage" || type === "fixed", "Type must be percentage or fixed");
      requireNumber(value, "value");
      
      assert(!state.promos.some(p => p.code.toLowerCase() === code.toLowerCase()), "Promo code already exists");
      
      const promo = {
        id: newId(),
        code: code.toUpperCase(),
        type,
        value,
        expiryDate: expiryDate || null,
        maxUses: maxUses || null,
        maxDiscount: maxDiscount || null,
        uses: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      
      state.promos.push(promo);
      logEvent("promo:create", { by: socket.user?.role, username: socket.user?.username, promo });
      persistAndBroadcast(io);
      cb?.({ ok: true, promo });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("promo:update", (payload, cb) => {
    try {
      requireAdmin();
      const { id, ...updates } = payload || {};
      requireString(id, "id");
      
      const promo = state.promos.find(p => p.id === id);
      assert(promo, "Promo not found");
      
      if (updates.code !== undefined) promo.code = updates.code.toUpperCase();
      if (updates.type !== undefined) promo.type = updates.type;
      if (updates.value !== undefined) promo.value = updates.value;
      if (updates.expiryDate !== undefined) promo.expiryDate = updates.expiryDate;
      if (updates.maxUses !== undefined) promo.maxUses = updates.maxUses;
      if (updates.maxDiscount !== undefined) promo.maxDiscount = updates.maxDiscount;
      if (updates.isActive !== undefined) promo.isActive = updates.isActive;
      
      logEvent("promo:update", { by: socket.user?.role, username: socket.user?.username, id, updates });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("promo:delete", (payload, cb) => {
    try {
      requireAdmin();
      const { id } = payload || {};
      requireString(id, "id");
      state.promos = state.promos.filter(p => p.id !== id);
      logEvent("promo:delete", { by: socket.user?.role, username: socket.user?.username, id });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("promo:apply", (payload, cb) => {
    try {
      requireStaffOrAdmin();
      const { code, orderTotal } = payload || {};
      requireString(code, "code");
      requireNumber(orderTotal, "orderTotal");
      
      const promo = state.promos.find(p => 
        p.code.toLowerCase() === code.toLowerCase() && 
        p.isActive
      );
      
      if (!promo) return cb?.({ ok: false, error: "Invalid promo code" });
      
      // Check expiry
      if (promo.expiryDate && new Date(promo.expiryDate) < new Date()) {
        return cb?.({ ok: false, error: "Promo code expired" });
      }
      
      // Check max uses
      if (promo.maxUses && promo.uses >= promo.maxUses) {
        return cb?.({ ok: false, error: "Promo code limit reached" });
      }
      
      // Calculate discount
      let discount = 0;
      if (promo.type === "percentage") {
        discount = (orderTotal * promo.value) / 100;
        // Apply max discount cap if set
        if (promo.maxDiscount && promo.maxDiscount > 0) {
          discount = Math.min(discount, promo.maxDiscount);
        }
      } else {
        discount = promo.value;
      }
      
      // Don't allow discount larger than order
      discount = Math.min(discount, orderTotal);
      
      cb?.({ ok: true, promo, discount: Math.round(discount * 100) / 100 });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // ===== Revenue =====
  socket.on("revenue:reset", (payload, cb) => {
    try {
      requireAdmin();
      state.revenue.total = 0;
      state.revenue.adjustments.unshift({
        id: newId(),
        amount: 0,
        reason: "RESET",
        ts: new Date().toISOString(),
        by: socket.user?.username || socket.user?.role,
      });
      logEvent("revenue:reset", { by: socket.user?.role, username: socket.user?.username });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("revenue:adjust", (payload, cb) => {
    try {
      requireAdmin();
      const { amount, reason } = payload || {};
      requireNumber(amount, "amount");
      requireString(reason, "reason");
      state.revenue.total = Number(state.revenue.total) + Number(amount);
      state.revenue.adjustments.unshift({
        id: newId(),
        amount,
        reason,
        ts: new Date().toISOString(),
        by: socket.user?.username || socket.user?.role,
      });
      logEvent("revenue:adjust", { by: socket.user?.role, username: socket.user?.username, amount, reason });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // ===== Orders =====
  socket.on("order:create", (payload, cb) => {
    try {
      requireStaffOrAdmin();
      const { items, note, promoCode, customerName, tableNumber, customerPhone, customerEmail, marketingOptIn } = payload || {};
      assert(Array.isArray(items) && items.length > 0, "Order must have items");
      requireString(customerName, "customerName");
      requireString(tableNumber, "tableNumber");
      
      // Snapshot items (name/price) so edits later don't change historical totals
      const snap = items.map(it => {
        requireString(it.itemId, "itemId");
        requireNumber(it.qty, "qty");
        const menuItem = state.menu.find(m => m.id === it.itemId);
        assert(menuItem, "Menu item missing");
        return {
          itemId: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          qty: it.qty,
        };
      });
      
      const subtotal = snap.reduce((s, x) => s + x.price * x.qty, 0);
      
      // Apply promo if provided
      let discount = 0;
      let appliedPromo = null;
      if (promoCode) {
        const promo = state.promos.find(p => 
          p.code.toLowerCase() === promoCode.toLowerCase() && 
          p.isActive &&
          (!p.expiryDate || new Date(p.expiryDate) >= new Date()) &&
          (!p.maxUses || p.uses < p.maxUses)
        );
        
        if (promo) {
          if (promo.type === "percentage") {
            discount = (subtotal * promo.value) / 100;
            // Apply max discount cap if set
            if (promo.maxDiscount && promo.maxDiscount > 0) {
              discount = Math.min(discount, promo.maxDiscount);
            }
          } else {
            discount = promo.value;
          }
          discount = Math.min(discount, subtotal);
          promo.uses++;
          appliedPromo = { id: promo.id, code: promo.code, discount };
        }
      }
      
      const order = {
        id: newId(),
        createdAt: new Date().toISOString(),
        createdByStaffId: socket.user.role === "staff" ? socket.user.sub : "admin",
        createdByUsername: socket.user.username || "Admin",
        status: "new",
        note: note || "",
        customerName,
        tableNumber,
        customerPhone: customerPhone || "",
        customerEmail: customerEmail || "",
        marketingOptIn: !!marketingOptIn,
        items: snap,
        subtotal,
        discount,
        total: subtotal - discount,
        promo: appliedPromo,
        acknowledgedAt: null,
        preparingAt: null,
        doneAt: null,
      };
      
      // Track customer if phone or email provided
      if (customerPhone || customerEmail) {
        const existingCustomer = state.customers.find(c => 
          (customerPhone && c.phone === customerPhone) || 
          (customerEmail && c.email === customerEmail)
        );
        if (existingCustomer) {
          existingCustomer.lastOrderAt = order.createdAt;
          existingCustomer.orderCount = (existingCustomer.orderCount || 0) + 1;
          existingCustomer.totalSpent = (existingCustomer.totalSpent || 0) + order.total;
          if (customerName) existingCustomer.name = customerName;
        } else {
          state.customers.push({
            id: newId(),
            name: customerName,
            phone: customerPhone || "",
            email: customerEmail || "",
            marketingOptIn: !!marketingOptIn,
            createdAt: order.createdAt,
            lastOrderAt: order.createdAt,
            orderCount: 1,
            totalSpent: order.total
          });
        }
      }
      
      state.orders.unshift(order);
      
      // Update revenue
      state.revenue.total = Number(state.revenue.total) + Number(order.total);
      trackRevenue(order.total, order.createdAt);
      
      // Track bestsellers
      trackBestsellers(snap);
      
      // Track staff performance
      trackStaffPerformance(order.createdByStaffId, order.total);
      
      logEvent("order:create", { 
        by: socket.user.role, 
        username: socket.user?.username,
        orderId: order.id,
        total: order.total
      });
      
      persistAndBroadcast(io);
      io.emit("kitchen:newOrder", { orderId: order.id });
      cb?.({ ok: true, order });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("order:update", (payload, cb) => {
    try {
      requireStaffOrAdmin();
      const { id, note, items } = payload || {};
      requireString(id, "id");
      const order = state.orders.find(o => o.id === id);
      assert(order, "Order not found");
      assert(order.status !== "done", "Cannot edit done order");
      
      let revenueDelta = 0;
      if (note !== undefined) order.note = String(note);
      
      if (items !== undefined) {
        assert(Array.isArray(items) && items.length > 0, "Order must have items");
        const oldTotal = order.total || 0;
        order.items = items.map(it => ({
          itemId: it.itemId,
          name: it.name,
          price: requireNumber(it.price, "item.price"),
          qty: requireNumber(it.qty, "item.qty"),
        }));
        const newSubtotal = order.items.reduce((s, x) => s + x.price * x.qty, 0);
        const newTotal = newSubtotal - (order.discount || 0);
        revenueDelta = newTotal - oldTotal;
        order.subtotal = newSubtotal;
        order.total = newTotal;
      }
      
      state.revenue.total = Number(state.revenue.total) + Number(revenueDelta);
      logEvent("order:update", { by: socket.user.role, username: socket.user?.username, orderId: id });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("order:delete", (payload, cb) => {
    try {
      requireStaffOrAdmin();
      const { id } = payload || {};
      requireString(id, "id");
      const order = state.orders.find(o => o.id === id);
      assert(order, "Order not found");
      assert(order.status !== "done", "Cannot delete done order");
      
      const total = order.total || 0;
      state.revenue.total = Number(state.revenue.total) - Number(total);
      state.orders = state.orders.filter(o => o.id !== id);
      
      logEvent("order:delete", { by: socket.user.role, username: socket.user?.username, orderId: id });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("order:setStatus", (payload, cb) => {
    try {
      requireStaffOrAdmin();
      const { id, status } = payload || {};
      requireString(id, "id");
      requireString(status, "status");
      const order = state.orders.find(o => o.id === id);
      assert(order, "Order not found");
      assert(["new","preparing","done"].includes(status), "Invalid status");

      const now = new Date().toISOString();
      if (status === "preparing") {
        if (!order.acknowledgedAt) order.acknowledgedAt = now;
        if (!order.preparingAt) order.preparingAt = now;
      }
      if (status === "done") {
        if (!order.doneAt) {
          order.doneAt = now;
          
          // Calculate prep time
          const created = new Date(order.createdAt).getTime();
          const done = new Date(order.doneAt).getTime();
          const prepSeconds = Math.round((done - created) / 1000);
          
          state.metrics.prepTimes[order.id] = prepSeconds;
          
          // Update staff performance with prep time
          if (order.createdByStaffId && order.createdByStaffId !== 'admin') {
            trackStaffPerformance(order.createdByStaffId, 0, prepSeconds);
          }
        }
      }
      order.status = status;

      logEvent("order:setStatus", { 
        by: socket.user.role, 
        username: socket.user?.username, 
        orderId: id, 
        status 
      });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // ===== Receipts & Payment =====
  socket.on("receipt:create", (payload, cb) => {
    try {
      requireStaffOrAdmin();
      const { orderId, paymentMethod, note } = payload || {};
      requireString(orderId, "orderId");
      requireString(paymentMethod, "paymentMethod");
      assert(["cash", "card", "other"].includes(paymentMethod), "Invalid payment method");
      
      const order = state.orders.find(o => o.id === orderId);
      assert(order, "Order not found");
      
      const receipt = {
        id: newId(),
        orderId,
        paymentMethod,
        amount: order.total,
        note: note || "",
        createdAt: new Date().toISOString(),
        createdBy: socket.user?.username || socket.user?.role,
      };
      
      state.receipts.unshift(receipt);
      
      // Track payment method
      if (!state.metrics.paymentMethods) {
        state.metrics.paymentMethods = { cash: 0, card: 0, other: 0 };
      }
      state.metrics.paymentMethods[paymentMethod] = 
        (state.metrics.paymentMethods[paymentMethod] || 0) + order.total;
      
      logEvent("receipt:create", { 
        by: socket.user?.role, 
        username: socket.user?.username,
        receiptId: receipt.id,
        orderId,
        paymentMethod,
        amount: order.total
      });
      
      persistAndBroadcast(io);
      cb?.({ ok: true, receipt });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("receipt:preview", (payload, cb) => {
    try {
      requireStaffOrAdmin();
      const { orderId } = payload || {};
      requireString(orderId, "orderId");
      
      const order = state.orders.find(o => o.id === orderId);
      assert(order, "Order not found");
      
      const preview = generateReceiptPreview(order, state.settings);
      cb?.({ ok: true, preview });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // ===== Reports =====
  socket.on("report:exportCSV", (payload, cb) => {
    try {
      requireAdmin();
      const { startDate, endDate } = payload || {};
      
      let orders = state.orders;
      if (startDate) {
        orders = orders.filter(o => new Date(o.createdAt) >= new Date(startDate));
      }
      if (endDate) {
        orders = orders.filter(o => new Date(o.createdAt) <= new Date(endDate));
      }
      
      // Return CSV for orders with prep times
      const rows = [
        ["orderId","createdAt","doneAt","prepSeconds","createdByUsername","status","subtotal","discount","total","paymentMethod"].join(","),
      ];
      
      for (const o of orders.slice().reverse()) {
        const created = new Date(o.createdAt).getTime();
        const done = o.doneAt ? new Date(o.doneAt).getTime() : null;
        const prepSeconds = done ? Math.round((done - created)/1000) : "";
        const subtotal = (o.items || []).reduce((s, x) => s + x.price * x.qty, 0);
        const receipt = state.receipts.find(r => r.orderId === o.id);
        
        rows.push([
          o.id,
          o.createdAt,
          o.doneAt || "",
          prepSeconds,
          JSON.stringify(o.createdByUsername || ""),
          o.status,
          subtotal.toFixed(2),
          (o.discount || 0).toFixed(2),
          (o.total || subtotal).toFixed(2),
          receipt?.paymentMethod || ""
        ].join(","));
      }
      
      cb?.({ ok: true, csv: rows.join("\n") });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("report:metrics", (payload, cb) => {
    try {
      requireAdmin();
      
      const today = new Date().toISOString().split('T')[0];
      const currentWeek = getWeekKey(new Date());
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Get advanced metrics
      const revenueByStaff = metrics.getRevenueByStaff(state);
      const revenueByItem = metrics.getRevenueByItem(state);
      const prepTimeStats = metrics.getPrepTimeStats(state);
      const customerMetrics = customers.getCustomerMetrics(state);
      const promoMetrics = metrics.getPromoMetrics(state);
      const inventoryMetrics = inventory.getInventoryMetrics(state);
      
      // Calculate averages
      const prepTimes = Object.values(state.metrics.prepTimes || {});
      const avgPrepTime = prepTimes.length > 0 
        ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length)
        : 0;
      
      // Staff performance with averages
      const staffPerf = {};
      for (const [staffId, data] of Object.entries(state.metrics.staffPerformance || {})) {
        const staff = state.staff.find(s => s.id === staffId);
        staffPerf[staffId] = {
          ...data,
          username: staff?.username || staffId,
          avgPrepTime: data.completedOrders > 0 
            ? Math.round(data.totalPrepTime / data.completedOrders)
            : 0
        };
      }
      
      // Get bestsellers with names
      const bestsellers = Object.entries(state.metrics.bestsellers || {})
        .map(([itemId, data]) => {
          const item = state.menu.find(m => m.id === itemId);
          return {
            itemId,
            name: item?.name || itemId,
            ...data
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      cb?.({ ok: true, metrics: {
        today: state.metrics.dailyRevenue[today] || 0,
        thisWeek: state.metrics.weeklyRevenue[currentWeek] || 0,
        thisMonth: state.metrics.monthlyRevenue[currentMonth] || 0,
        totalRevenue: state.revenue.total,
        totalOrders: state.orders.length,
        doneOrders: state.orders.filter(o => o.status === "done").length,
        avgPrepTime,
        bestsellers,
        staffPerformance: staffPerf,
        paymentMethods: state.metrics.paymentMethods || { cash: 0, card: 0, other: 0 },
        hourlyDistribution: state.metrics.hourlyDistribution || {},
        dailyRevenue: state.metrics.dailyRevenue || {},
        weeklyRevenue: state.metrics.weeklyRevenue || {},
        monthlyRevenue: state.metrics.monthlyRevenue || {},
        revenueByStaff,
        revenueByItem,
        prepTimeStats,
        customerMetrics,
        promoMetrics,
        inventoryMetrics
      }});
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // ===== Inventory =====
  socket.on("inventory:create", (payload, cb) => {
    try {
      requireAdmin();
      const item = inventory.createInventoryItem(payload, state, socket.user);
      logEvent("inventory:create", { by: socket.user?.role, username: socket.user?.username, item });
      persistAndBroadcast(io);
      cb?.({ ok: true, item });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("inventory:update", (payload, cb) => {
    try {
      requireAdmin();
      const item = inventory.updateInventoryItem(payload.id, payload, state, socket.user);
      logEvent("inventory:update", { by: socket.user?.role, username: socket.user?.username, id: payload.id });
      persistAndBroadcast(io);
      cb?.({ ok: true, item });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("inventory:delete", (payload, cb) => {
    try {
      requireAdmin();
      inventory.deleteInventoryItem(payload.id, state);
      logEvent("inventory:delete", { by: socket.user?.role, username: socket.user?.username, id: payload.id });
      persistAndBroadcast(io);
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("inventory:archive", (payload, cb) => {
    try {
      requireAdmin();
      const item = inventory.archiveInventoryItem(payload.id, state, socket.user);
      logEvent("inventory:archive", { by: socket.user?.role, username: socket.user?.username, id: payload.id, archived: item.isArchived });
      persistAndBroadcast(io);
      cb?.({ ok: true, item });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("inventory:search", (payload, cb) => {
    try {
      requireStaffOrAdmin();
      const items = inventory.searchInventory(payload.query, state);
      cb?.({ ok: true, items });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("inventory:lowStock", (payload, cb) => {
    try {
      requireStaffOrAdmin();
      const items = inventory.getLowStockItems(state);
      cb?.({ ok: true, items });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("inventory:outOfStock", (payload, cb) => {
    try {
      requireStaffOrAdmin();
      const items = inventory.getOutOfStockItems(state);
      cb?.({ ok: true, items });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("inventory:metrics", (payload, cb) => {
    try {
      requireAdmin();
      const data = inventory.getInventoryMetrics(state);
      cb?.({ ok: true, metrics: data });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("inventory:logs", (payload, cb) => {
    try {
      requireAdmin();
      const logs = inventory.getInventoryLogs(payload.itemId, state);
      cb?.({ ok: true, logs });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // ===== Customers =====
  socket.on("customer:search", (payload, cb) => {
    try {
      requireStaffOrAdmin();
      const results = customers.searchCustomers(payload.query, state);
      cb?.({ ok: true, customers: results });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("customer:export", (payload, cb) => {
    try {
      requireAdmin();
      const optedIn = customers.getOptedInCustomers(state);
      const csv = customers.exportCustomersToCSV(optedIn);
      cb?.({ ok: true, csv });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("customer:getHistory", (payload, cb) => {
    try {
      requireAdmin();
      const history = customers.getCustomerOrderHistory(payload.customerId, state);
      cb?.({ ok: true, history });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  // ===== Export Endpoints =====
  socket.on("export:customers", (payload, cb) => {
    try {
      requireAdmin();
      
      const rows = [
        ["id","name","phone","email","marketingOptIn","createdAt","lastOrderAt","orderCount","totalSpent"].join(","),
      ];
      
      for (const c of state.customers || []) {
        rows.push([
          c.id,
          JSON.stringify(c.name || ""),
          JSON.stringify(c.phone || ""),
          JSON.stringify(c.email || ""),
          c.marketingOptIn ? "yes" : "no",
          c.createdAt || "",
          c.lastOrderAt || "",
          c.orderCount || 0,
          (c.totalSpent || 0).toFixed(2)
        ].join(","));
      }
      
      cb?.({ ok: true, csv: rows.join("\n"), filename: `customers_${new Date().toISOString().split('T')[0]}.csv` });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("export:inventory", (payload, cb) => {
    try {
      requireAdmin();
      
      const rows = [
        ["id","name","quantity","unit","minStock","costPerUnit","category","supplier","isArchived","createdAt","updatedAt"].join(","),
      ];
      
      for (const i of state.inventory || []) {
        rows.push([
          i.id,
          JSON.stringify(i.name || ""),
          i.quantity || 0,
          i.unit || "pcs",
          i.minStock || 0,
          (i.costPerUnit || 0).toFixed(2),
          JSON.stringify(i.category || ""),
          JSON.stringify(i.supplier || ""),
          i.isArchived ? "yes" : "no",
          i.createdAt || "",
          i.updatedAt || ""
        ].join(","));
      }
      
      cb?.({ ok: true, csv: rows.join("\n"), filename: `inventory_${new Date().toISOString().split('T')[0]}.csv` });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("export:staffPerformance", (payload, cb) => {
    try {
      requireAdmin();
      
      const rows = [
        ["staffId","username","ordersCreated","totalRevenue","completedOrders","avgPrepTime"].join(","),
      ];
      
      for (const [staffId, data] of Object.entries(state.metrics.staffPerformance || {})) {
        const staff = state.staff.find(s => s.id === staffId);
        const avgPrepTime = data.completedOrders > 0 
          ? Math.round(data.totalPrepTime / data.completedOrders)
          : 0;
        
        rows.push([
          staffId,
          JSON.stringify(staff?.username || staffId),
          data.ordersCreated || 0,
          (data.totalRevenue || 0).toFixed(2),
          data.completedOrders || 0,
          avgPrepTime
        ].join(","));
      }
      
      cb?.({ ok: true, csv: rows.join("\n"), filename: `staff_performance_${new Date().toISOString().split('T')[0]}.csv` });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("export:promoUsage", (payload, cb) => {
    try {
      requireAdmin();
      
      const rows = [
        ["id","code","type","value","maxDiscount","expiryDate","maxUses","uses","isActive","createdAt"].join(","),
      ];
      
      for (const p of state.promos || []) {
        rows.push([
          p.id,
          JSON.stringify(p.code || ""),
          p.type || "",
          p.value || 0,
          p.maxDiscount || "",
          p.expiryDate || "",
          p.maxUses || "",
          p.uses || 0,
          p.isActive ? "yes" : "no",
          p.createdAt || ""
        ].join(","));
      }
      
      cb?.({ ok: true, csv: rows.join("\n"), filename: `promo_usage_${new Date().toISOString().split('T')[0]}.csv` });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("disconnect", () => {
    if (!IS_PRODUCTION) {
      console.log(`[Socket] Disconnected: ${socket.user?.role}`);
    }
  });
});

function generateReceiptPreview(order, settings) {
  const lines = [];
  const currency = settings?.currency || "AED";
  
  lines.push("=".repeat(40));
  lines.push("SIAM SMILE".center(40));
  lines.push("=".repeat(40));
  lines.push("");
  lines.push(`Order #${order.id.slice(0, 8).toUpperCase()}`);
  lines.push(`Date: ${new Date(order.createdAt).toLocaleString()}`);
  lines.push(`Staff: ${order.createdByUsername || "Staff"}`);
  lines.push("-".repeat(40));
  lines.push("");
  
  for (const item of order.items || []) {
    const lineTotal = (item.price * item.qty).toFixed(2);
    lines.push(`${item.name.padEnd(24)} ${lineTotal.padStart(6)} ${currency}`);
    lines.push(`  ${item.qty} x ${item.price.toFixed(2)}`);
  }
  
  lines.push("");
  lines.push("-".repeat(40));
  lines.push(`Subtotal: ${order.subtotal?.toFixed(2).padStart(8)} ${currency}`);
  
  if (order.discount) {
    lines.push(`Discount: -${order.discount.toFixed(2).padStart(7)} ${currency}`);
  }
  
  const tax = (order.subtotal * (settings?.taxPercent || 0)) / 100;
  const service = (order.subtotal * (settings?.serviceChargePercent || 0)) / 100;
  
  if (tax > 0) {
    lines.push(`Tax (${settings.taxPercent}%): ${tax.toFixed(2).padStart(8)} ${currency}`);
  }
  if (service > 0) {
    lines.push(`Service (${settings.serviceChargePercent}%): ${service.toFixed(2).padStart(4)} ${currency}`);
  }
  
  lines.push("=".repeat(40));
  lines.push(`TOTAL: ${order.total?.toFixed(2).padStart(12)} ${currency}`);
  lines.push("=".repeat(40));
  lines.push("");
  lines.push("Thank you for your business!");
  lines.push("");
  
  return lines.join("\n");
}

// String padding helpers
String.prototype.padEnd = function(len, char = " ") {
  return this + char.repeat(Math.max(0, len - this.length));
};
String.prototype.padStart = function(len, char = " ") {
  const pad = char.repeat(Math.max(0, len - this.length));
  return pad + this;
};
String.prototype.center = function(len, char = " ") {
  const pad = len - this.length;
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return char.repeat(left) + this + char.repeat(right);
};

const HOST = process.env.HOST || "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`=================================`);
  console.log(`Siam Smile POS v1.0.0`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Listening on ${HOST}:${PORT}`);
  console.log(`=================================`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
