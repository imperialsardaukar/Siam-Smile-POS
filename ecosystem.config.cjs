/** PM2 Configuration for Siam Smile POS */
module.exports = {
  apps: [{
    name: "siam-smile-pos",
    script: "./backend/server.js",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    max_memory_restart: "500M",
    
    // Logging - use simple names to avoid permission issues
    log_type: "json",
    log_file: "./logs/app.log",
    out_file: "./logs/out.log",
    error_file: "./logs/error.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    
    // Environment
    env: {
      NODE_ENV: "production",
      PORT: 3001,
      HOST: "0.0.0.0",
    },
    
    // Auto-restart settings
    min_uptime: "10s",
    max_restarts: 10,
    
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 10000,
    
    // Merge logs
    merge_logs: true,
  }],
};
