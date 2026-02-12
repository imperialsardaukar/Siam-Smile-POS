/**
 * Utility functions for Siam Smile POS Backend
 * CommonJS-safe utilities for Node.js 18+
 */

const crypto = require("crypto");

/**
 * Generate a secure random ID
 * Replaces nanoid with crypto.randomBytes for CommonJS compatibility
 * @returns {string} 32-character hex string
 */
function newId() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Generate a shorter ID for display purposes
 * @returns {string} 16-character hex string
 */
function shortId() {
  return crypto.randomBytes(8).toString("hex");
}

module.exports = {
  newId,
  shortId,
};
