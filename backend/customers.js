/**
 * Customer Management Module for Siam Smile POS
 * Manages customer records linked to orders with analytics and export capabilities
 */

const { newId } = require("./utils");
const { assert, requireString } = require("./validators");

/**
 * Customer Schema:
 * {
 *   id: string,
 *   name: string,
 *   phone: string (optional),
 *   email: string (optional),
 *   tableNumber: string,
 *   marketingOptIn: boolean,
 *   firstOrderDate: string,
 *   lastOrderDate: string,
 *   totalOrders: number,
 *   totalSpent: number,
 *   createdAt: string
 * }
 */

// Ensure customers array exists in state
function ensureCustomersArray(state) {
  if (!state.customers) {
    state.customers = [];
  }
  return state.customers;
}

/**
 * Create or update a customer from order data
 * @param {Object} orderData - Order data containing customer information
 * @param {Object} state - Application state
 * @returns {string} Customer ID
 */
function createOrUpdateCustomer(orderData, state) {
  const customers = ensureCustomersArray(state);
  const {
    customerName,
    customerPhone,
    customerEmail,
    tableNumber,
    marketingOptIn,
    id: orderId,
    total: orderTotal,
    createdAt: orderDate,
  } = orderData || {};

  // Customer name is required
  if (!customerName || typeof customerName !== "string" || customerName.trim().length === 0) {
    return null;
  }

  const normalizedPhone = customerPhone ? String(customerPhone).trim() : null;
  const normalizedEmail = customerEmail ? String(customerEmail).trim().toLowerCase() : null;

  // Try to find existing customer by phone or email
  let customer = null;
  
  if (normalizedPhone) {
    customer = customers.find(c => c.phone === normalizedPhone);
  }
  
  if (!customer && normalizedEmail) {
    customer = customers.find(c => c.email === normalizedEmail);
  }

  const now = new Date().toISOString();
  const orderTotalNum = typeof orderTotal === "number" ? orderTotal : 0;

  if (customer) {
    // Update existing customer
    customer.name = customerName.trim();
    if (normalizedPhone) customer.phone = normalizedPhone;
    if (normalizedEmail) customer.email = normalizedEmail;
    if (tableNumber !== undefined) customer.tableNumber = String(tableNumber);
    if (marketingOptIn !== undefined) customer.marketingOptIn = !!marketingOptIn;
    
    customer.lastOrderDate = orderDate || now;
    customer.totalOrders += 1;
    customer.totalSpent += orderTotalNum;
    
    return customer.id;
  } else {
    // Create new customer
    const newCustomer = {
      id: newId(),
      name: customerName.trim(),
      phone: normalizedPhone || null,
      email: normalizedEmail || null,
      tableNumber: tableNumber ? String(tableNumber) : "",
      marketingOptIn: marketingOptIn !== undefined ? !!marketingOptIn : false,
      firstOrderDate: orderDate || now,
      lastOrderDate: orderDate || now,
      totalOrders: 1,
      totalSpent: orderTotalNum,
      createdAt: now,
    };
    
    customers.push(newCustomer);
    return newCustomer.id;
  }
}

/**
 * Get a customer by ID
 * @param {string} id - Customer ID
 * @param {Object} state - Application state
 * @returns {Object|null} Customer object or null if not found
 */
function getCustomerById(id, state) {
  assert(typeof id === "string" && id.length > 0, "Customer ID is required");
  const customers = ensureCustomersArray(state);
  const customer = customers.find(c => c.id === id);
  return customer || null;
}

/**
 * Search customers by name, phone, email, or table number
 * Supports partial matching and case-insensitive search
 * @param {string} query - Search query
 * @param {Object} state - Application state
 * @returns {Array} Array of matching customers
 */
function searchCustomers(query, state) {
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return [];
  }

  const customers = ensureCustomersArray(state);
  const searchTerm = query.trim().toLowerCase();

  return customers.filter(customer => {
    const nameMatch = customer.name && customer.name.toLowerCase().includes(searchTerm);
    const phoneMatch = customer.phone && customer.phone.toLowerCase().includes(searchTerm);
    const emailMatch = customer.email && customer.email.toLowerCase().includes(searchTerm);
    const tableMatch = customer.tableNumber && customer.tableNumber.toLowerCase().includes(searchTerm);
    
    return nameMatch || phoneMatch || emailMatch || tableMatch;
  });
}

/**
 * Get all orders for a specific customer
 * @param {string} customerId - Customer ID
 * @param {Object} state - Application state
 * @returns {Array} Array of orders for the customer
 */
