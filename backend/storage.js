const fs = require("fs");
const path = require("path");
const { DATA_DIR, DATA_FILE, BACKUP_DIR } = require("./constants");

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function initialState() {
  return {
    version: 1,
    settings: { taxPercent: 0, serviceChargePercent: 0, currency: "AED" },
    categories: [
      { id: "cat-soft", name: "Soft Drinks", sortOrder: 1 },
      { id: "cat-main", name: "Main", sortOrder: 2 },
    ],
    menu: [
      { id: "item-cola", name: "Cola", price: 6, categoryId: "cat-soft", imageUrl: "", isActive: true },
    ],
    staff: [
      // created by admin
    ],
    orders: [],
    revenue: { total: 0, adjustments: [] },
    logs: [],
  };
}

function atomicWrite(filePath, content) {
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, filePath);
}

function backupIfExists() {
  if (!fs.existsSync(DATA_FILE)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `data-${stamp}.json`);
  try {
    fs.copyFileSync(DATA_FILE, backupPath);
  } catch {
    // ignore backup errors
  }
}

function loadState() {
  ensureDirs();
  if (!fs.existsSync(DATA_FILE)) {
    const init = initialState();
    atomicWrite(DATA_FILE, JSON.stringify(init, null, 2));
    return init;
  }
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  const s = JSON.parse(raw);
  // Migration: ensure staff have role (default "both")
  if (s.staff && Array.isArray(s.staff)) {
    s.staff = s.staff.map(st => ({ ...st, role: st.role || "both" }));
  }
  // Migration: ensure menu items have unavailable field (default false)
  if (s.menu && Array.isArray(s.menu)) {
    s.menu = s.menu.map(item => ({ 
      ...item, 
      unavailable: item.unavailable === undefined ? false : item.unavailable,
      description: item.description === undefined ? "" : item.description
    }));
  }
  return s;
}

function saveState(state) {
  ensureDirs();
  backupIfExists();
  atomicWrite(DATA_FILE, JSON.stringify(state, null, 2));
}

module.exports = { loadState, saveState, initialState };
