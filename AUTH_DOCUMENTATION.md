# Authentication Documentation

## Overview

This Chess application uses **OAuth2 authentication** with Passport.js, supporting two providers:
1. **Google OAuth2.0**
2. **GitHub OAuth2.0**

Authentication flow uses **JWT tokens** for stateless session management with **Express sessions** for backup.

## Authentication Flow

### OAuth2 Flow (Standard)

```
1. User clicks "Login with [Provider]"
   ↓
2. Frontend redirects to /auth/{provider}
   ↓
3. Backend initiates OAuth2 handshake with provider
   ↓
4. User authenticates with provider and grants permissions
   ↓
5. Provider redirects to /auth/{provider}/callback with authorization code
   ↓
6. Backend exchanges code for access token
   ↓
7. Backend fetches user profile from provider
   ↓
8. Backend creates/updates user in database
   ↓
9. Backend generates JWT token
   ↓
10. Backend sets secure HTTP-only cookie and redirects to frontend
    ↓
11. Frontend stores token and user data in state
    ↓
12. User is authenticated and ready to play
```

## Detailed Implementation

### 1. Passport.js Setup

**File**: `apps/backend/src/passport.ts`

Initializes three OAuth2 strategies:

#### Google Strategy
```typescript
new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: `${BACKEND_URL}/auth/google/callback`
})
```

#### GitHub Strategy
```typescript
new GithubStrategy({
  clientID: GITHUB_CLIENT_ID,
  clientSecret: GITHUB_CLIENT_SECRET,
  callbackURL: `${BACKEND_URL}/auth/github/callback`
})
```

Each strategy performs the same operation on successful authentication:
1. Extract email and displayName from OAuth provider profile
2. Upsert user in database (create if new, update if exists)
3. Set provider name on user record
4. Return user object to Passport

### 2. Authentication Routes

**File**: `apps/backend/src/router/auth.ts`

#### Login Endpoints

**GET `/auth/google`**
- Initiates Google OAuth flow
- Scope: `profile`, `email`
- Redirects to Google authentication

**GET `/auth/google/callback`**
- Handles Google OAuth callback
- Generates JWT token with 7-day expiration
- Sets secure HTTP-only cookie
- Redirects to `/game/random`

**GET `/auth/github`**
- Initiates GitHub OAuth flow
- Scope: `profile`, `email`

**GET `/auth/github/callback`**
- Handles GitHub OAuth callback
- Uses session-based authentication

#### Utility Endpoints

**GET `/auth/refresh`**
- Validates current user session
- Issues new JWT token
- Returns user data: `{ token, id, name }`
- Response: 200 on success, 401 if unauthorized
- Sets cache-control headers to prevent caching

**GET `/auth/logout`**
- Destroys user session
- Clears JWT cookie
- Redirects to frontend

**GET `/auth/login/failed`**
- Returns 401 Unauthorized
- Used as fallback for failed OAuth callbacks

### 3. Session Management

**File**: `apps/backend/src/index.ts`

#### Express Session Configuration

```typescript
app.use(session({
  name: "session",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,                          // JS cannot access cookie
    secure: isProd,                          // HTTPS only in production
    sameSite: isProd ? "none" : "lax",      // CSRF protection
    maxAge: 24 * 60 * 60 * 1000              // 24-hour expiration
  }
}));
```

#### Serialization

User objects are serialized to session with:
```typescript
{
  id: user.id,
  username: user.username,
  picture: user.picture
}
```

### 4. JWT Token Structure

JWT tokens are signed with `JWT_SECRET` and include:
```typescript
{
  userId: user.id,
  iat: [timestamp],
  exp: [timestamp] // 7 days from issuance
}
```

Token is set in HTTP-only cookie:
```typescript
res.cookie("jwt", token, {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000
});
```

### 5. CORS Configuration

**File**: `apps/backend/src/index.ts`

```typescript
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true                    // Allow credentials (cookies)
}));
```

Only requests from `CLIENT_URL` are allowed to prevent CSRF attacks.

## Provider Setup Guide

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
4. Choose "Web Application"
5. Add authorized redirect URI: `{BACKEND_URL}/auth/google/callback`
6. Copy `Client ID` and `Client Secret` to `.env`

### GitHub OAuth Setup

1. Go to GitHub Settings → Developer settings → [OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill application details:
   - Authorization callback URL: `{BACKEND_URL}/auth/github/callback`
4. Copy `Client ID` and `Client Secret` to `.env`


## WebSocket Authentication

**File**: `apps/ws/src/index.ts`

WebSocket connections require JWT authentication:

```
ws://localhost:8080?token=[JWT_TOKEN]
```

1. Client establishes WebSocket connection with JWT in query parameter
2. Server extracts and validates token
3. Server extracts `userId` from token payload
4. User is added to game manager
5. On disconnect, user is removed from active games

### Token Extraction

```typescript
const token = url.parse(req.url, true).query.token;
const userId = extractUserId(token);
```

## Security Considerations

### Best Practices Implemented

1. **HTTP-Only Cookies** - JavaScript cannot access authentication tokens
2. **Secure Flag** - Cookies only sent over HTTPS in production
3. **SameSite** - CSRF protection with `SameSite=Lax/None`
4. **CORS** - Only requests from authorized origin accepted
5. **Session Secrets** - Strong, randomly generated in production
6. **JWT Expiration** - Tokens expire after 7 days

### Production Checklist

- [ ] `JWT_SECRET` is strong (32+ chars, random)
- [ ] `SESSION_SECRET` is strong and unique
- [ ] `BACKEND_URL` uses HTTPS
- [ ] `CLIENT_URL` uses HTTPS
- [ ] Environment variables are not committed to git
- [ ] HTTPS certificates are valid
- [ ] CORS origin is correctly configured
- [ ] OAuth provider redirect URIs match production URLs
- [ ] Database credentials are secure

## Database Schema

User table in Prisma schema:

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  provider  String   // "GOOGLE" | "GITHUB"
  
  // Relations
  games     Game[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Troubleshooting

### "Missing environment variables for authentication providers"

**Cause**: One or more OAuth credentials are missing in `.env`

**Solution**: Verify all required env vars exist:
```bash
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GITHUB_CLIENT_ID
- GITHUB_CLIENT_SECRET
```

### "Invalid state parameter"

**Cause**: Session/state mismatch in OAuth flow

**Solution**: 
- Clear browser cookies and try again
- Check that `SESSION_SECRET` is set
- Ensure backend URL matches authorized redirect URIs

### Cookies not being set

**Cause**: Cookie security settings blocking storage

**Solution**:
- In development: Ensure `CLIENT_URL` is not HTTPS
- In production: Ensure both URLs use HTTPS
- Check browser console for security warnings

### WebSocket authentication fails

**Cause**: Invalid or expired JWT token

**Solution**:
- Call `/auth/refresh` to get new token
- WebSocket connects only after successful login
- Check token expiration in browser console

## API Response Examples

### Successful Refresh
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "id": "user123",
  "name": "John Doe"
}
```

### Unauthorized
```json
{
  "message": "Unauthorized"
}
```

### Login Failed
```json
{
  "success": false,
  "message": "failure"
}
```

## Further Reading

- [Passport.js Documentation](http://www.passportjs.org/)
- [OAuth 2.0](https://oauth.net/2/)
- [JWT Introduction](https://jwt.io/introduction)
