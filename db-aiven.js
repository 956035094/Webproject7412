const fs = require("fs");
const mysql = require("mysql2/promise");
const path = require("path");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: {
    ca: fs.readFileSync(path.join(__dirname, "ca.pem")),
    rejectUnauthorized: true
  }
});

module.exports = pool;