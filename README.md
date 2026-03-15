# Chess - A Real-time Multiplayer Chess Game

A full-stack, real-time multiplayer chess application built with modern web technologies. Players can authenticate via Google or GitHub, and play chess games against other users with live updates and ELO rating calculations.

## 🎯 Features

- **OAuth2 Authentication** - Sign in with Google or GitHub
- **Real-time Multiplayer** - WebSocket-based live game updates
- **ELO Rating System** - Automatic rating calculations after each game
- **Game History** - Track played games with move recording
- **Responsive UI** - Works across desktop and mobile devices
- **TypeScript** - Full type safety across the stack

## 🏗️ Architecture

```
Chess/
├── apps/
│   ├── backend/        # Express.js API server with Passport.js auth
│   ├── frontend/       # React + Vite SPA with Recoil state management
│   └── ws/             # WebSocket server for real-time game updates
├── packages/
│   └── db/             # Prisma ORM schema and migrations
└── package.json        # Monorepo configuration (pnpm workspaces)
```

## 🛠️ Tech Stack

### Backend
- **Express.js** - REST API server
- **Passport.js** - OAuth2 authentication
- **WebSocket** - Real-time communication
- **Prisma** - Database ORM
- **JWT** - Session tokens
- **Redis** - Rate limiting and caching

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **Recoil** - State management
- **TypeScript** - Type safety

### Database
- **PostgreSQL** - Primary database
- **Prisma** - Schema management and migrations

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- OAuth2 applications (Google, GitHub)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Chess
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Setup database**
   ```bash
   cd packages/db
   pnpm prisma migrate dev
   ```

5. **Start development servers**
   ```bash
   # In separate terminals:
   pnpm dev --filter=backend      # Backend API
   pnpm dev --filter=frontend     # Frontend dev server
   pnpm dev --filter=ws           # WebSocket server
   ```

Visit `http://localhost:5173` in your browser.

## 📖 Authentication

The application uses OAuth2 for authentication with two providers:
- **Google** - via `passport-google-oauth20`
- **GitHub** - via `passport-github2`

See [AUTH_DOCUMENTATION.md](./AUTH_DOCUMENTATION.md) for detailed authentication flow and setup.

## 🔐 Environment Variables

See [.env.example](./.env.example) for all required environment variables.

### Critical Variables
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (use strong value in production)
- `SESSION_SECRET` - Express session secret
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` - GitHub OAuth
- `BACKEND_URL` - Backend server URL
- `CLIENT_URL` - Frontend server URL

## 📱 API Endpoints

### Authentication Routes (`/auth`)
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/github` - Initiate GitHub OAuth
- `GET /auth/github/callback` - GitHub OAuth callback
- `GET /auth/refresh` - Refresh authentication token
- `GET /auth/logout` - Logout user
- `GET /auth/login/failed` - Login failure endpoint

### WebSocket Connection
- **URL**: `ws://localhost:8080?token=<jwt_token>`
- **Authentication**: JWT token passed as query parameter
- See [AUTH_DOCUMENTATION.md](./AUTH_DOCUMENTATION.md) for message protocol

## 🎮 Game Rules

Standard chess rules apply. The ELO rating system adjusts player ratings based on:
- Game result (win/loss/draw)
- Opponent rating
- Game outcome probability

## 🐛 Development

### Project Structure
```
backend/
├── src/
│   ├── index.ts           # Express app setup
│   ├── passport.ts        # OAuth2 strategies
│   ├── router/
│   │   ├── auth.ts        # Authentication routes
│   │   └── v1.ts          # API v1 routes
│   ├── db/                # Database utilities
│   └── [other services]
frontend/
├── src/
│   ├── App.tsx            # Main app component
│   ├── components/        # Reusable components
│   ├── screens/           # Page components
│   ├── hooks/             # Custom hooks
│   └── store/             # Recoil atoms
ws/
├── src/
│   ├── index.ts           # WebSocket server
│   ├── GameManager.ts     # Game management
│   ├── SocketManager.ts   # User connections
│   ├── Game.ts            # Game logic
│   ├── messages.ts        # Message types
│   └── [other services]
```

### Build
```bash
pnpm build
```

### Testing
```bash
pnpm test
```

## 📝 Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## 📄 License

ISC License - See LICENSE file for details

## 👨‍💻 Author

Created as a full-stack project demonstrating modern web development practices.
