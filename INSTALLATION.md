# Installation Guide

## System Requirements

- **Node.js**: 18.0.0 or higher
- **npm** or **pnpm**: For package management
- **PostgreSQL**: 12 or higher
- **Git**: For version control

## Step-by-Step Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd Chess
```

### 2. Install Dependencies

Using pnpm (recommended):
```bash
pnpm install
```

Or using npm:
```bash
npm install
```

### 3. Environment Setup

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/chess"

# Server URLs
BACKEND_URL="http://localhost:3000"
CLIENT_URL="http://localhost:5173"

# Secrets (Use strong random values in production)
JWT_SECRET="your-strong-random-secret-key"
SESSION_SECRET="your-strong-random-session-secret"

# OAuth Credentials (See AUTH_DOCUMENTATION.md for setup)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
```

### 4. Database Setup

Initialize the database and run migrations:

```bash
# Navigate to database package
cd packages/db

# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev

# (Optional) Seed database with test data
pnpm prisma db seed
```

### 5. OAuth Provider Configuration

Before running the application, configure OAuth applications:

#### Google
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials (Web Application)
3. Add redirect URI: `http://localhost:3000/auth/google/callback`
4. Copy Client ID and Secret to `.env`

#### GitHub
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create new OAuth App
3. Set Authorization callback URL: `http://localhost:3000/auth/github/callback`
4. Copy Client ID and Secret to `.env`

See [AUTH_DOCUMENTATION.md](../AUTH_DOCUMENTATION.md#provider-setup-guide) for detailed setup.

### 6. Start Development Servers

Open separate terminals for each service:

**Terminal 1 - Backend Server**
```bash
pnpm dev --filter=backend
# Server runs on http://localhost:3000
```

**Terminal 2 - Frontend Development Server**
```bash
pnpm dev --filter=frontend
# Dev server runs on http://localhost:5173
```

**Terminal 3 - WebSocket Server**
```bash
pnpm dev --filter=ws
# WebSocket server runs on ws://localhost:8080
```

### 7. Test Installation

1. Open browser to `http://localhost:5173`
2. Click "Login with [Provider]"
3. Authenticate with one of the OAuth providers
4. You should be redirected to the landing page
5. Test finding an opponent and playing a game

## Build for Production

### Build all packages:
```bash
pnpm build
```

### Build specific package:
```bash
pnpm build --filter=backend
pnpm build --filter=frontend
pnpm build --filter=ws
```

### Start production servers:

**Backend**
```bash
cd apps/backend
NODE_ENV=production node dist/index.js
```

**Frontend** (static hosting)
```bash
# Build output in apps/frontend/dist
cd apps/frontend
pnpm build
# Serve the dist folder with your hosting provider
```

**WebSocket**
```bash
cd apps/ws
NODE_ENV=production node dist/index.js
```

## Database Migrations

### Create a new migration:
```bash
cd packages/db
pnpm prisma migrate dev --name <migration_name>
```

### Apply migrations to production:
```bash
cd packages/db
pnpm prisma migrate deploy
```

### View database in Prisma Studio:
```bash
cd packages/db
pnpm prisma studio
```

## Environment Variables Explained

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost/chess` |
| `BACKEND_URL` | Backend API base URL | `http://localhost:3000` |
| `CLIENT_URL` | Frontend URL (CORS origin) | `http://localhost:5173` |
| `JWT_SECRET` | JWT signing secret | Strong random string (32+ chars) |
| `SESSION_SECRET` | Express session secret | Strong random string (32+ chars) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret | From Google Cloud Console |
| `GITHUB_CLIENT_ID` | GitHub OAuth App ID | From GitHub OAuth App settings |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Secret | From GitHub OAuth App settings |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `WS_PORT` | WebSocket server port | `8080` |
| `REDIS_URL` | Redis connection (optional) | `redis://localhost:6379` |

## Troubleshooting

### Port Already in Use

If port 3000, 5173, or 8080 is already in use:

```bash
# Find process using port (macOS/Linux)
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in development
VITE_BACKEND_URL=http://localhost:3001 pnpm dev --filter=frontend
```

### Database Connection Error

```bash
# Check PostgreSQL is running
# macOS
brew services list | grep postgres

# Linux
sudo systemctl status postgresql

# Verify DATABASE_URL in .env
# Format: postgresql://user:password@host:port/database
```

### OAuth Redirect URI Mismatch

- Ensure `BACKEND_URL` in `.env` matches OAuth redirect URI
- In development: Include `http://localhost:3000`
- In production: Use your domain

### Node Modules Issues

```bash
# Clear and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Docker Deployment (Optional)

Coming soon: Docker Compose setup for containerized deployment.

## Next Steps

- Read [AUTH_DOCUMENTATION.md](../AUTH_DOCUMENTATION.md) for authentication details
- Check [README.md](../README.md) for project overview
- Review source code in `apps/*/src`
- Configure your IDE for TypeScript support

## Support

For issues or questions:
1. Check documentation files
2. Review GitHub issues
3. Check environment variable configuration
4. Verify OAuth provider setup
