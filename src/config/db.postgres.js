const { Pool } = require("pg");
require("dotenv").config();

// Hosted Postgres almost always needs SSL. Opt out with DB_SSL=false.
const ssl = process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false };

const pool = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl, max: 10 }
        : {
              host: process.env.DB_HOST,
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              database: process.env.DB_NAME,
              port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
              ssl,
              max: 10
          }
);

// The app writes MySQL-style "?" placeholders; Postgres wants $1, $2, ...
function toPositional(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
}

// Mimics mysql2's pool.execute():
//   - SELECT            -> [rows]
//   - INSERT/UPDATE/... -> [{ insertId, affectedRows }]  (like an OkPacket)
// so existing call sites (`const [rows] = ...`, `result.insertId`,
// `result.affectedRows`) keep working unchanged.
async function execute(sql, params = []) {
    let text = toPositional(sql);

    // Postgres needs RETURNING to surface a generated id (mysql2 gives it for
    // free). Every table in this app has an "id" primary key.
    const isInsert = /^\s*insert\s/i.test(text);
    if (isInsert && !/\breturning\b/i.test(text)) {
        text += " RETURNING id";
    }

    const res = await pool.query(text, params);

    if (res.command === "SELECT") {
        return [res.rows];
    }

    return [
        {
            insertId: res.rows && res.rows[0] ? res.rows[0].id : undefined,
            affectedRows: res.rowCount,
            rows: res.rows
        }
    ];
}

// Matches the mysql2 pool API used in server.js for the startup health check.
async function getConnection() {
    const client = await pool.connect();
    return { release: () => client.release() };
}

module.exports = { execute, getConnection, pool };
