-- Run this manually against your MySQL database.
-- Stores metadata for files that live in Supabase Storage.

CREATE TABLE IF NOT EXISTS documents (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    category      VARCHAR(100) DEFAULT NULL,
    file_name     VARCHAR(255) NOT NULL,
    storage_path  VARCHAR(512) NOT NULL,
    mime_type     VARCHAR(150) DEFAULT NULL,
    size_bytes    BIGINT DEFAULT NULL,
    document_type VARCHAR(50) DEFAULT NULL,
    extracted_data JSON DEFAULT NULL,
    -- Background extraction job state.
    -- pending -> processing -> done | failed ; skipped = not extractable
    extraction_status   VARCHAR(20) NOT NULL DEFAULT 'pending',
    extraction_attempts INT NOT NULL DEFAULT 0,
    extraction_error    TEXT DEFAULT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_documents_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_documents_user (user_id),
    -- Lets the worker find the next job quickly.
    INDEX idx_documents_status (extraction_status)
);

-- If the table already exists without these columns, run instead:
-- ALTER TABLE documents
--   ADD COLUMN document_type VARCHAR(50) DEFAULT NULL,
--   ADD COLUMN extracted_data JSON DEFAULT NULL,
--   ADD COLUMN extraction_status VARCHAR(20) NOT NULL DEFAULT 'pending',
--   ADD COLUMN extraction_attempts INT NOT NULL DEFAULT 0,
--   ADD COLUMN extraction_error TEXT DEFAULT NULL,
--   ADD INDEX idx_documents_status (extraction_status);
