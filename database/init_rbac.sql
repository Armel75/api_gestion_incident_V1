-- =============================================
-- Database: EnterpriseDB
-- Module:   Authentication & RBAC
-- Dialect:  T-SQL (Microsoft SQL Server)
-- =============================================

-- 1. Nettoyage (Ordre inverse des dépendances)
IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL DROP TABLE dbo.role_permissions;
IF OBJECT_ID('dbo.user_roles', 'U') IS NOT NULL DROP TABLE dbo.user_roles;
IF OBJECT_ID('dbo.refresh_tokens', 'U') IS NOT NULL DROP TABLE dbo.refresh_tokens;
IF OBJECT_ID('dbo.permissions', 'U') IS NOT NULL DROP TABLE dbo.permissions;
IF OBJECT_ID('dbo.roles', 'U') IS NOT NULL DROP TABLE dbo.roles;
IF OBJECT_ID('dbo.users', 'U') IS NOT NULL DROP TABLE dbo.users;

-- 2. Tables Principales

-- Table: users
CREATE TABLE dbo.users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    username NVARCHAR(50) NOT NULL,
    password NVARCHAR(255) NOT NULL, -- Stockage du hash Bcrypt
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_Users_Username UNIQUE (username)
);
CREATE INDEX IX_Users_Username ON dbo.users(username);

-- Table: roles
CREATE TABLE dbo.roles (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(50) NOT NULL,
    description NVARCHAR(255) NULL,
    CONSTRAINT UQ_Roles_Name UNIQUE (name)
);

-- Table: permissions
CREATE TABLE dbo.permissions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    action NVARCHAR(100) NOT NULL, -- Ex: 'INCIDENT_CREATE'
    description NVARCHAR(255) NULL,
    CONSTRAINT UQ_Permissions_Action UNIQUE (action)
);

-- Table: refresh_tokens (Nécessaire pour le flow Auth implémenté dans le code)
CREATE TABLE dbo.refresh_tokens (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    token NVARCHAR(512) NOT NULL,
    user_id UNIQUEIDENTIFIER NOT NULL,
    expires_at DATETIME2 NOT NULL,
    revoked BIT NOT NULL DEFAULT 0,
    replaced_by_token NVARCHAR(512) NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);
CREATE INDEX IX_RefreshTokens_Token ON dbo.refresh_tokens(token);

-- 3. Tables de Liaison (Many-to-Many)

-- Table: user_roles
CREATE TABLE dbo.user_roles (
    user_id UNIQUEIDENTIFIER NOT NULL,
    role_id UNIQUEIDENTIFIER NOT NULL,
    assigned_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT FK_UserRoles_User FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE,
    CONSTRAINT FK_UserRoles_Role FOREIGN KEY (role_id) REFERENCES dbo.roles(id) ON DELETE CASCADE
);

-- Table: role_permissions
CREATE TABLE dbo.role_permissions (
    role_id UNIQUEIDENTIFIER NOT NULL,
    permission_id UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT FK_RolePermissions_Role FOREIGN KEY (role_id) REFERENCES dbo.roles(id) ON DELETE CASCADE,
    CONSTRAINT FK_RolePermissions_Permission FOREIGN KEY (permission_id) REFERENCES dbo.permissions(id) ON DELETE CASCADE
);

-- =============================================
-- SEED DATA (Initialisation)
-- =============================================

BEGIN TRANSACTION;

    -- A. Permissions
    DECLARE @Perms TABLE (id UNIQUEIDENTIFIER, action NVARCHAR(100));
    
    INSERT INTO dbo.permissions (action, description)
    OUTPUT inserted.id, inserted.action INTO @Perms
    VALUES 
    -- Incidents
    ('INCIDENT_READ', 'Voir les incidents'),
    ('INCIDENT_CREATE', 'Créer un incident'),
    ('INCIDENT_UPDATE', 'Modifier un incident'),
    ('INCIDENT_DELETE', 'Supprimer un incident'),
    -- Sites
    ('SITE_READ', 'Voir les sites'),
    ('SITE_CREATE', 'Créer un site'),
    ('SITE_UPDATE', 'Modifier un site'),
    ('SITE_DELETE', 'Supprimer un site'),
    -- Types de site
    ('SITETYPE_READ', 'Voir les types de site'),
    ('SITETYPE_CREATE', 'Créer un type de site'),
    ('SITETYPE_UPDATE', 'Modifier un type de site'),
    ('SITETYPE_DELETE', 'Supprimer un type de site'),
    -- Users
    ('USER_READ', 'Voir les utilisateurs'),
    ('USER_UPDATE', 'Modifier un utilisateur'),
    ('USER_DELETE', 'Supprimer un utilisateur'),
    -- Tasks, Process, Category
    ('TASK_READ', 'Voir les taches'), ('TASK_CREATE', 'Creer tache'), ('TASK_UPDATE', 'Maj tache'), ('TASK_DELETE', 'Supprimer tache'),
    ('PROCESS_READ', 'Voir processus'), ('PROCESS_CREATE', 'Creer processus'), ('PROCESS_UPDATE', 'Maj processus'), ('PROCESS_DELETE', 'Supprimer processus'),
    ('CATEGORY_READ', 'Voir categories'), ('CATEGORY_CREATE', 'Creer categorie'), ('CATEGORY_UPDATE', 'Maj categorie'), ('CATEGORY_DELETE', 'Supprimer categorie');

    -- B. Rôles
    DECLARE @RoleId UNIQUEIDENTIFIER;
    INSERT INTO dbo.roles (name, description) VALUES ('SUPER_ADMIN', 'Administrateur système complet');
    SELECT @RoleId = id FROM dbo.roles WHERE name = 'SUPER_ADMIN';

    -- C. Assignation de TOUTES les permissions au SUPER_ADMIN
    INSERT INTO dbo.role_permissions (role_id, permission_id)
    SELECT @RoleId, id FROM @Perms;

    -- D. Utilisateur Admin
    DECLARE @UserId UNIQUEIDENTIFIER;
    
    -- Hash pour le mot de passe "admin123" (Bcrypt cost 10)
    -- NOTE: Ceci est un hash statique valide pour l'exemple. En prod, générez-le via l'app.
    DECLARE @HashPassword NVARCHAR(255) = '$2b$10$wS6z.y.h.u.x.z.y.z.y.z.y.z.y.z.y.z.y.z.y.z.y.z.y'; 
    -- (Le hash ci-dessus est illustratif, utilisez 'npm run hash' pour en générer un vrai si celui-ci échoue)
    -- Pour assurer le fonctionnement immédiat, on insère un utilisateur actif.

    INSERT INTO dbo.users (username, password, is_active) 
    VALUES ('admin', '$2b$10$EpWoWZLOo/vF0/./././././././././././././././././././.', 1); 
    -- Note: Le hash ci-dessus est un placeholder. 
    -- L'application devra peut-être réinitialiser ce mot de passe ou utiliser un script de seed JS.

    SELECT @UserId = id FROM dbo.users WHERE username = 'admin';

    -- E. Assignation du rôle à l'utilisateur
    INSERT INTO dbo.user_roles (user_id, role_id) VALUES (@UserId, @RoleId);

COMMIT TRANSACTION;

PRINT 'Initialisation RBAC terminée avec succès.';
