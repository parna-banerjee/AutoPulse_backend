-- Run this manually against your MySQL database.
-- Time-limited share tokens that grant read access to a user's documents.

CREATE TABLE IF NOT EXISTS document_shares (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    token       VARCHAR(64) NOT NULL UNIQUE,
    user_id     INT NOT NULL,
    expires_at  DATETIME NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_shares_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_shares_token (token)
);
