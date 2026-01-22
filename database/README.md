# Database Setup (SQL Server)

Ce dossier contient les scripts SQL nécessaires pour initialiser la base de données d'authentification.

## Prérequis

1.  Instance **Microsoft SQL Server** en cours d'exécution.
2.  Outil client (Azure Data Studio, SSMS, ou `sqlcmd`).
3.  Une base de données cible créée (ex: `EnterpriseDB`).

## Instructions

### 1. Initialisation Schema & Data

Exécuter le script `init_rbac.sql` sur votre base de données.

```bash
# Exemple avec sqlcmd (Docker ou Local)
sqlcmd -S localhost -U sa -P Password123 -d EnterpriseDB -i database/init_rbac.sql
```

Ce script va :
1.  Supprimer les anciennes tables si elles existent.
2.  Créer les tables (`users`, `roles`, `permissions`, etc.).
3.  Créer les indexes et clés étrangères.
4.  Insérer les données par défaut :
    *   **Permissions** : Liste complète des actions API.
    *   **Rôle** : `SUPER_ADMIN`.
    *   **Utilisateur** : `admin`.

### 2. Mot de passe Admin initial

Le script SQL insère un hash placeholder pour l'utilisateur `admin`.
Pour vous connecter la première fois, vous devez générer un hash valide correspondant à votre configuration `bcrypt`.

**Utilitaire de génération de hash :**

Créez un fichier temporaire `hash.js` :
```javascript
const bcrypt = require('bcrypt');
const pass = 'admin123';
bcrypt.hash(pass, 10).then(hash => console.log(hash));
```

Puis mettez à jour la base :
```sql
UPDATE dbo.users 
SET password = 'LE_HASH_GENERE' 
WHERE username = 'admin';
```
