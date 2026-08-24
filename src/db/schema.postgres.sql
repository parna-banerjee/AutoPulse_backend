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
