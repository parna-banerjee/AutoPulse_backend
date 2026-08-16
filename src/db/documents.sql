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
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_documents_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_documents_user (user_id)
);
