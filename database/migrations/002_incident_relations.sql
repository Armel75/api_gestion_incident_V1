-- Migration: Update Incident Relations
-- 1. Create table attachments
CREATE TABLE dbo.attachments (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    file_name NVARCHAR(255) NOT NULL,
    url NVARCHAR(2048) NOT NULL,
    incident_id UNIQUEIDENTIFIER NOT NULL,
    uploaded_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Attachments_Incident FOREIGN KEY (incident_id) REFERENCES dbo.incidents(id) ON DELETE CASCADE
);

-- 2. Create join table incident_sites (Many-to-Many)
CREATE TABLE dbo.incident_sites (
    incident_id UNIQUEIDENTIFIER NOT NULL,
    site_id UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY (incident_id, site_id),
    CONSTRAINT FK_IncidentSites_Incident FOREIGN KEY (incident_id) REFERENCES dbo.incidents(id) ON DELETE CASCADE,
    CONSTRAINT FK_IncidentSites_Site FOREIGN KEY (site_id) REFERENCES dbo.sites(id) ON DELETE CASCADE
);

-- 3. Create join table incident_users (Many-to-Many for Assignees)
CREATE TABLE dbo.incident_users (
    incident_id UNIQUEIDENTIFIER NOT NULL,
    user_id UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY (incident_id, user_id),
    CONSTRAINT FK_IncidentUsers_Incident FOREIGN KEY (incident_id) REFERENCES dbo.incidents(id) ON DELETE CASCADE,
    CONSTRAINT FK_IncidentUsers_User FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);

-- 4. Clean up old columns from incidents if necessary (optional step depending on deployment strategy)
-- ALTER TABLE dbo.incidents DROP COLUMN site_id;
-- ALTER TABLE dbo.incidents DROP COLUMN user_id;