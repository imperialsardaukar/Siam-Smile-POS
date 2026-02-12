/**
 * Inventory Management Module for Siam Smile POS
 * Handles inventory items, stock tracking, supplier management, and analytics
 */

const { newId } = require("./utils");
const { assert, requireString, requireNumber } = require("./validators");

// ============================================================================
// Inventory Item CRUD Operations
// ============================================================================

/**
 * Safely convert a value to a number
 * Handles strings, numbers, null, undefined
 * @param {*} v - Value to convert
 * @param {number} defaultValue - Default if conversion fails
 * @returns {number}
 */
function toNumber(v, defaultValue = 0) {
  if (v === null || v === undefined || v === "") return defaultValue;
  const n = typeof v === "number" ? v : Number(v);
  return isNaN(n) ? defaultValue : n;
}

/**
 * Create a new inventory item
 * @param {Object} data - Item data
 * @param {Object} state - Application state
 * @param {Object} user - User making the change
 * @returns {Object} Created item
 */
function createInventoryItem(data, state, user) {
  // Validate required fields
  requireString(data.name, "name");
  requireString(data.sku, "sku");
  // Category is optional - removed requireString validation
  
  // Validate SKU uniqueness
  const existingItem = (state.inventory || []).find(item => 
    item.sku.toLowerCase() === data.sku.toLowerCase()
  );
  assert(!existingItem, `SKU "${data.sku}" already exists`);
  
  // Validate quantity
  const quantity = toNumber(data.quantity, 0);
  assert(quantity >= 0, "Quantity must be non-negative");
  
  // Validate prices - accept both strings and numbers
  const costPrice = toNumber(data.costPrice, 0);
  const sellingPrice = toNumber(data.sellingPrice, 0);
  assert(costPrice >= 0, "Cost price must be a non-negative number");
  assert(sellingPrice >= 0, "Selling price must be a non-negative number");
  
  const now = new Date().toISOString();
  
  const item = {
    id: newId(),
    name: data.name.trim(),
    sku: data.sku.trim().toUpperCase(),
    category: (data.category || "").trim(),
    supplier: (data.supplier || "").trim(),
    supplierContact: (data.supplierContact || "").trim(),
    quantity: quantity,
    minThreshold: Math.max(0, toNumber(data.minThreshold, 0)),
    costPrice: costPrice,
    sellingPrice: sellingPrice,
    deliveryDate: data.deliveryDate || now.split('T')[0],
    deliveryTime: data.deliveryTime || "",
    expiryDate: data.expiryDate || null,
    batchNumber: (data.batchNumber || "").trim(),
    notes: (data.notes || "").trim(),
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
  
  // Initialize inventory array if not exists
  if (!state.inventory) {
    state.inventory = [];
  }
  
  state.inventory.push(item);
  
  // Log creation
  logInventoryChange(item.id, "created", null, { name: item.name, sku: item.sku }, user, state);
  
  return item;
}

/**
 * Update an existing inventory item
 * @param {string} id - Item ID
 * @param {Object} updates - Fields to update
 * @param {Object} state - Application state
 * @param {Object} user - User making the change
 * @returns {Object} Updated item
 */
function updateInventoryItem(id, updates, state, user) {
  requireString(id, "id");
  
  if (!state.inventory) {
    state.inventory = [];
  }
  
  const itemIndex = state.inventory.findIndex(item => item.id === id);
  assert(itemIndex !== -1, "Inventory item not found");
  
  const item = state.inventory[itemIndex];
  const oldValues = {};
  
  // Fields that can be updated
  const updatableFields = [
    "name", "sku", "category", "supplier", "supplierContact",
    "quantity", "minThreshold", "costPrice", "sellingPrice",
    "deliveryDate", "deliveryTime", "expiryDate", "batchNumber", "notes"
  ];
  
  for (const field of updatableFields) {
    if (updates[field] !== undefined) {
      oldValues[field] = item[field];
      
      // Validation for specific fields
      if (field === "name") {
        requireString(updates[field], "name");
        item[field] = updates[field].trim();
      } else if (field === "sku") {
        requireString(updates[field], "sku");
        const newSku = updates[field].trim().toUpperCase();
        // Check SKU uniqueness (excluding current item)
        const duplicate = state.inventory.find(i => 
          i.id !== id && i.sku.toLowerCase() === newSku.toLowerCase()
        );
        assert(!duplicate, `SKU "${newSku}" already exists`);
        item[field] = newSku;
      } else if (field === "quantity") {
        const newQty = toNumber(updates[field], 0);
        assert(newQty >= 0, "Quantity must be non-negative");
        item[field] = newQty;
      } else if (field === "costPrice" || field === "sellingPrice") {
        const newPrice = toNumber(updates[field], 0);
        assert(newPrice >= 0, `${field} must be a non-negative number`);
        item[field] = newPrice;
      } else if (field === "minThreshold") {
        item[field] = Math.max(0, toNumber(updates[field], 0));
      } else if (field === "expiryDate") {
        item[field] = updates[field] || null;
      } else {
        item[field] = typeof updates[field] === "string" 
          ? updates[field].trim() 
          : updates[field];
      }
      
      // Log the change
      if (oldValues[field] !== item[field]) {
        logInventoryChange(id, field, oldValues[field], item[field], user, state);
      }
    }
  }
  
  item.updatedAt = new Date().toISOString();
  return item;
}

/**
 * Delete an inventory item
 * @param {string} id - Item ID
 * @param {Object} state - Application state
 */
function deleteInventoryItem(id, state) {
  requireString(id, "id");
  
  if (!state.inventory) {
    state.inventory = [];
  }
  
  const itemIndex = state.inventory.findIndex(item => item.id === id);
  assert(itemIndex !== -1, "Inventory item not found");
  
  state.inventory.splice(itemIndex, 1);
  
  // Also remove logs for this item
  if (state.inventoryLogs) {
    state.inventoryLogs = state.inventoryLogs.filter(log => log.itemId !== id);
  }
}

/**
 * Archive/unarchive an inventory item
 * @param {string} id - Item ID
 * @param {Object} state - Application state
 * @param {Object} user - User making the change
 * @returns {Object} Updated item
 */
function archiveInventoryItem(id, state, user) {
  requireString(id, "id");
  
  if (!state.inventory) {
    state.inventory = [];
  }
  
  const item = state.inventory.find(item => item.id === id);
  assert(item, "Inventory item not found");
  
  const oldValue = item.isArchived;
  item.isArchived = !item.isArchived;
  item.updatedAt = new Date().toISOString();
  
  // Log the change
  logInventoryChange(id, "isArchived", oldValue, item.isArchived, user, state);
  
  return item;
}

// ============================================================================
// Search & Query Functions
// ============================================================================

/**
 * Get a single inventory item by ID
 * @param {string} id - Item ID
 * @param {Object} state - Application state
 * @returns {Object|null}
 */
function getInventoryItem(id, state) {
  if (!state.inventory) return null;
  return state.inventory.find(item => item.id === id) || null;
}

/**
 * Search inventory items
 * @param {string} query - Search query
 * @param {Object} state - Application state
 * @param {Object} options - Search options
 * @returns {Array}
 */
function searchInventory(query, state, options = {}) {
  if (!state.inventory) return [];
  
  const { includeArchived = false } = options;
  const searchStr = (query || "").toLowerCase().trim();
  
  return state.inventory.filter(item => {
    // Filter out archived items unless requested
    if (!includeArchived && item.isArchived) return false;
    
    // If no search string, include all
    if (!searchStr) return true;
    
    // Search in multiple fields
    return (
      item.name?.toLowerCase().includes(searchStr) ||
      item.sku?.toLowerCase().includes(searchStr) ||
      item.category?.toLowerCase().includes(searchStr) ||
      item.supplier?.toLowerCase().includes(searchStr)
    );
  });
}

/**
 * Get low stock items (at or below threshold but > 0)
 * @param {Object} state - Application state
 * @returns {Array}
 */
function getLowStockItems(state) {
  if (!state.inventory) return [];
  return state.inventory.filter(item => 
    !item.isArchived &&
    item.quantity > 0 && 
    item.quantity <= item.minThreshold
  );
}

/**
 * Get out of stock items (quantity = 0)
 * @param {Object} state - Application state
 * @returns {Array}
 */
function getOutOfStockItems(state) {
  if (!state.inventory) return [];
  return state.inventory.filter(item => 
    !item.isArchived &&
    item.quantity === 0
  );
}

// ============================================================================
// Logging
// ============================================================================

/**
 * Log an inventory change
 * @param {string} itemId - Item ID
 * @param {string} field - Field that changed
 * @param {*} oldValue - Old value
 * @param {*} newValue - New value
 * @param {Object} user - User who made the change
 * @param {Object} state - Application state
 */
function logInventoryChange(itemId, field, oldValue, newValue, user, state) {
  if (!state.inventoryLogs) {
    state.inventoryLogs = [];
  }
  
  const log = {
    id: newId(),
    itemId,
    field,
    oldValue,
    newValue,
    changedBy: user?.username || user?.role || "system",
    changedAt: new Date().toISOString(),
  };
  
  state.inventoryLogs.unshift(log);
  
  // Keep only last 1000 logs
  if (state.inventoryLogs.length > 1000) {
    state.inventoryLogs = state.inventoryLogs.slice(0, 1000);
  }
}

/**
 * Get logs for a specific inventory item
 * @param {string} itemId - Item ID
 * @param {Object} state - Application state
 * @returns {Array}
 */
function getInventoryLogs(itemId, state) {
  if (!state.inventoryLogs) return [];
  if (!itemId) return state.inventoryLogs.slice(0, 100);
  return state.inventoryLogs.filter(log => log.itemId === itemId).slice(0, 100);
}

// ============================================================================
// Metrics & Analytics
// ============================================================================

/**
 * Get comprehensive inventory metrics
 * @param {Object} state - Application state
 * @returns {Object}
 */
function getInventoryMetrics(state) {
  const inventory = state.inventory || [];
  const activeItems = inventory.filter(item => !item.isArchived);
  
  const totalItems = activeItems.length;
  const lowStock = getLowStockItems(state).length;
  const outOfStock = getOutOfStockItems(state).length;
  
  // Calculate total values
  const totalCostValue = activeItems.reduce((sum, item) => 
    sum + (item.quantity * item.costPrice), 0
  );
  const totalRetailValue = activeItems.reduce((sum, item) => 
    sum + (item.quantity * item.sellingPrice), 0
  );
  const potentialProfit = totalRetailValue - totalCostValue;
  
  // Category breakdown
  const categories = {};
  activeItems.forEach(item => {
    const cat = item.category || "Uncategorized";
    if (!categories[cat]) {
      categories[cat] = { count: 0, value: 0 };
    }
    categories[cat].count++;
    categories[cat].value += item.quantity * item.costPrice;
  });
  
  return {
    counts: {
      total: totalItems,
      lowStock,
      outOfStock,
      archived: inventory.filter(item => item.isArchived).length,
    },
    values: {
      cost: totalCostValue,
      retail: totalRetailValue,
      profit: potentialProfit,
    },
    categories,
  };
}

/**
 * Calculate total inventory value (cost basis)
 * @param {Object} state - Application state
 * @returns {number}
 */
function calculateInventoryValue(state) {
  if (!state.inventory) return 0;
  return state.inventory
    .filter(item => !item.isArchived)
    .reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);
}