function getCustomerOrders(customerId, state) {
  assert(typeof customerId === "string" && customerId.length > 0, "Customer ID is required");
  
  const customer = getCustomerById(customerId, state);
  if (!customer) {
    return [];
  }

  // Match orders by customer contact info
  const orders = state.orders || [];
  return orders.filter(order => {
    // Check if order has customerId reference (newer orders)
    if (order.customerId === customerId) {
      return true;
    }
    
    // Fallback: match by phone or email for legacy orders
    const phoneMatch = customer.phone && order.customerPhone === customer.phone;
    const emailMatch = customer.email && order.customerEmail === customer.email;
    const nameMatch = customer.name && order.customerName === customer.name;
    
    return phoneMatch || emailMatch || nameMatch;
  });
}

/**
 * Get customers who opted into marketing
 * @param {Object} state - Application state
 * @returns {Array} Array of opted-in customers
 */
function getOptedInCustomers(state) {
  const customers = ensureCustomersArray(state);
  return customers.filter(c => c.marketingOptIn === true);
}

/**
 * Escape CSV field to handle commas, quotes, and newlines
 * @param {string} field - Field value
 * @returns {string} Escaped CSV field
 */
function escapeCsvField(field) {
  if (field === null || field === undefined) {
    return "";
  }
  const str = String(field);
  // Escape quotes by doubling them and wrap in quotes if contains special chars
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert customers array to CSV format
 * @param {Array} customers - Array of customer objects
 * @returns {string} CSV formatted string
 */
function exportCustomersToCSV(customers) {
  if (!Array.isArray(customers)) {
    throw new Error("Customers must be an array");
  }

  const headers = [
    "Name",
    "Phone",
    "Email",
    "Table",
    "Total Orders",
    "Total Spent",
    "Marketing Opt-In",
    "First Order",
    "Last Order",
  ];

  const rows = [headers.join(",")];

  for (const customer of customers) {
    const row = [
      escapeCsvField(customer.name),
      escapeCsvField(customer.phone),
      escapeCsvField(customer.email),
      escapeCsvField(customer.tableNumber),
      escapeCsvField(customer.totalOrders),
      escapeCsvField(customer.totalSpent?.toFixed(2) || "0.00"),
      escapeCsvField(customer.marketingOptIn ? "Yes" : "No"),
      escapeCsvField(customer.firstOrderDate),
      escapeCsvField(customer.lastOrderDate),
    ];
    rows.push(row.join(","));
  }

  return rows.join("\n");
}

/**
 * Calculate customer analytics metrics
 * @param {Object} state - Application state
 * @returns {Object} Customer metrics object
 */
function getCustomerMetrics(state) {
  const customers = ensureCustomersArray(state);
  const orders = state.orders || [];

  const totalCustomers = customers.length;
  
  if (totalCustomers === 0) {
    return {
      totalCustomers: 0,
      newCustomers: 0,
      returningCustomers: 0,
      newVsReturningRatio: { new: 0, returning: 0 },
      optInRate: 0,
      optedInCount: 0,
      averageOrderValuePerCustomer: 0,
      totalRevenueFromCustomers: 0,
      averageOrdersPerCustomer: 0,
      topCustomers: [],
    };
  }

  // New vs Returning customers (based on totalOrders)
  const newCustomers = customers.filter(c => c.totalOrders === 1).length;
  const returningCustomers = customers.filter(c => c.totalOrders > 1).length;

  // Opt-in rate
  const optedInCount = customers.filter(c => c.marketingOptIn === true).length;
  const optInRate = Math.round((optedInCount / totalCustomers) * 1000) / 10; // One decimal place

  // Average order value per customer
  const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  const totalOrderCount = customers.reduce((sum, c) => sum + (c.totalOrders || 0), 0);
  const averageOrderValuePerCustomer = totalOrderCount > 0 
    ? Math.round((totalRevenue / totalOrderCount) * 100) / 100
    : 0;

  // Average orders per customer
  const averageOrdersPerCustomer = Math.round((totalOrderCount / totalCustomers) * 100) / 100;

  // Top customers by total spent
  const topCustomers = [...customers]
    .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
    .slice(0, 10)
    .map(c => ({
      id: c.id,
      name: c.name,
      totalSpent: c.totalSpent || 0,
      totalOrders: c.totalOrders || 0,
      lastOrderDate: c.lastOrderDate,
    }));

  return {
    totalCustomers,
    newCustomers,
    returningCustomers,
    newVsReturningRatio: {
      new: newCustomers,
      returning: returningCustomers,
    },
    optInRate,
    optedInCount,
    averageOrderValuePerCustomer,
    totalRevenueFromCustomers: totalRevenue,
    averageOrdersPerCustomer,
    topCustomers,
  };
}

/**
 * Get full order history for a customer with details
 * @param {string} customerId - Customer ID
 * @param {Object} state - Application state
 * @returns {Object} Customer with order history
 */
function getCustomerOrderHistory(customerId, state) {
  assert(typeof customerId === "string" && customerId.length > 0, "Customer ID is required");

  const customer = getCustomerById(customerId, state);
  if (!customer) {
    return null;
  }

  const orders = getCustomerOrders(customerId, state);
  
  // Sort orders by date (newest first)
  const sortedOrders = orders.sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Calculate additional metrics
  const orderHistory = sortedOrders.map(order => ({
    orderId: order.id,
    createdAt: order.createdAt,
    status: order.status,
    total: order.total || 0,
    subtotal: order.subtotal || 0,
    discount: order.discount || 0,
    itemCount: (order.items || []).reduce((sum, item) => sum + (item.qty || 0), 0),
    tableNumber: order.tableNumber || customer.tableNumber,
  }));

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      tableNumber: customer.tableNumber,
      marketingOptIn: customer.marketingOptIn,
      firstOrderDate: customer.firstOrderDate,
      lastOrderDate: customer.lastOrderDate,
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
      createdAt: customer.createdAt,
    },
    orders: orderHistory,
    summary: {
      totalOrders: orderHistory.length,
      totalSpent: orderHistory.reduce((sum, o) => sum + o.total, 0),
      averageOrderValue: orderHistory.length > 0
        ? Math.round((orderHistory.reduce((sum, o) => sum + o.total, 0) / orderHistory.length) * 100) / 100
        : 0,
      favoriteTable: getMostFrequent(orderHistory.map(o => o.tableNumber).filter(Boolean)),
    },
  };
}

