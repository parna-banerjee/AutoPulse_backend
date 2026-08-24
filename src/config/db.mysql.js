const mysql = require("mysql2/promise");
require("dotenv").config();

// Native mysql2 pool. Its .execute() returns [rows|OkPacket, fields] and it
// exposes .getConnection(), which is exactly what the app already uses.
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
