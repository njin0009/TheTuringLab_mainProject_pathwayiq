-- PathwayIQ: Occupation AI Risk Table
-- Source: JSA Generative AI Capacity Study, 2025
-- 357 occupations with ANZSCO codes, exposure scores, and risk labels

CREATE TABLE IF NOT EXISTS occupation_risk (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    anzsco_code         VARCHAR(10) NOT NULL,
    occupation_name     VARCHAR(255) NOT NULL,
    automation_score    FLOAT,
    augmentation_score  FLOAT,
    automation_level    ENUM('Very Low', 'Low', 'Medium', 'High') NOT NULL,
    augmentation_level  ENUM('Very Low', 'Low', 'Medium', 'High') NOT NULL,
    explanation         TEXT,
    data_source         VARCHAR(200) DEFAULT 'JSA Generative AI Capacity Study, 2025',
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_anzsco (anzsco_code),
    INDEX idx_augmentation_level (augmentation_level)
);