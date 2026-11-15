# Moongram — Proximity Social App

Text-only, ephemeral social. Chat with people physically near you. Chats auto-disconnect when you move apart.

---

## Stack

| Layer      | Tech                            |
|------------|---------------------------------|
| Frontend   | React Native (Expo)             |
| Backend    | Node.js + Express               |
| Real-time  | Socket.io                       |
| Database   | PostgreSQL + PostGIS             |
| Cache      | Redis                           |
| Auth       | Firebase Auth (Phone OTP)       |

---

## Project Structure

```
proximity-app/
├── backend/
│   └── src/
│       ├── server.js              # Entry point
│       ├── db/
│       │   ├── pg.js              # PostgreSQL pool
│       │   ├── redis.js           # Redis client + helpers
│       │   └── schema.sql         # Full DB schema
│       ├── middleware/
│       │   └── auth.js            # Firebase + JWT middleware
│       ├── routes/
│       │   ├── auth.js            # POST /auth/verify
│       │   ├── users.js           # Profile, nearby feed
│       │   ├── pings.js           # Send / respond to pings
│       │   └── safety.js          # Block, report
│       ├── sockets/
│       │   ├── index.js           # Socket.io bootstrap
│       │   ├── location.js        # Location heartbeat handler
│       │   └── chat.js            # Messaging, extend, leave
│       └── jobs/
│           └── geofenceMonitor.js # Distance check every 5s
└── frontend/
    └── src/
        ├── App.jsx                # Navigation root
        ├── store/
        │   └── useAppStore.js     # Zustand global store
        ├── utils/
        │   └── api.js             # Axios HTTP client
        ├── hooks/
        │   ├── useSocket.js       # Socket.io singleton + event wiring
        │   └── useLocation.js     # Expo location heartbeat
        └── screens/
            ├── Onboarding/
            │   ├── PhoneVerify.jsx
            │   └── SetProfile.jsx
            ├── NearbyFeed.jsx     # Main feed
            ├── PingModal.jsx      # Incoming ping overlay
            └── Chat/
                └── ChatScreen.jsx # Messaging UI
```

---

## Backend Setup

### 1. Prerequisites

```bash
# PostgreSQL 14+ with PostGIS
# Redis 6+
# Node.js 18+
```

### 2. Start local services

The app is designed to run with a local PostgreSQL + Redis stack. You can bring those up with Docker:

```bash
docker compose up -d postgres redis
```

If you prefer a bare-metal setup instead of Docker:

```bash
createdb proximity_db
psql proximity_db < src/db/schema.sql
```

### 3. Environment

```bash
cp .env.example .env
# Fill in all values
```

### 4. Firebase Admin SDK

- Go to Firebase Console → Project Settings → Service Accounts
- Generate a new private key (JSON)
- Copy `project_id`, `private_key`, `client_email` into `.env`

### 5. Run

```bash
npm install
npm run dev      # development (nodemon)
npm start        # production
```

## Deploy Backend to Railway

Create a Railway project from the GitHub repository and add a backend service with its root directory set to `/backend`. Railway will use `backend/railway.json` to run `npm start` and check `/health`.

Add a PostgreSQL service that supports PostGIS, then set these variables on the backend service:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Railway PostgreSQL connection URL |
| `REDIS_URL` | Upstash Redis TLS URL (`rediss://...`) |
| `JWT_SECRET` | A unique random secret of at least 32 characters |
| `FIREBASE_PROJECT_ID` | Firebase service-account project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase service-account client email |
| `FIREBASE_PRIVATE_KEY` | Firebase service-account private key |

Enter secrets in Railway's Variables page only; never commit them or paste them into chat. Confirm that PostGIS is available on the selected PostgreSQL service, since the schema uses geographic queries.

After deploying, generate a Railway public domain. Set `EXPO_PUBLIC_API_URL` in the frontend build environment to `https://YOUR_RAILWAY_DOMAIN/api` and restart Expo or rebuild the app so the URL is included. The current phone screen still uses a local demo code; real Firebase phone sign-in on the mobile client must be completed before public release. The backend rejects demo-code login when `NODE_ENV=production`.

---

## Frontend Setup

### 1. Environment

Create `frontend/.env`:
```
EXPO_PUBLIC_API_URL=http://YOUR_SERVER_IP:3001/api
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
```

### 2. Firebase (React Native)

- Download `google-services.json` (Android) → `frontend/android/app/`
- Download `GoogleService-Info.plist` (iOS) → `frontend/ios/`

### 3. Run

```bash
npm install
npx expo start
```

---

## Socket.io Event Reference

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `location:update` | `{ lat, lng }` | GPS heartbeat (every 8s) |
| `location:background` | — | App backgrounded |
| `location:foreground` | — | App foregrounded |
| `chat:join` | `{ sessionId }` | Join chat room after accept |
| `chat:message` | `{ sessionId, text }` | Send a message |
| `chat:extend_vote` | `{ sessionId }` | Vote to extend chat |
| `chat:leave` | `{ sessionId }` | Manually end chat |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `ping:incoming` | `{ pingId, senderId, senderName, senderTags }` | Someone pinged you |
| `ping:accepted` | `{ sessionId, partnerId, partnerName, ... }` | Your ping was accepted |
| `chat:message` | `{ id, senderId, text, sentAt }` | Incoming message |
| `chat:history` | `{ messages[] }` | Backfill on reconnect |
| `chat:distance_warning` | `{ distanceM, gracePeriodMs }` | Moving apart warning |
| `chat:distance_ok` | — | Back within range |
| `chat:extend_requested` | `{ byUserName }` | Partner wants to extend |
| `chat:extended` | `{ expiresAt }` | Both agreed, 10 more min |
| `chat:ended` | `{ reason }` | Chat terminated |

### Disconnect reasons

| Reason | Meaning |
|---|---|
| `moved_apart` | Grace period expired, too far |
| `partner_disconnected` | Other user lost connection |
| `partner_offline` | Location TTL expired in Redis |
| `user_left` | Manual leave |
| `extension_expired` | Extended 10 min window ended |

---

## REST API Reference

### Auth
- `POST /api/auth/verify` — Exchange Firebase ID token for JWT
- `GET /api/auth/vibe-tags` — List of available vibe tags

### Users
- `PUT /api/users/profile` — Set/update name, tags, availability
- `PUT /api/users/fcm-token` — Register push notification token
- `GET /api/users/nearby?lat=&lng=&radius=` — Nearby users (PostGIS)
- `PUT /api/users/status` — Set available/away
- `DELETE /api/users/account` — Full account deletion

### Pings
- `POST /api/pings` — Send ping `{ targetUserId }`
- `POST /api/pings/:id/respond` — Accept/decline `{ accepted: bool }`

### Safety
- `POST /api/safety/block` — Block user `{ targetUserId }`
- `POST /api/safety/report` — Report user `{ targetUserId, reason, sessionId? }`

---

## Privacy Design

- Phone numbers are **bcrypt-hashed** immediately — never stored raw
- Exact GPS coordinates are **never sent to clients** — only rounded `distanceM`
- Messages are **purged from DB** immediately on session disconnect
- Blocked users are **excluded at the SQL level** (not filtered client-side)
- Location heartbeat has a **30s TTL in Redis** — stale = offline

---

## MVP Build Phases

**Phase 1 (Weeks 1–4):** Auth, profile, location, nearby feed
**Phase 2 (Weeks 5–8):** Socket.io, ping flow, chat, geofence monitor
**Phase 3 (Weeks 9–12):** Moderation, extend chat, push notifications, polish
