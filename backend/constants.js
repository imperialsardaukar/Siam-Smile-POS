const path = require("path");

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

module.exports = {
  NODE_ENV,
  IS_PRODUCTION,
  PORT: process.env.PORT ? Number(process.env.PORT) : 3001,
  HOST: process.env.HOST || "0.0.0.0",
  JWT_SECRET: process.env.JWT_SECRET || "siam-smile-pos-dev-secret-change-me",
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || "Admin",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "Admin$4637",
  DATA_DIR: path.join(__dirname, "data"),
  DATA_FILE: path.join(__dirname, "data", "data.json"),
  BACKUP_DIR: path.join(__dirname, "data", "backups"),
};
