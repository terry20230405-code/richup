# Richup

A multiplayer, turn-based property trading game built for the browser with **Vue 3, TypeScript, Node.js, and Socket.IO**.

Create a room, invite friends, and compete across a randomized 56-tile board. Buy properties, collect rent, negotiate trades, join auctions, and use cards to change the course of the game.

## Features

- **2–6 players per room** with a shared board and live turn updates.
- **Randomized boards** that keep property groups together while preserving fixed locations such as START, airports, temples, casinos, and jail.
- **Property management** including purchases, building upgrades, mortgages, redemption, and rent collection.
- **Live auctions** with bids, passing, timed rounds, and winner settlement.
- **Player-to-player trading** involving properties, cash, and cards.
- **Special tiles** including casinos with tiered odds, temples with prayer and card-draw mechanics, taxes, and surprise events.
- **Six card types:** Forced Trade, Remote Dice, Plunder, Immunity, Audit, and Price Hike.
- **Reconnection support** using session tokens, a three-minute in-game reconnection window, and personalized state snapshots.
- **An eight-minute bankruptcy rescue window** for raising funds before bankruptcy settlement.
- **A custom game interface** with animated 3D dice, colored player tokens, country flags, tile details, event logs, and a collapsible side panel.

Game values and timing rules are centralized in [GameConfig.ts](richup.backend/src/config/GameConfig.ts).

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | Vue 3, TypeScript, Composition API, Pinia, Vue Router |
| UI and animation | CSS Grid, CSS 3D transforms, Web Animations API, Floating UI |
| Frontend tooling | Vite, vue-tsc |
| Backend | Node.js, Express, TypeScript |
| Real-time communication | Socket.IO and socket.io-client |
| Session authentication | JSON Web Tokens |
| Input validation | Zod |
| Logging | Pino |
| Testing | Jest, ts-jest |
| Deployment configuration | Cloudflare Workers static assets and Render |

## Architecture

The frontend and backend are separate TypeScript applications.

**Lobby operations use REST.** Express handles room creation, room discovery, joining, and host-authorized room deletion.

**Gameplay uses Socket.IO.** Clients send player actions to the server. The server validates the action, applies game rules, updates the room state, and sends the resulting events to players. Dice results and financial settlements are determined on the server.

**A finite-state machine controls turn progression.** Dedicated phases cover rolling, movement, tile events, auctions, jail decisions, rescue, and turn transitions. Action handlers check the current phase and acting player before changing state.

**Public and private data have separate views.** Shared information is broadcast to the room, while personal state and participant-only trade details are delivered through player-specific events. Reconnection snapshots are built for the returning player.

**Presentation timing is managed on the frontend.** Pinia stores coordinate game state, dice animation, logs, and floating feedback so that visual effects can settle before queued results are displayed.

Key modules:

| Module | Responsibility |
| --- | --- |
| [StateMachine.ts](richup.backend/src/state/StateMachine.ts) | Validate turn-phase transitions |
| [SocketEventRouter.ts](richup.backend/src/socket/SocketEventRouter.ts) | Route actions and coordinate game rules |
| [RoomManager.ts](richup.backend/src/state/RoomManager.ts) | Manage rooms, player sessions, and JWTs |
| [GameStateSerializer.ts](richup.backend/src/serialization/GameStateSerializer.ts) | Build public views and personalized snapshots |
| [ConnectionLifecycle.ts](richup.backend/src/modules/ConnectionLifecycle.ts) | Handle disconnects, reconnection deadlines, and lobby reservations |
| [useGameStore.ts](richup.frontend/src/stores/useGameStore.ts) | Coordinate client game state and visual sequences |
| [CenterHub.vue](richup.frontend/src/components/board/CenterHub.vue) | Render the central command area and 3D dice |

## Getting Started

### Requirements

- Node.js **20–24**, matching the backend's declared engine range.
- npm.
- Two separate browser sessions to test multiplayer locally.

### 1. Clone the repository

```sh
git clone https://github.com/terry20230405-code/richup.git
cd richup
```

### 2. Start the backend

In a terminal at the repository root:

```sh
cd richup.backend
npm ci
npm run dev
```

The backend listens on `http://localhost:3000` by default.

Health endpoint: `http://localhost:3000/api/v1/health`.

### 3. Start the frontend

In a second terminal at the repository root:

```sh
cd richup.frontend
npm ci
npm run dev
```

Open `http://localhost:5173`.

Both applications have localhost defaults, so environment files are optional for a default local development setup. If you already have environment files, check that they point to your local backend.

### 4. Play a match

1. Enter a nickname and create a room.
2. Open a separate browser profile or a private browsing window.
3. Join the room using its displayed room number and a different nickname.
4. Start the game as the host after at least two players have joined.
5. Roll the dice and follow the actions offered for the current phase.

The frontend saves its session in `localStorage`. Two normal tabs on the same origin share that storage, so use isolated browser sessions when simulating different players.

