-- Migration: Enable Attachments for Tasks
-- 1. Add task_id column
ALTER TABLE dbo.attachments ADD task_id UNIQUEIDENTIFIER NULL;

-- 2. Add Foreign Key to Tasks
ALTER TABLE dbo.attachments ADD CONSTRAINT FK_Attachments_Task FOREIGN KEY (task_id) REFERENCES dbo.tasks(id) ON DELETE CASCADE;

-- 3. Make incident_id optional (nullable) to allow attachments linked ONLY to a task
ALTER TABLE dbo.attachments ALTER COLUMN incident_id UNIQUEIDENTIFIER NULL;
