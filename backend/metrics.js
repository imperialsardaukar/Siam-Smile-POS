/**
 * Advanced Metrics/Analytics Module for Siam Smile POS
 * Provides comprehensive analytics functions for dashboards and reports
 */

// ============================================
// Helper Functions
// ============================================

/**
 * Parse date string or Date object to Date
 */
function parseDate(date) {
  return date instanceof Date ? date : new Date(date);
}

/**
 * Check if a date falls within a range (inclusive)
 */
function isDateInRange(date, startDate, endDate) {
  const d = parseDate(date).getTime();
  const start = startDate ? parseDate(startDate).getTime() : 0;
  const end = endDate ? parseDate(endDate).getTime() : Infinity;
  return d >= start && d <= end;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDateKey(date) {
  return parseDate(date).toISOString().split('T')[0];
}

/**
 * Get ISO week key (YYYY-W##)
 */
function getWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${weekNo}`;
}

/**
 * Get hour from date (0-23)
 */
function getHour(date) {
  return parseDate(date).getHours();
}

/**
 * Calculate prep time in seconds between two dates
 */
function calcPrepTimeSeconds(createdAt, doneAt) {
  if (!createdAt || !doneAt) return null;
  const created = parseDate(createdAt).getTime();
  const done = parseDate(doneAt).getTime();
  return Math.round((done - created) / 1000);
}

/**
 * Group array items by a key function
 */
function groupBy(array, keyFn) {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

/**
 * Calculate statistics (min, max, avg) for an array of numbers
 */
function calcStats(numbers) {
  if (!numbers || numbers.length === 0) {
    return { min: 0, max: 0, avg: 0, count: 0, sum: 0 };
  }
  const valid = numbers.filter(n => n !== null && n !== undefined && !isNaN(n));
  if (valid.length === 0) {
    return { min: 0, max: 0, avg: 0, count: 0, sum: 0 };
  }
  const sum = valid.reduce((a, b) => a + b, 0);
  return {
    min: Math.min(...valid),
    max: Math.max(...valid),
    avg: Math.round((sum / valid.length) * 100) / 100,
    count: valid.length,
    sum: Math.round(sum * 100) / 100
  };
}

/**
 * Format currency value
 */
function formatCurrency(value, currency = 'AED') {
  return {
    value: Math.round(value * 100) / 100,
    formatted: `${Math.round(value * 100) / 100} ${currency}`
  };
}

// ============================================
// Revenue Metrics
// ============================================

/**
 * Get revenue between two dates
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @param {object} state - Application state
 * @returns {object} Revenue data with total, daily breakdown, and order count
 */
function getRevenueByDateRange(startDate, endDate, state) {
  const orders = (state.orders || []).filter(o => 
    o.status === 'done' && isDateInRange(o.createdAt, startDate, endDate)
  );
  
  const daily = {};
  let total = 0;
  
  orders.forEach(order => {
    const dayKey = formatDateKey(order.createdAt);
    const amount = order.total || 0;
    daily[dayKey] = (daily[dayKey] || 0) + amount;
    total += amount;
  });
  
  return {
    total: Math.round(total * 100) / 100,
    orderCount: orders.length,
    daily,
    averageOrderValue: orders.length > 0 ? Math.round((total / orders.length) * 100) / 100 : 0,
    startDate: formatDateKey(startDate),
    endDate: formatDateKey(endDate)
  };
}

/**
 * Get revenue breakdown by staff member
 * @param {object} state - Application state
 * @returns {array} Revenue per staff member
 */
function getRevenueByStaff(state) {
  const orders = (state.orders || []).filter(o => o.status === 'done');
  const byStaff = {};
  
  orders.forEach(order => {
    const staffId = order.createdByStaffId || 'unknown';
    const staffName = order.createdByUsername || 'Unknown';
    
    if (!byStaff[staffId]) {
      byStaff[staffId] = {
        staffId,
        staffName,
        totalRevenue: 0,
        orderCount: 0,
        averageOrderValue: 0
      };
    }
    
    byStaff[staffId].totalRevenue += order.total || 0;
    byStaff[staffId].orderCount++;
  });
  
  // Calculate averages and format
  return Object.values(byStaff).map(s => ({
    ...s,
    totalRevenue: Math.round(s.totalRevenue * 100) / 100,
    averageOrderValue: Math.round((s.totalRevenue / s.orderCount) * 100) / 100
  })).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

/**
 * Get revenue breakdown by menu item
 * @param {object} state - Application state
 * @returns {array} Revenue per menu item
 */
function getRevenueByItem(state) {
  const orders = (state.orders || []).filter(o => o.status === 'done');
  const byItem = {};
  
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      const itemId = item.itemId;
      if (!byItem[itemId]) {
        byItem[itemId] = {
          itemId,
          name: item.name || 'Unknown',
          quantitySold: 0,
          revenue: 0,
          averagePrice: 0
        };
      }
      byItem[itemId].quantitySold += item.qty || 0;
      byItem[itemId].revenue += (item.price || 0) * (item.qty || 0);
    });
  });
  
  return Object.values(byItem).map(item => ({
    ...item,
    revenue: Math.round(item.revenue * 100) / 100,
    averagePrice: item.quantitySold > 0 
      ? Math.round((item.revenue / item.quantitySold) * 100) / 100 
      : 0
  })).sort((a, b) => b.revenue - a.revenue);
}

/**
 * Get revenue breakdown by category
 * @param {object} state - Application state
 * @returns {array} Revenue per category
 */
function getRevenueByCategory(state) {
  const orders = (state.orders || []).filter(o => o.status === 'done');
  const byCategory = {};
  
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      const menuItem = state.menu?.find(m => m.id === item.itemId);
      const categoryId = menuItem?.categoryId || 'uncategorized';
      const category = state.categories?.find(c => c.id === categoryId);
      const categoryName = category?.name || 'Uncategorized';
      
      if (!byCategory[categoryId]) {
        byCategory[categoryId] = {
          categoryId,
          categoryName,
          quantitySold: 0,
          revenue: 0,
          itemCount: new Set()
        };
      }
      
      byCategory[categoryId].quantitySold += item.qty || 0;
      byCategory[categoryId].revenue += (item.price || 0) * (item.qty || 0);
      byCategory[categoryId].itemCount.add(item.itemId);
    });
  });
  
  return Object.values(byCategory).map(cat => ({
    ...cat,
    revenue: Math.round(cat.revenue * 100) / 100,
    uniqueItems: cat.itemCount.size,
    itemCount: undefined // Remove the Set
  })).sort((a, b) => b.revenue - a.revenue);
}

/**
 * Get revenue breakdown by payment method
 * @param {object} state - Application state
 * @returns {object} Revenue by payment method with percentages
 */
function getRevenueByPaymentMethod(state) {
  const receipts = state.receipts || [];
  const byMethod = { cash: 0, card: 0, other: 0 };
  
  receipts.forEach(receipt => {
    const method = receipt.paymentMethod || 'other';
    const amount = receipt.amount || 0;
    if (byMethod[method] !== undefined) {
      byMethod[method] += amount;
    } else {
      byMethod.other += amount;
    }
  });
  
  const total = Object.values(byMethod).reduce((a, b) => a + b, 0);
  
  return {
    breakdown: {
      cash: { amount: Math.round(byMethod.cash * 100) / 100, percentage: total > 0 ? Math.round((byMethod.cash / total) * 10000) / 100 : 0 },
      card: { amount: Math.round(byMethod.card * 100) / 100, percentage: total > 0 ? Math.round((byMethod.card / total) * 10000) / 100 : 0 },
      other: { amount: Math.round(byMethod.other * 100) / 100, percentage: total > 0 ? Math.round((byMethod.other / total) * 10000) / 100 : 0 }
    },
    total: Math.round(total * 100) / 100,
    transactionCount: receipts.length
  };
}

/**
 * Get revenue distribution by hour of day
 * @param {object} state - Application state
 * @returns {array} Revenue and order count per hour
 */
function getHourlyRevenueDistribution(state) {
  const orders = (state.orders || []).filter(o => o.status === 'done');
  const hourly = Array(24).fill(null).map((_, hour) => ({
    hour,
    hourLabel: `${hour.toString().padStart(2, '0')}:00`,
    revenue: 0,
    orderCount: 0,
    averageOrderValue: 0
  }));
  
  orders.forEach(order => {
    const hour = getHour(order.createdAt);
    hourly[hour].revenue += order.total || 0;
    hourly[hour].orderCount++;
  });
  
  return hourly.map(h => ({
    ...h,
    revenue: Math.round(h.revenue * 100) / 100,
    averageOrderValue: h.orderCount > 0 ? Math.round((h.revenue / h.orderCount) * 100) / 100 : 0
  }));
}

// ============================================
// Order Metrics
// ============================================

/**
 * Get average order preparation time
 * @param {object} state - Application state
 * @returns {object} Average prep time in seconds and formatted
 */
function getAveragePrepTime(state) {
  const orders = (state.orders || []).filter(o => o.status === 'done' && o.doneAt);
  
  if (orders.length === 0) {
    return { seconds: 0, formatted: '0m 0s', orderCount: 0 };
  }
  
  const totalSeconds = orders.reduce((sum, order) => {
    const prepTime = calcPrepTimeSeconds(order.createdAt, order.doneAt);
    return sum + (prepTime || 0);
  }, 0);
  
  const avgSeconds = Math.round(totalSeconds / orders.length);
  const minutes = Math.floor(avgSeconds / 60);
  const seconds = avgSeconds % 60;
  
  return {
    seconds: avgSeconds,
    formatted: `${minutes}m ${seconds}s`,
    orderCount: orders.length
  };
}

/**
 * Get detailed preparation time statistics
 * @param {object} state - Application state
 * @returns {object} Min, max, average prep times
 */
function getPrepTimeStats(state) {
  const orders = (state.orders || []).filter(o => o.status === 'done' && o.doneAt);
  
  const prepTimes = orders
    .map(o => calcPrepTimeSeconds(o.createdAt, o.doneAt))
    .filter(t => t !== null);
  
  const stats = calcStats(prepTimes);
  
  return {
    ...stats,
    formatted: {
      min: formatDuration(stats.min),
      max: formatDuration(stats.max),
      avg: formatDuration(stats.avg)
    }
  };
}

/**
 * Format seconds into human-readable duration
 */
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Get orders per hour for a given date range
 * @param {object} state - Application state
 * @returns {array} Order count per hour
 */
function getOrdersPerHour(state) {
  const orders = state.orders || [];
  const hourly = Array(24).fill(0).map((_, hour) => ({
    hour,
    hourLabel: `${hour.toString().padStart(2, '0')}:00`,
    new: 0,
    preparing: 0,
    done: 0,
    total: 0
  }));
  
  orders.forEach(order => {
    const hour = getHour(order.createdAt);
    hourly[hour][order.status]++;
    hourly[hour].total++;
  });
  
  return hourly;
}

/**
 * Get peak hour heatmap data (orders by hour and day)
 * @param {object} state - Application state
 * @param {number} days - Number of days to analyze (default: 7)
 * @returns {object} Heatmap data for visualization
 */
function getPeakHourHeatmap(state, days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  const orders = (state.orders || []).filter(o => 
    parseDate(o.createdAt) >= cutoff
  );
  
  // Initialize heatmap grid (7 days x 24 hours)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const heatmap = dayNames.map((day, dayIndex) => ({
    day,
    dayIndex,
    hours: Array(24).fill(0).map((_, hour) => ({
      hour,
      count: 0,
      intensity: 0
    }))
  }));
  
  orders.forEach(order => {
    const d = parseDate(order.createdAt);
    const dayIndex = d.getDay();
    const hour = d.getHours();
    heatmap[dayIndex].hours[hour].count++;
  });
  
  // Calculate intensity (0-1 scale) for each cell
  const maxCount = Math.max(...heatmap.flatMap(d => d.hours.map(h => h.count)));
  
  heatmap.forEach(day => {
    day.hours.forEach(h => {
      h.intensity = maxCount > 0 ? Math.round((h.count / maxCount) * 100) / 100 : 0;
    });
  });
  
  return {
    days: heatmap,
    maxCount,
    totalOrders: orders.length,
    peakHour: maxCount > 0 ? findPeakHour(heatmap) : null
  };
}

function findPeakHour(heatmap) {
  let maxCount = 0;
  let peak = null;
  
  heatmap.forEach(day => {
    day.hours.forEach(h => {
      if (h.count > maxCount) {
        maxCount = h.count;
        peak = { day: day.day, hour: h.hour, count: h.count };
      }
    });
  });
  
  return peak;
}

/**
 * Get order status breakdown counts
 * @param {object} state - Application state
 * @returns {object} Counts and percentages for each status
 */
function getOrderStatusBreakdown(state) {
  const orders = state.orders || [];
  const counts = { new: 0, preparing: 0, done: 0 };
  
  orders.forEach(order => {
    if (counts[order.status] !== undefined) {
      counts[order.status]++;
    }
  });
  
  const total = orders.length;
  
  return {
    counts,
    percentages: {
      new: total > 0 ? Math.round((counts.new / total) * 10000) / 100 : 0,
      preparing: total > 0 ? Math.round((counts.preparing / total) * 10000) / 100 : 0,
      done: total > 0 ? Math.round((counts.done / total) * 10000) / 100 : 0
    },
    total
  };
}

// ============================================
// Customer Metrics
// ============================================

/**
 * Get new vs returning customers analysis
 * Note: Uses phone/identifier from order note or generates unique identifier
 * @param {object} state - Application state
 * @returns {object} New vs returning customer stats
 */
function getNewVsReturningCustomers(state) {
  const orders = (state.orders || []).filter(o => o.status === 'done');
  const customerVisits = new Map();
  
  orders.forEach(order => {
    // Use a customer identifier - here we use note as a simple identifier
    // In production, this would use phone number or customer ID
    const customerId = extractCustomerId(order);
    
    if (!customerVisits.has(customerId)) {
      customerVisits.set(customerId, []);
    }
    customerVisits.get(customerId).push(order.createdAt);
  });
  
  let newCustomers = 0;
  let returningCustomers = 0;
  const visitCounts = [];
  
  customerVisits.forEach((visits, customerId) => {
    visitCounts.push({ customerId, visitCount: visits.length });
    if (visits.length === 1) {
      newCustomers++;
    } else {
      returningCustomers++;
    }
  });
  
  const total = newCustomers + returningCustomers;
  
  return {
    newCustomers,
    returningCustomers,
    totalUniqueCustomers: total,
    newCustomerRate: total > 0 ? Math.round((newCustomers / total) * 10000) / 100 : 0,
    returningCustomerRate: total > 0 ? Math.round((returningCustomers / total) * 10000) / 100 : 0,
    topCustomers: visitCounts
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 10)
  };
}

/**
 * Extract a customer identifier from an order
 * In production, this would use phone number from customer data
 */
function extractCustomerId(order) {
  // Try to extract phone/email from note, otherwise use a hash of order details
  const note = order.note || '';
  const phoneMatch = note.match(/\b\d{7,}\b/); // Simple phone number match
  if (phoneMatch) return `phone:${phoneMatch[0]}`;
  
  // Fallback: use staff + time-based grouping (orders within 5 minutes by same staff)
  const date = parseDate(order.createdAt);
  const timeBlock = Math.floor(date.getTime() / (5 * 60 * 1000));
  return `anon:${order.createdByStaffId || 'unknown'}:${timeBlock}`;
}

/**
 * Get Customer Lifetime Value calculations
 * @param {object} state - Application state
 * @returns {object} CLV statistics
 */
function getCustomerLifetimeValue(state) {
  const orders = (state.orders || []).filter(o => o.status === 'done');
  const customerSpending = new Map();
  
  orders.forEach(order => {
    const customerId = extractCustomerId(order);
    
    if (!customerSpending.has(customerId)) {
      customerSpending.set(customerId, { totalSpent: 0, orders: 0, firstOrder: order.createdAt, lastOrder: order.createdAt });
    }
    
    const data = customerSpending.get(customerId);
    data.totalSpent += order.total || 0;
    data.orders++;
    if (order.createdAt < data.firstOrder) data.firstOrder = order.createdAt;
    if (order.createdAt > data.lastOrder) data.lastOrder = order.createdAt;
  });
  
  const clvValues = Array.from(customerSpending.values()).map(c => ({
    ...c,
    averageOrderValue: c.orders > 0 ? Math.round((c.totalSpent / c.orders) * 100) / 100 : 0
  }));
  
  const totalSpending = clvValues.map(c => c.totalSpent);
  const stats = calcStats(totalSpending);
  
  return {
    averageCLV: stats.avg,
    medianCLV: calculateMedian(totalSpending),
    maxCLV: stats.max,
    minCLV: stats.min,
    totalCustomers: clvValues.length,
    topCustomers: clvValues
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10),
    distribution: calculateDistribution(totalSpending, [0, 50, 100, 200, 500, 1000])
  };
}

function calculateMedian(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 
    ? sorted[mid] 
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

function calculateDistribution(values, ranges) {
  const distribution = ranges.map((min, index) => ({
    range: index < ranges.length - 1 ? `${min}-${ranges[index + 1]}` : `${min}+`,
    min,
    max: index < ranges.length - 1 ? ranges[index + 1] : Infinity,
    count: 0,
    percentage: 0
  }));
  
  values.forEach(value => {
    const bucket = distribution.find(d => value >= d.min && (d.max === Infinity || value < d.max));
    if (bucket) bucket.count++;
  });
  
  const total = values.length;
  distribution.forEach(d => {
    d.percentage = total > 0 ? Math.round((d.count / total) * 10000) / 100 : 0;
  });
  
  return distribution;
}

/**
 * Get marketing opt-in rate
 * @param {object} state - Application state
 * @returns {object} Opt-in statistics
 */
function getOptInRate(state) {
  // In a real system, this would check a customer.optIn field
  // For now, we'll estimate based on orders with identifiable info in notes
  const orders = state.orders || [];
  
  let optInCount = 0;
  let totalWithContact = 0;
  
  orders.forEach(order => {
    const note = order.note || '';
    // Consider orders with contact info in note as potential opt-ins
    if (note.match(/\b\d{7,}\b/) || note.includes('@')) {
      totalWithContact++;
      if (!note.includes('no-marketing') && !note.includes('opt-out')) {
        optInCount++;
      }
    }
  });
  
  return {
    optInCount,
    totalWithContact,
    optInRate: totalWithContact > 0 ? Math.round((optInCount / totalWithContact) * 10000) / 100 : 0,
    totalOrders: orders.length
  };
}

/**
 * Get average order value by customer
 * @param {object} state - Application state
 * @returns {array} AOV per customer
 */
function getAverageOrderValueByCustomer(state) {
  const orders = (state.orders || []).filter(o => o.status === 'done');
  const customerData = new Map();
  
  orders.forEach(order => {
    const customerId = extractCustomerId(order);
    
    if (!customerData.has(customerId)) {
      customerData.set(customerId, { totalSpent: 0, orderCount: 0, orders: [] });
    }
    
    const data = customerData.get(customerId);
    data.totalSpent += order.total || 0;
    data.orderCount++;
    data.orders.push(order.id);
  });
  
  return Array.from(customerData.entries())
    .map(([customerId, data]) => ({
      customerId,
      totalSpent: Math.round(data.totalSpent * 100) / 100,
      orderCount: data.orderCount,
      averageOrderValue: Math.round((data.totalSpent / data.orderCount) * 100) / 100
    }))
    .sort((a, b) => b.averageOrderValue - a.averageOrderValue);
}

// ============================================
// Promo Metrics
// ============================================

/**
 * Get most used promo codes
 * @param {object} state - Application state
 * @param {number} limit - Number of top promos to return (default: 10)
 * @returns {array} Top promo codes by usage
 */
function getMostUsedPromos(state, limit = 10) {
  const promos = state.promos || [];
  
  return promos
    .map(promo => ({
      id: promo.id,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      uses: promo.uses || 0,
      maxUses: promo.maxUses,
      usageRate: promo.maxUses ? Math.round((promo.uses / promo.maxUses) * 10000) / 100 : null,
      expiryDate: promo.expiryDate,
      isActive: promo.isActive,
      createdAt: promo.createdAt
    }))
    .sort((a, b) => b.uses - a.uses)
    .slice(0, limit);
}

/**
 * Get total discount impact
 * @param {object} state - Application state
 * @returns {object} Discount statistics
 */
function getDiscountImpact(state) {
  const orders = (state.orders || []).filter(o => o.status === 'done');
  
  let totalDiscount = 0;
  let discountedOrders = 0;
  const byPromo = {};
  
  orders.forEach(order => {
    const discount = order.discount || 0;
    if (discount > 0) {
      totalDiscount += discount;
      discountedOrders++;
      
      if (order.promo?.code) {
        const code = order.promo.code;
        if (!byPromo[code]) {
          byPromo[code] = { code, totalDiscount: 0, orderCount: 0 };
        }
        byPromo[code].totalDiscount += discount;
        byPromo[code].orderCount++;
      }
    }
  });
  
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  
  return {
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    discountedOrders,
    totalOrders,
    discountRate: totalOrders > 0 ? Math.round((discountedOrders / totalOrders) * 10000) / 100 : 0,
    averageDiscount: discountedOrders > 0 ? Math.round((totalDiscount / discountedOrders) * 100) / 100 : 0,
    discountAsPercentOfRevenue: totalRevenue > 0 ? Math.round((totalDiscount / (totalRevenue + totalDiscount)) * 10000) / 100 : 0,
    byPromo: Object.values(byPromo).map(p => ({
      ...p,
      totalDiscount: Math.round(p.totalDiscount * 100) / 100,
      averageDiscount: p.orderCount > 0 ? Math.round((p.totalDiscount / p.orderCount) * 100) / 100 : 0
    })).sort((a, b) => b.totalDiscount - a.totalDiscount)
  };
}

/**
 * Calculate revenue lost to discounts
 * @param {object} state - Application state
 * @returns {object} Revenue impact analysis
 */
function getRevenueLostToDiscounts(state) {
  const orders = (state.orders || []).filter(o => o.status === 'done');
  
  let potentialRevenue = 0;
  let actualRevenue = 0;
  let totalDiscount = 0;
  
  orders.forEach(order => {
    const subtotal = order.subtotal || 0;
    const discount = order.discount || 0;
    const total = order.total || 0;
    
    potentialRevenue += subtotal;
    actualRevenue += total;
    totalDiscount += discount;
  });
  
  return {
    potentialRevenue: Math.round(potentialRevenue * 100) / 100,
    actualRevenue: Math.round(actualRevenue * 100) / 100,
    revenueLost: Math.round(totalDiscount * 100) / 100,
    retentionRate: potentialRevenue > 0 ? Math.round((actualRevenue / potentialRevenue) * 10000) / 100 : 0,
    averageDiscountPerOrder: orders.length > 0 ? Math.round((totalDiscount / orders.length) * 100) / 100 : 0
  };
}

/**
 * Get promo effectiveness analysis
 * @param {object} state - Application state
 * @returns {object} Promo usage vs expiry analysis
 */
function getPromoEffectiveness(state) {
  const promos = state.promos || [];
  const now = new Date();
  
  const analysis = {
    total: promos.length,
    active: 0,
    expired: 0,
    exhausted: 0,
    neverUsed: 0,
    effectiveness: []
  };
  
  promos.forEach(promo => {
    const uses = promo.uses || 0;
    const maxUses = promo.maxUses;
    const expiryDate = promo.expiryDate ? new Date(promo.expiryDate) : null;
    const isExpired = expiryDate && expiryDate < now;
    const isExhausted = maxUses && uses >= maxUses;
    const isActive = promo.isActive && !isExpired && !isExhausted;
    
    if (isActive) analysis.active++;
    if (isExpired) analysis.expired++;
    if (isExhausted) analysis.exhausted++;
    if (uses === 0) analysis.neverUsed++;
    
    analysis.effectiveness.push({
      id: promo.id,
      code: promo.code,
      uses,
      maxUses,
      usageRate: maxUses ? Math.round((uses / maxUses) * 10000) / 100 : null,
      isExpired,
      isExhausted,
      isActive,
      status: isExhausted ? 'exhausted' : isExpired ? 'expired' : isActive ? 'active' : 'inactive'
    });
  });
  
  return analysis;
}

// ============================================
// Inventory Metrics
// ============================================

/**
 * Get total inventory valuation
 * @param {object} state - Application state
 * @returns {object} Inventory value statistics
 */
function getInventoryValue(state) {
  const menu = state.menu || [];
  
  // Since we don't have actual stock counts, we'll estimate based on menu items
  // In a real system, this would use inventory.stock data
  let totalItems = 0;
  let totalValue = 0;
  let activeItems = 0;
  
  menu.forEach(item => {
    // Simulate stock value - in production this would use actual stock counts
    const estimatedStock = 10; // Placeholder
    const itemValue = (item.price || 0) * estimatedStock;
    
    totalItems++;
    totalValue += itemValue;
    if (item.isActive) activeItems++;
  });
  
  return {
    totalItems,
    activeItems,
    inactiveItems: totalItems - activeItems,
    estimatedValue: Math.round(totalValue * 100) / 100,
    averageItemValue: totalItems > 0 ? Math.round((totalValue / totalItems) * 100) / 100 : 0,
    currency: state.settings?.currency || 'AED'
  };
}

/**
 * Get low stock alerts
 * @param {object} state - Application state
 * @param {number} threshold - Stock threshold (default: 5)
 * @returns {array} Items below threshold
 */
function getLowStockAlerts(state, threshold = 5) {
  // In a real system, this would check inventory levels
  // For now, we'll return menu items that haven't been ordered recently
  const menu = state.menu || [];
  const orders = state.orders || [];
  
  // Get last 7 days of orders
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const recentOrders = orders.filter(o => parseDate(o.createdAt) >= weekAgo);
  const itemSales = new Map();
  
  recentOrders.forEach(order => {
    (order.items || []).forEach(item => {
      itemSales.set(item.itemId, (itemSales.get(item.itemId) || 0) + item.qty);
    });
  });
  
  // Items with low or no recent sales
  const lowStock = menu
    .filter(item => {
      const sales = itemSales.get(item.id) || 0;
      return sales < threshold;
    })
    .map(item => ({
      itemId: item.id,
      name: item.name,
      price: item.price,
      recentSales: itemSales.get(item.id) || 0,
      status: (itemSales.get(item.id) || 0) === 0 ? 'no_sales' : 'low_sales'
    }))
    .sort((a, b) => a.recentSales - b.recentSales);
  
  return {
    threshold,
    lowStockItems: lowStock,
    totalLowStock: lowStock.length,
    criticalCount: lowStock.filter(i => i.status === 'no_sales').length
  };
}

/**
 * Get stock movement trends
 * @param {object} state - Application state
 * @param {number} days - Number of days to analyze (default: 30)
 * @returns {object} Stock movement analysis
 */
function getStockMovement(state, days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  const orders = (state.orders || []).filter(o => 
    o.status === 'done' && parseDate(o.createdAt) >= cutoff
  );
  
  const movement = {};
  
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      if (!movement[item.itemId]) {
        const menuItem = state.menu?.find(m => m.id === item.itemId);
        movement[item.itemId] = {
          itemId: item.itemId,
          name: menuItem?.name || item.name || 'Unknown',
          totalSold: 0,
          revenue: 0,
          orderCount: 0
        };
      }
      
      movement[item.itemId].totalSold += item.qty || 0;
      movement[item.itemId].revenue += (item.price || 0) * (item.qty || 0);
      movement[item.itemId].orderCount++;
    });
  });
  
  const items = Object.values(movement).map(m => ({
    ...m,
    revenue: Math.round(m.revenue * 100) / 100,
    averageDailySales: Math.round((m.totalSold / days) * 100) / 100
  })).sort((a, b) => b.totalSold - a.totalSold);
  
  return {
    periodDays: days,
    totalItems: items.length,
    totalUnitsSold: items.reduce((sum, i) => sum + i.totalSold, 0),
    topMoving: items.slice(0, 10),
    slowMoving: items.slice(-10).reverse()
  };
}

/**
 * Get overall profit margins
 * @param {object} state - Application state
 * @returns {object} Profit margin analysis
 */
function getProfitMargins(state) {
  const orders = (state.orders || []).filter(o => o.status === 'done');
  
  let totalRevenue = 0;
  let totalCost = 0;
  const byItem = {};
  
  orders.forEach(order => {
    totalRevenue += order.total || 0;
    
    (order.items || []).forEach(item => {
      // Estimate cost as 30% of price (typical food cost)
      // In production, this would use actual cost data
      const estimatedCost = (item.price || 0) * 0.3;
      const itemRevenue = (item.price || 0) * (item.qty || 0);
      const itemCost = estimatedCost * (item.qty || 0);
      
      totalCost += itemCost;
      
      if (!byItem[item.itemId]) {
        byItem[item.itemId] = {
          itemId: item.itemId,
          name: item.name,
          revenue: 0,
          cost: 0,
          profit: 0,
          quantity: 0
        };
      }
      
      byItem[item.itemId].revenue += itemRevenue;
      byItem[item.itemId].cost += itemCost;
      byItem[item.itemId].profit += (itemRevenue - itemCost);
      byItem[item.itemId].quantity += item.qty || 0;
    });
  });
  
  const totalProfit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0;
  
  const items = Object.values(byItem).map(item => ({
    ...item,
    revenue: Math.round(item.revenue * 100) / 100,
    cost: Math.round(item.cost * 100) / 100,
    profit: Math.round(item.profit * 100) / 100,
    marginPercent: item.revenue > 0 ? Math.round(((item.profit / item.revenue) * 100) * 100) / 100 : 0
  })).sort((a, b) => b.profit - a.profit);
  
  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    overallMargin: parseFloat(margin),
    orderCount: orders.length,
    topProfitable: items.slice(0, 10),
    leastProfitable: items.slice(-10)
  };
}

// ============================================
// Chart Data Helpers
// ============================================

/**
 * Get revenue data formatted for line charts
 * @param {number} days - Number of days to include (default: 30)
 * @param {object} state - Application state
 * @returns {object} Chart-ready data
 */
function getRevenueChartData(days = 30, state) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  
  const orders = (state.orders || []).filter(o => 
    o.status === 'done' && isDateInRange(o.createdAt, startDate, endDate)
  );
  
  // Initialize all days with zero
  const dailyData = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = formatDateKey(d);
    dailyData[key] = { date: key, revenue: 0, orders: 0 };
  }
  
  // Fill with actual data
  orders.forEach(order => {
    const key = formatDateKey(order.createdAt);
    if (dailyData[key]) {
      dailyData[key].revenue += order.total || 0;
      dailyData[key].orders++;
    }
  });
  
  const data = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
  
  return {
    labels: data.map(d => d.date.slice(5)), // MM-DD format
    datasets: [
      {
        label: 'Revenue',
        data: data.map(d => Math.round(d.revenue * 100) / 100),
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        fill: true
      },
      {
        label: 'Orders',
        data: data.map(d => d.orders),
        borderColor: '#2196F3',
        backgroundColor: 'transparent',
        yAxisID: 'y1'
      }
    ],
    summary: {
      totalRevenue: data.reduce((sum, d) => sum + d.revenue, 0),
      totalOrders: data.reduce((sum, d) => sum + d.orders, 0),
      averageDailyRevenue: data.length > 0 ? 
        Math.round((data.reduce((sum, d) => sum + d.revenue, 0) / data.length) * 100) / 100 : 0
    }
  };
}

/**
 * Get category data formatted for pie charts
 * @param {object} state - Application state
 * @returns {object} Chart-ready data
 */
function getCategoryPieData(state) {
  const categoryData = getRevenueByCategory(state);
  const totalRevenue = categoryData.reduce((sum, c) => sum + c.revenue, 0);
  
  const colors = [
    '#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0',
    '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#E91E63'
  ];
  
  return {
    labels: categoryData.map(c => c.categoryName),
    datasets: [{
      data: categoryData.map(c => Math.round(c.revenue * 100) / 100),
      backgroundColor: colors.slice(0, categoryData.length),
      hoverOffset: 4
    }],
    details: categoryData.map((c, index) => ({
      ...c,
      percentage: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 10000) / 100 : 0,
      color: colors[index % colors.length]
    })),
    totalRevenue: Math.round(totalRevenue * 100) / 100
  };
}

/**
 * Get hourly data formatted for bar charts
 * @param {object} state - Application state
 * @returns {object} Chart-ready data
 */
function getHourlyBarData(state) {
  const hourly = getHourlyRevenueDistribution(state);
  
  return {
    labels: hourly.map(h => h.hourLabel),
    datasets: [
      {
        label: 'Revenue',
        data: hourly.map(h => h.revenue),
        backgroundColor: 'rgba(76, 175, 80, 0.7)',
        borderColor: '#4CAF50',
        borderWidth: 1
      },
      {
        label: 'Orders',
        data: hourly.map(h => h.orderCount),
        backgroundColor: 'rgba(33, 150, 243, 0.7)',
        borderColor: '#2196F3',
        borderWidth: 1,
        yAxisID: 'y1'
      }
    ],
    peakHour: hourly.reduce((max, h) => h.revenue > max.revenue ? h : max, hourly[0] || { hour: 0, revenue: 0 }),
    quietHour: hourly.reduce((min, h) => h.revenue < min.revenue ? h : min, hourly[0] || { hour: 0, revenue: 0 })
  };
}

/**
 * Get staff performance data for comparison charts
 * @param {object} state - Application state
 * @returns {object} Chart-ready data
 */
function getStaffPerformanceData(state) {
  const staffData = getRevenueByStaff(state);
  const colors = ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#00BCD4'];
  
  return {
    labels: staffData.map(s => s.staffName),
    datasets: [
      {
        label: 'Total Revenue',
        data: staffData.map(s => s.totalRevenue),
        backgroundColor: colors.slice(0, staffData.length)
      },
      {
        label: 'Orders',
        data: staffData.map(s => s.orderCount),
        backgroundColor: colors.slice(0, staffData.length).map(c => c + '80'),
        yAxisID: 'y1'
      }
    ],
    details: staffData,
    topPerformer: staffData[0] || null
  };
}

// ============================================
// Export all functions
// ============================================

module.exports = {
  // Revenue Metrics
  getRevenueByDateRange,
  getRevenueByStaff,
  getRevenueByItem,
  getRevenueByCategory,
  getRevenueByPaymentMethod,
  getHourlyRevenueDistribution,
  
  // Order Metrics
  getAveragePrepTime,
  getPrepTimeStats,
  getOrdersPerHour,
  getPeakHourHeatmap,
  getOrderStatusBreakdown,
  
  // Customer Metrics
  getNewVsReturningCustomers,
  getCustomerLifetimeValue,
  getOptInRate,
  getAverageOrderValueByCustomer,
  
  // Promo Metrics
  getMostUsedPromos,
  getDiscountImpact,
  getRevenueLostToDiscounts,
  getPromoEffectiveness,
  
  // Inventory Metrics
  getInventoryValue,
  getLowStockAlerts,
  getStockMovement,
  getProfitMargins,
  
  // Chart Data Helpers
  getRevenueChartData,
  getCategoryPieData,
  getHourlyBarData,
  getStaffPerformanceData,
  
  // Utility functions (exported for testing)
  utils: {
    parseDate,
    isDateInRange,
    formatDateKey,
    getWeekKey,
    calcPrepTimeSeconds,
    calcStats,
    formatDuration,
    calculateMedian,
    calculateDistribution,
    groupBy
  }
};
