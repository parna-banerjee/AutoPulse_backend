-- Postgres schema for the hosted database (DB_CLIENT=postgres).
-- Run this once against your Postgres instance. The MySQL equivalents live
-- in the other *.sql files in this folder for local development.

CREATE TABLE IF NOT EXISTS users (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255),
    role           VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    main_member_id INT REFERENCES users(id) ON DELETE CASCADE,
    relationship   VARCHAR(100),
    otp            VARCHAR(10),
    otp_expiry     TIMESTAMP,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS member_profiles (
    id            SERIAL PRIMARY KEY,
    user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth DATE,
    gender        VARCHAR(20),
    height        VARCHAR(20),
    weight        VARCHAR(20),
    blood_group   VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS documents (
    id                  SERIAL PRIMARY KEY,
    user_id             INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category            VARCHAR(100),
    file_name           VARCHAR(255) NOT NULL,
    storage_path        VARCHAR(512) NOT NULL,
    mime_type           VARCHAR(150),
    size_bytes          BIGINT,
    document_type       VARCHAR(50),
    extracted_data      JSONB,
    extraction_status   VARCHAR(20) NOT NULL DEFAULT 'pending',
    extraction_attempts INT NOT NULL DEFAULT 0,
    extraction_error    TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents (user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents (extraction_status);

CREATE TABLE IF NOT EXISTS document_shares (
    id           SERIAL PRIMARY KEY,
    token        VARCHAR(64) NOT NULL UNIQUE,
    user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_ids JSONB NOT NULL,
    expires_at   TIMESTAMP NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shares_token ON document_shares (token);

CREATE TABLE IF NOT EXISTS audit_logs (
    id         SERIAL PRIMARY KEY,
    user_id    INT,
    level      VARCHAR(10) NOT NULL DEFAULT 'info',
    source     VARCHAR(50),
    action     VARCHAR(100),
    message    TEXT,
    metadata   JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_source_level ON audit_logs (source, level);

CREATE TABLE IF NOT EXISTS appointments (
    id            SERIAL PRIMARY KEY,
    user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title         VARCHAR(255) NOT NULL,
    appt_date     VARCHAR(10) NOT NULL,
    appt_time     VARCHAR(5) NOT NULL,
    duration_mins INT NOT NULL DEFAULT 30,
    location      VARCHAR(255),
    notes         TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- If you already created appointments with a UNIQUE(user_id) (single
-- appointment only), drop it to allow multiple:
--   ALTER TABLE appointments DROP CONSTRAINT appointments_user_id_key;
