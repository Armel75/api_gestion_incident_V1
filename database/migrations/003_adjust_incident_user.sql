-- Migration: Rename reporter_id to user_id for clarity
-- Note: Check if the table/column exists first in a real scenario, here we assume it was reporter_id based on previous entity definition.

-- For SQL Server
EXEC sp_rename 'dbo.incidents.reporter_id', 'user_id', 'COLUMN';
