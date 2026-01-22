# API Integration Examples

Ce document fournit des exemples bruts `curl` pour tester l'API.

## 1. Monitoring

Vérifier l'état du système :

```bash
curl -X GET http://localhost:3000/ready
# Response: {"status":"READY","services":{"database":"UP"}}
```

## 2. Authentification

### Login
Récupération des tokens.

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "securePassword123"
  }'
```

**Réponse :**
```json
{
  "accessToken": "eyJh... (JWT)",
  "refreshToken": "eyJh... (JWT)"
}
```

### Refresh Token
À utiliser quand l'Access Token expire (401).

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN_HERE"
  }'
```

## 3. Gestion des Incidents

**Note** : Remplacer `$TOKEN` par votre `accessToken`.

### Créer un incident

```bash
curl -X POST http://localhost:3000/api/v1/incidents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: test-request-001" \
  -d '{
    "title": "Panne Serveur Production",
    "description": "Le serveur SQL ne répond plus",
    "siteId": "uuid-site-paris",
    "subProcessId": "uuid-process-infra",
    "subCategoryId": "uuid-cat-hardware"
  }'
```

### Lister les incidents (Paginé)

```bash
curl -X GET "http://localhost:3000/api/v1/incidents?page=1&size=5&status=OPEN" \
  -H "Authorization: Bearer $TOKEN"
```

## 4. Gestion des Erreurs

Exemple de réponse d'erreur standardisée (tentative sans permission) :

```bash
# Request
curl -X DELETE http://localhost:3000/api/v1/incidents/123 \
  -H "Authorization: Bearer $TOKEN"

# Response 403 Forbidden
{
  "status": "error",
  "code": "FORBIDDEN",
  "message": "Forbidden: Missing permission INCIDENT_DELETE",
  "correlationId": "generated-uuid"
}
```
