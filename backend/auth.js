const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD } = require("./constants");

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function adminLogin(username, password) {
  // Exact match; no trimming/lowercasing to avoid accidental mismatch.
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return signToken({ role: "admin", sub: "admin" });
  }
  return null;
}

async function staffPasswordHash(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function staffPasswordVerify(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  signToken,
  verifyToken,
  adminLogin,
  staffPasswordHash,
  staffPasswordVerify,
};