/**
 * Calculate total retail value
 * @param {Object} state - Application state
 * @returns {number}
 */
function calculateRetailValue(state) {
  if (!state.inventory) return 0;
  return state.inventory
    .filter(item => !item.isArchived)
    .reduce((sum, item) => sum + (item.quantity * item.sellingPrice), 0);
}

/**
 * Calculate overall profit margin
 * @param {Object} state - Application state
 * @returns {number}
 */
function calculateProfitMargin(state) {
  const cost = calculateInventoryValue(state);
  const retail = calculateRetailValue(state);
  if (cost === 0) return 0;
  return ((retail - cost) / cost) * 100;
}

// ============================================================================
// Supplier Analytics
// ============================================================================

/**
 * Get breakdown by supplier
 * @param {Object} state - Application state
 * @returns {Object}
 */
function getSupplierBreakdown(state) {
  if (!state.inventory) return {};
  
  const breakdown = {};
  
  state.inventory
    .filter(item => !item.isArchived)
    .forEach(item => {
      const supplier = item.supplier || "Unknown";
      if (!breakdown[supplier]) {
        breakdown[supplier] = {
          itemCount: 0,
          totalQuantity: 0,
          totalValue: 0,
        };
      }
      breakdown[supplier].itemCount++;
      breakdown[supplier].totalQuantity += item.quantity;
      breakdown[supplier].totalValue += item.quantity * item.costPrice;
    });
  
  return breakdown;
}

// ============================================================================
// Export
// ============================================================================

module.exports = {
  // CRUD Operations
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  archiveInventoryItem,
  getInventoryItem,
  
  // Search & Query
  searchInventory,
  getLowStockItems,
  getOutOfStockItems,
  
  // Logging
  logInventoryChange,
  getInventoryLogs,
  
  // Metrics
  getInventoryMetrics,
  calculateInventoryValue,
  calculateRetailValue,
  calculateProfitMargin,
  getSupplierBreakdown,
};
