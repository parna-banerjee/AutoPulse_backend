require("dotenv").config();

// Pick the driver by env: MySQL locally, Postgres in hosted.
// DB_CLIENT = "mysql" (default) | "postgres" | "pg"
const client = (process.env.DB_CLIENT || "mysql").toLowerCase();

const pool =
    client === "postgres" || client === "pg"
        ? require("./db.postgres")
        : require("./db.mysql");

module.exports = pool;
