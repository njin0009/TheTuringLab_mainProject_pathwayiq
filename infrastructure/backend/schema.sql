-- PathwayIQ Career Database Schema
-- Cloudflare D1 (SQLite-compatible)
-- Created: Iteration 1

CREATE TABLE IF NOT EXISTS careers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT NOT NULL,
  industry        TEXT NOT NULL,
  salary_min      INTEGER NOT NULL,
  salary_max      INTEGER NOT NULL,
  pathway         TEXT NOT NULL CHECK (pathway IN ('University', 'TAFE', 'Apprenticeship')),
  shortage_status TEXT NOT NULL CHECK (shortage_status IN ('In Shortage', 'Not in Shortage')),
  ai_risk         TEXT NOT NULL CHECK (ai_risk IN ('Low', 'Medium', 'High')),
  created_at      TEXT DEFAULT (datetime('now'))
);

-- Index for fast keyword search on title
CREATE INDEX IF NOT EXISTS idx_careers_title ON careers(title);

-- Index for fast filtering by pathway
CREATE INDEX IF NOT EXISTS idx_careers_pathway ON careers(pathway);

-- Index for fast filtering by ai_risk
CREATE INDEX IF NOT EXISTS idx_careers_ai_risk ON careers(ai_risk);