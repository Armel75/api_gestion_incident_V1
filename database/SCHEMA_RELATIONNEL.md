# Schéma Relationnel RBAC (SQL Server)

Ce module gère l'authentification et les autorisations.

## Diagramme Textuel

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : assigned_to
    ROLES ||--o{ ROLE_PERMISSIONS : includes
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : defined_in
    USERS ||--o{ REFRESH_TOKENS : owns

    USERS {
        uuid id PK
        string username UK
        string password "Bcrypt Hash"
        bool is_active
        datetime created_at
    }

    ROLES {
        uuid id PK
        string name UK
        string description
    }

    PERMISSIONS {
        uuid id PK
        string action UK "Ex: INCIDENT_CREATE"
        string description
    }

    USER_ROLES {
        uuid user_id FK,PK
        uuid role_id FK,PK
    }

    ROLE_PERMISSIONS {
        uuid role_id FK,PK
        uuid permission_id FK,PK
    }

    REFRESH_TOKENS {
        uuid id PK
        string token UK
        uuid user_id FK
        datetime expires_at
        bool revoked
    }
```

## Description des Tables

1.  **users**: Comptes utilisateurs. Mot de passe stocké hashé uniquement.
2.  **roles**: Groupes logiques de permissions (Ex: `SUPER_ADMIN`, `MANAGER`).
3.  **permissions**: Actions atomiques autorisées (Ex: `INCIDENT_CREATE`).
4.  **user_roles**: Table de liaison N-N. Un utilisateur a N rôles.
5.  **role_permissions**: Table de liaison N-N. Un rôle a N permissions.
6.  **refresh_tokens**: Tokens de sécurité longue durée pour le mécanisme JWT Access/Refresh.
