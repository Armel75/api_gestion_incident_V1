# Authentication & Authorization Flow

## 1. Login Flow
1. **Client** sends `POST /api/v1/auth/login` with `{ username, password }`.
2. **Server** looks up user in SQL Server.
3. **Server** checks `isActive` flag. If `false`, throws "Account Locked".
4. **Server** validates password (bcrypt).
5. **Server** generates:
   - `accessToken`: JWT (valid 15 min). Contains `userId`, `roles`.
   - `refreshToken`: JWT (valid 7 days).
6. **Server** stores `refreshToken` in SQL Server (`RefreshTokens` table).
7. **Server** returns `{ accessToken, refreshToken }`.

## 2. Protected Resource Access
1. **Client** sends request with `Authorization: Bearer <accessToken>`.
2. **Middleware** (`authMiddleware.ts`):
   - Verifies JWT signature.
   - Decodes `userId`.
   - Fetches User + Roles + Permissions from DB.
   - **Crucial:** Checks `user.isActive`. If `false`, denies request immediately (Security hardening).
   - Attaches `user` object to request.
3. **Controller** executes business logic.

## 3. Refresh Flow (Token Rotation)
1. **Client** detects `accessToken` expired (401).
2. **Client** sends `POST /api/v1/auth/refresh` with `{ refreshToken }`.
3. **Server**:
   - Checks if `refreshToken` exists in DB.
   - Checks if `revoked` is true (Security Alert: Token Reuse).
   - Verifies JWT signature.
   - Checks `user.isActive`.
4. **Server** (if valid):
   - Revokes the OLD refresh token (`revoked = true`, `replacedByToken = newToken`).
   - Generates NEW `accessToken` and NEW `refreshToken`.
   - Stores NEW `refreshToken` in DB.
5. **Server** returns new tokens.

## 4. Logout
1. **Client** sends `POST /api/v1/auth/logout` with `{ refreshToken }`.
2. **Server** marks `refreshToken` as revoked in DB.