## Environment Variables

### Backend

Set these in `richup.backend/.env` or through your hosting provider.

| Variable | Purpose | Local default |
| --- | --- | --- |
| `PORT` | HTTP and Socket.IO server port | `3000` |
| `NODE_ENV` | Runtime environment | Unset during the default development flow |
| `LOG_LEVEL` | Pino log level | `debug` |
| `JWT_SECRET` | Secret used to sign player session tokens | Development-only fallback when not in production |

A production deployment must provide a strong `JWT_SECRET`. The server rejects attempts to issue or verify tokens in production if the secret is missing.

An example configuration is available in [richup.backend/.env.example](richup.backend/.env.example). It uses production settings; adjust them if you copy it for local development.

### Frontend

Set these in `richup.frontend/.env.local` for local overrides, or in the frontend build environment for deployment.

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | REST API base URL, including `/api/v1` | `http://localhost:3000/api/v1` |
| `VITE_SOCKET_URL` | Backend origin used by Socket.IO | `http://localhost:3000` |

Example for a hosted backend:

```dotenv
VITE_API_BASE_URL=https://your-backend.example.com/api/v1
VITE_SOCKET_URL=https://your-backend.example.com
```

Use URLs without trailing slashes. Vite embeds these values at build time, so rebuild the frontend after changing them. Frontend environment variables are visible to browser users; keep secrets on the backend.

The [frontend environment example](richup.frontend/.env.example) contains a sample Render hostname. Replace it with your actual backend URL.

## Development and Verification

Run commands from the corresponding application directory.

| Application | Command | Purpose |
| --- | --- | --- |
| Frontend | `npm run dev` | Start the Vite development server |
| Frontend | `npm run type-check` | Check Vue and TypeScript types |
| Frontend | `npm run build` | Type-check and generate production assets |
| Frontend | `npm run preview` | Preview the frontend production build |
| Backend | `npm run dev` | Start the development server with automatic restarts |
| Backend | `npm run typecheck` | Check backend TypeScript types |
| Backend | `npm test -- --runInBand` | Run the Jest regression suite |
| Backend | `npm run build` | Compile TypeScript into `dist/` |
| Backend | `npm start` | Run the compiled backend |

The [backend regression suite](richup.backend/tests/core.test.ts) covers room lifecycle, reconnection, auction behavior, rent calculation, building limits, trade validation, private data delivery, and bankruptcy rescue and settlement.

The Vite configuration also supports an optional local `@terry/selector-dev` plugin. It is not required for production builds or for running the game.

## Deployment

The repository includes configuration for hosting the frontend and backend separately.

### Backend: Render

[render.yaml](render.yaml) defines a Node.js web service with:

- Root directory: `richup.backend`
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check: `/api/v1/health`
- Production environment variables and a generated `JWT_SECRET`

Deploy the backend first and record its HTTPS origin.

### Frontend: Cloudflare Workers Static Assets

[wrangler.jsonc](wrangler.jsonc) points Cloudflare to `richup.frontend/dist` and enables single-page application fallback.

Set `VITE_API_BASE_URL` and `VITE_SOCKET_URL` to your deployed backend before building. From the repository root:

```sh
npm --prefix richup.frontend ci
npm --prefix richup.frontend run build
npx wrangler deploy
```

The Cloudflare deployment serves the frontend assets. Gameplay still requires the separate, running Node.js backend.

### Current Scope

Room state is stored in the memory of a single backend process. There is no database or Redis integration.

- Restarting or redeploying the backend clears active rooms and matches.
- Reconnection restores a session only while its room still exists in that backend process.
- Running multiple independent backend instances would require shared state and a coordinated Socket.IO deployment.
- Hosting that suspends or restarts the backend can interrupt active games.

## Project Structure

```text
richup/
├── richup.frontend/
│   └── src/
│       ├── api/                  # Lobby REST client
│       ├── components/
│       │   ├── board/            # Board, dice, tile details, and feedback
│       │   └── panels/           # Players, trading, and card controls
│       ├── pages/                # Lobby and game screens
│       ├── services/             # Room-session orchestration
│       ├── socket/               # Typed actions, listeners, and session storage
│       ├── stores/               # Pinia state
│       └── types/                # Client models and event contracts
├── richup.backend/
│   ├── src/
│   │   ├── config/               # Rules and tile definitions
│   │   ├── modules/              # Individual game systems
│   │   ├── routes/               # REST endpoints
│   │   ├── serialization/        # Public and private state views
│   │   ├── socket/               # Action routing, guards, and emitters
│   │   ├── state/                # Sessions, rooms, and the state machine
│   │   ├── types/                # Server models and event contracts
│   │   └── utils/                # Logging, timers, randomness, and errors
│   └── tests/                    # Jest regression tests
├── render.yaml                   # Backend deployment configuration
└── wrangler.jsonc                # Frontend deployment configuration
```
