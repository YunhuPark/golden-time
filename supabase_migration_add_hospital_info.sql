-- Migration: Add hospital_name and hospital_address to reviews table
-- Date: 2026-01-01
-- Purpose: Store hospital information with reviews for better UX

-- Add columns to reviews table
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS hospital_name TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS hospital_address TEXT NOT NULL DEFAULT '';

-- Remove default values after adding columns (for future inserts)
ALTER TABLE reviews
ALTER COLUMN hospital_name DROP DEFAULT,
ALTER COLUMN hospital_address DROP DEFAULT;

-- Note: Existing reviews will have empty strings for hospital_name and hospital_address
-- You may want to manually update these or delete old reviews if necessary
