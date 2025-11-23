const mysql = require("mysql");

const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'awan',
    password: '12345678',
    database: 'tommy',
    multipleStatements: true
});

module.exports = pool;