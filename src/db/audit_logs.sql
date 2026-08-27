-- Postgres (hosted). MySQL: SERIAL -> INT AUTO_INCREMENT, JSONB -> JSON.

CREATE TABLE IF NOT EXISTS audit_logs (
    id         SERIAL PRIMARY KEY,
    user_id    INT,
    level      VARCHAR(10) NOT NULL DEFAULT 'info',  -- info | warn | error
    source     VARCHAR(50),                          -- extraction | chat | auth | ...
    action     VARCHAR(100),
    message    TEXT,
    metadata   JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_source_level ON audit_logs (source, level);