/**
 * Helper function to get the most frequent value in an array
 * @param {Array} arr - Array of values
 * @returns {*} Most frequent value or null
 */
function getMostFrequent(arr) {
  if (!arr || arr.length === 0) return null;
  
  const counts = {};
  let maxCount = 0;
  let maxValue = null;

  for (const value of arr) {
    counts[value] = (counts[value] || 0) + 1;
    if (counts[value] > maxCount) {
      maxCount = counts[value];
      maxValue = value;
    }
  }

  return maxValue;
}

/**
 * Associate an existing order with a customer (for migration/updates)
 * @param {string} orderId - Order ID
 * @param {string} customerId - Customer ID
 * @param {Object} state - Application state
 * @returns {boolean} True if successful
 */
function associateOrderWithCustomer(orderId, customerId, state) {
  assert(typeof orderId === "string" && orderId.length > 0, "Order ID is required");
  assert(typeof customerId === "string" && customerId.length > 0, "Customer ID is required");

  const customer = getCustomerById(customerId, state);
  assert(customer, "Customer not found");

  const orders = state.orders || [];
  const order = orders.find(o => o.id === orderId);
  assert(order, "Order not found");

  // Update order with customer reference
  order.customerId = customerId;
  order.customerName = customer.name;
  order.customerPhone = customer.phone;
  order.customerEmail = customer.email;

  return true;
}

/**
 * Delete a customer (soft delete - removes from array)
 * @param {string} id - Customer ID
 * @param {Object} state - Application state
 * @returns {boolean} True if deleted
 */
function deleteCustomer(id, state) {
  assert(typeof id === "string" && id.length > 0, "Customer ID is required");
  
  const customers = ensureCustomersArray(state);
  const initialLength = customers.length;
  
  state.customers = customers.filter(c => c.id !== id);
  
  return state.customers.length < initialLength;
}

/**
 * Update customer marketing opt-in status
 * @param {string} id - Customer ID
 * @param {boolean} optIn - Opt-in status
 * @param {Object} state - Application state
 * @returns {Object} Updated customer
 */
function updateCustomerMarketingOptIn(id, optIn, state) {
  assert(typeof id === "string" && id.length > 0, "Customer ID is required");
  
  const customer = getCustomerById(id, state);
  assert(customer, "Customer not found");
  
  customer.marketingOptIn = !!optIn;
  
  return customer;
}

/**
 * Get all customers (with optional limit)
 * @param {Object} state - Application state
 * @param {number} limit - Maximum number of customers to return
 * @param {number} offset - Number of customers to skip
 * @returns {Array} Array of customers
 */
function getAllCustomers(state, limit = null, offset = 0) {
  const customers = ensureCustomersArray(state);
  
  // Sort by last order date (most recent first)
  const sorted = [...customers].sort((a, b) => {
    return new Date(b.lastOrderDate || b.createdAt) - new Date(a.lastOrderDate || a.createdAt);
  });
  
  if (limit === null) {
    return sorted.slice(offset);
  }
  
  return sorted.slice(offset, offset + limit);
}

module.exports = {
  // Core functions
  createOrUpdateCustomer,
  getCustomerById,
  searchCustomers,
  getCustomerOrders,
  getOptedInCustomers,
  exportCustomersToCSV,
  getCustomerMetrics,
  getCustomerOrderHistory,
  
  // Additional utility functions
  associateOrderWithCustomer,
  deleteCustomer,
  updateCustomerMarketingOptIn,
  getAllCustomers,
  
  // Helper for state management
  ensureCustomersArray,
};
