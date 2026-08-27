const pool = require("../config/db");

// Best-effort audit logging: writes an event/error to the audit_logs table.
// Never throws — logging must not break the main flow.
const logAudit = async ({
    level = "info",
    source = null,
    action = null,
    message = "",
    userId = null,
    metadata = null
} = {}) => {
    try {
        await pool.execute(
            `INSERT INTO audit_logs (user_id, level, source, action, message, metadata)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                userId ?? null,
                level,
                source,
                action,
                String(message || "").slice(0, 4000),
                metadata ? JSON.stringify(metadata) : null
            ]
        );
    } catch (err) {
        console.error("[audit] failed to write log:", err.message);
    }
};

module.exports = { logAudit };
