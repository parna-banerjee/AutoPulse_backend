-- MySQL. One appointment per user; date/time stored as strings.

CREATE TABLE IF NOT EXISTS appointments (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL UNIQUE,
    title         VARCHAR(255) NOT NULL,
    appt_date     VARCHAR(10) NOT NULL,
    appt_time     VARCHAR(5) NOT NULL,
    duration_mins INT NOT NULL DEFAULT 30,
    location      VARCHAR(255) DEFAULT NULL,
    notes         TEXT DEFAULT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_appointments_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);
