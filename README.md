# Tournament Manager (Next.js & MongoDB)

A premium-minimalist web application for creating, organizing, and running tournaments. It supports multiple formats (Group Stage, Round Robin, Knockout/Brackets), handles complex real-time tournament logic (tiebreak resolutions, player rename cascades, disqualifications, and match abandonment), and is designed for secure, containerized deployment on a shared Traefik proxy VPS.

---

## 🏗️ System Architecture & Tech Stack

This project is built using a modern JavaScript/Node.js stack designed for scalability, zero runtime build dependencies, and minimal host resource usage:

*   **Core Framework**: [Next.js 14](file:///Users/FaozulRafi/Projects/tournament_manager_next/package.json#L16) (using App Router for routes and API handlers)
*   **UI Components**: React 18 with [Lucide React](file:///Users/FaozulRafi/Projects/tournament_manager_next/package.json#L14) icons
*   **Styling**: [Tailwind CSS v3](file:///Users/FaozulRafi/Projects/tournament_manager_next/package.json#L26) & PostCSS
*   **Database Layer**: [Mongoose](file:///Users/FaozulRafi/Projects/tournament_manager_next/package.json#L15) + MongoDB 8
*   **Authentication**: JWT-based session security via [jsonwebtoken](file:///Users/FaozulRafi/Projects/tournament_manager_next/package.json#L13) and [bcryptjs](file:///Users/FaozulRafi/Projects/tournament_manager_next/package.json#L12)
*   **Transactional Mailer**: [Nodemailer](file:///Users/FaozulRafi/Projects/tournament_manager_next/package.json#L17) with custom dynamic HTML/text templates
*   **Deployment**: Multi-stage lightweight [Dockerfile](file:///Users/FaozulRafi/Projects/tournament_manager_next/Dockerfile) and [docker-compose.yml](file:///Users/FaozulRafi/Projects/tournament_manager_next/docker-compose.yml) routing via a shared external Traefik proxy.

### Network Topology

```
Internet ──► Traefik (TLS + ACME) ──[shared network 'traefik']──► App Service (Port 3000)
                                                                 │
                                                       [internal bridge network]
                                                                 ▼
                                                       MongoDB Service (Port 27017)
```

---

## 🗄️ Database Schemas & Data Model

### 1. User Model
Located in [User.js](file:///Users/FaozulRafi/Projects/tournament_manager_next/src/models/User.js). Defines administrator and viewer credentials.

*   `email` (String, required, unique, indexed, lowercase): The user email.
*   `passwordHash` (String, required): Bcrypt hash of the user password.
*   `role` (String, enum: `['admin', 'viewer']`, default: `'admin'`): Controls write access to tournament state.
*   `resetToken` (String, default: `null`): SHA-256 hash of the password reset token.
*   `resetTokenExpiry` (Date, default: `null`): Expiration timestamp for password reset.
*   `createdAt` (Date, default: `Date.now`): Timestamp of creation.

---

### 2. Tournament Model
Located in [Tournament.js](file:///Users/FaozulRafi/Projects/tournament_manager_next/src/models/Tournament.js). Encapsulates the tournament's configuration, stages, current matches, stand-alone standings, history, and tie-breaks.

#### Embedded Sub-Schemas:
*   **`matchSchema`**: Represents an individual match.
    *   `round` (Number, required)
    *   `matchNumber` (Number, required)
    *   `player1` (String, nullable)
    *   `player2` (String, nullable)
    *   `player1Score` (Number, nullable)
    *   `player2Score` (Number, nullable)
    *   `winner` (String, nullable)
    *   `status` (String, enum: `['pending', 'completed', 'abandoned']`, default: `'pending'`)
    *   `stageType` (String, enum: `['group', 'round-robin', 'knockout', 'semifinal', 'final']`)
    *   `abandoned` (Boolean, default: `false`)
    *   `groupId` (String, nullable)

*   **`groupSchema`**: Holds group-specific boundaries.
    *   `groupId` (String, required)
    *   `name` (String, required)
    *   `players` ([String]): List of player names in the group.
    *   `round` (Number, required): The starting round number for this group's matches.

*   **`standingSchema`**: Used to cache real-time standings.
    *   `player` (String, required)
    *   `played` (Number)
    *   `wins` / `draws` / `losses` (Numbers)
    *   `goalsFor` / `goalsAgainst` (Numbers)
    *   `points` (Number): Aggregated standings points.
    *   `groupId` (String, nullable)

*   **`renameHistorySchema`**: Audits player renames.
    *   `oldName` / `newName` (Strings)
    *   `renamedAt` (Date)
    *   `renamedBy` (String): Admin user email.

*   **`stageSchema`**: Traces the tournament progression step.
    *   `stageNumber` (Number)
    *   `label` (String): e.g., "Group Stage", "Quarter-Final", "Final".
    *   `type` (String, enum: `['round-robin', 'group', 'knockout']`)
    *   `round` (Number): The absolute starting round index.
    *   `players` ([String])
    *   `groups` ([`groupSchema`])
    *   `playerCount` (Number)
    *   `advancingCount` (Number): Target count of players qualifying for the next stage.
    *   `status` (String, enum: `['pending', 'active', 'awaiting-next-format', 'completed']`)

#### Main Schema Fields:
*   `name` (String, required): Name of the tournament.
*   `players` ([String]): Initial collection of player names.
*   `initialFormat` (String, enum: `['round-robin', 'group']`)
*   `numberOfGroups` (Number, nullable)
*   `status` (String, enum: `['setup', 'in-progress', 'completed']`)
*   `currentStageIndex` (Number, default: `0`)
*   `stages` ([`stageSchema`])
*   `matches` ([`matchSchema`])
*   `standings` ([`standingSchema`])
*   `renameHistory` ([`renameHistorySchema`])
*   `tieBreaks`: List of pending or resolved tiebreak structures:
    *   `stageNumber` (Number)
    *   `groupId` (String)
    *   `candidates` ([String])
    *   `requiredCount` (Number)
    *   `resolved` (Boolean)
    *   `selected` ([String])
*   `disqualifiedPlayers` ([String])
*   `createdBy` (ObjectId referencing `User`)
*   `champion` (String, nullable)

---

## ⚙️ Core Business Logic & Rules

Most of the pure tournament calculation helpers are decoupled from the database and are contained in [src/lib/tournament.js](file:///Users/FaozulRafi/Projects/tournament_manager_next/src/lib/tournament.js).

### 1. Round-Robin Match Generation (Berger Circle Rotation)
For a set of players \(N\), round-robin fixtures are generated by rotating players around a fixed pivot (the first player).
*   If the player count is odd, a dummy `'BYE'` player is added.
*   In every round \(r\), player 1 plays the last player, and others are matched symmetrically.
*   The rotation shifts all players except the pivot by one index.
*   Matches involving `'BYE'` are discarded before persistence to prevent unnecessary fixture scheduling.

### 2. Standings & Point Calculations
For round-robin and group stages, standing rankings are calculated from completed and abandoned matches:
*   **Win**: +3 points
*   **Draw**: +1 point
*   **Loss**: 0 points
*   **Abandoned Match**: Both participating players receive a penalty of **-2 points**, and the match is marked as completed/abandoned with no scores.
*   **Goal Difference (GD)**: Calculated as \(\text{goalsFor} - \text{goalsAgainst}\).
*   **Sorting Hierarchy**:
    1.  Highest points (`points`)
    2.  Highest goal difference (`GD`)
    3.  Highest goals scored (`goalsFor`)

### 3. Player Disqualifications (DQ)
Admin users can dynamically disqualify and reinstate players during the tournament:
*   Disqualified players are saved in `disqualifiedPlayers`.
*   **Knockout Stages**: If a player is disqualified, their opponent in the active bracket match automatically advances to the next round, regardless of the match result. If both are disqualified, no one advances (an empty slot is created).
*   **Group/Round-Robin Stages**: Disqualified players are excluded from qualifying/advancing to the next stage, even if they finish in the top seeding slots of their standings.

### 4. Player Rename Cascades
Renaming a player updates all references recursively within the tournament document to maintain referential integrity:
*   Updates the master `players` list.
*   Cascades to all stages (including `players` list and inside individual `groups`).
*   Cascades to all historical and scheduled `matches` (updating `player1`, `player2`, and `winner`).
*   Updates all active `standings` rows.
*   Applies changes to current `tieBreaks` (both `candidates` and `selected`).
*   Updates `champion` if the tournament is completed.
*   Tracks the change in `renameHistory` with the old name, new name, date, and admin email.

### 5. Stage Advancement Flow
Advancing a stage calculates qualifiers, resolves tie-breaks, and builds the next format:
1.  **Check Match Completion**: All matches in the active stage must have status `'completed'` or `'abandoned'`.
2.  **Derive Advancing Players**:
    *   For **Group Stages**, the top 2 non-disqualified players from each group advance.
    *   If a tie occurs on points, goal difference, and goals scored at the cutoff line (e.g., player 2 and player 3 are identical in standings), a pending `tieBreak` is created.
    *   **Tiebreaks**: Advancement is blocked until the admin explicitly selects which candidate(s) should advance. Once resolved, the selection is inlined, and advancement can proceed.
3.  **Construct Next Stage**:
    *   If **\(\le 4\)** players are advancing, the system automatically builds a single-elimination knockout bracket (Semi-Finals & Finals).
    *   If **\(> 4\)** players are advancing, the active stage status transitions to `'awaiting-next-format'`. The administrator must choose the next format (`'group'`, `'round-robin'`, or `'knockout'`) and the number of groups (if `'group'` is chosen).
    *   Players are dynamically distributed into the new round matches using round-robin rotation or elimination bracket structures.

---

## 📡 API Endpoint Catalog

All routes are located under [src/app/api](file:///Users/FaozulRafi/Projects/tournament_manager_next/src/app/api). Write requests require authentication headers (`Authorization: Bearer <JWT_token>`).

### Auth Endpoints

#### `POST /api/auth/register`
Creates a new user account.
*   **Request Body**: `{ "email": "admin@example.com", "password": "securepassword" }`
*   **Response**: `201 Created` on success. Hashes passwords using bcrypt (cost factor: 12).

#### `POST /api/auth/login`
Authenticates a user and issues a JWT.
*   **Request Body**: `{ "email": "admin@example.com", "password": "securepassword" }`
*   **Response**: `200 OK` with token and user object. Employs a dummy bcrypt check on empty users to mitigate timing attacks (preventing user enumeration).

#### `POST /api/auth/forgot-password`
Initiates a password reset flow.
*   **Request Body**: `{ "email": "admin@example.com" }`
*   **Response**: `200 OK` (always returns success to prevent user enumeration). Generates a random 32-byte hex token, hashes it with SHA-256 for DB storage, and dispatches a reset link via Nodemailer.

#### `POST /api/auth/reset-password`
Resets password using a valid token.
*   **Request Body**: `{ "token": "raw_token", "password": "new_secure_password" }`
*   **Response**: `200 OK` on successful hash update.

---

### Tournament Endpoints

#### `GET /api/tournaments`
Lists all tournaments in the system.
*   **Response**: JSON array sorted by `createdAt` descending.

#### `POST /api/tournaments` (Admin Only)
Creates a new tournament.
*   **Request Body**:
    ```json
    {
      "name": "Summer Cup",
      "players": ["Alice", "Bob", "Charlie", "David"],
      "format": "round-robin", 
      "numberOfGroups": null,
      "randomOrder": true
    }
    ```
*   **Response**: `201 Created` with the initialized tournament object.

#### `GET /api/tournaments/[id]`
Retrieves full details of a specific tournament.
*   **Response**: `200 OK` containing stages, matches, standings, and disqualifications.

#### `PATCH /api/tournaments/[id]` (Admin Only)
Renames a player across the entire tournament.
*   **Request Body**: `{ "oldName": "Alice", "newName": "Alice Smith" }`
*   **Response**: `200 OK` with the modified tournament document.

#### `POST /api/tournaments/[id]/disqualify` (Admin Only)
Disqualifies or reinstates a player.
*   **Request Body**: `{ "player": "Alice", "action": "disqualify" }` // Action can be 'disqualify' or 'reinstate'
*   **Response**: `200 OK` with updated status.

#### `POST /api/tournaments/[id]/matches/[matchNumber]/result` (Admin Only)
Saves or updates a match score.
*   **Request Body**: `{ "player1Score": 3, "player2Score": 1 }`
*   **Response**: `200 OK`. Automatically recalculates standings, and checks if this was the tournament final match (setting `champion`, `status: completed` and `completedAt`).

#### `POST /api/tournaments/[id]/matches/[matchNumber]/abandon` (Admin Only)
Abandons a match.
*   **Response**: `200 OK`. Rebuilds standings, applying the -2 points penalty to both players.

#### `POST /api/tournaments/[id]/tiebreak` (Admin Only)
Resolves a group standings tiebreak by manual selection.
*   **Request Body**: `{ "stageNumber": 1, "groupId": "s1-g0", "selected": ["Alice"] }`
*   **Response**: `200 OK`. Marks the tiebreak resolved.

#### `POST /api/tournaments/[id]/advance` (Admin Only)
Triggers calculation and advancement to the next stage.
*   **Response**: `200 OK`. Transitions current stage to `'completed'` and builds the next format. Returns `awaitingFormatSelection: true` if the advancing player count is greater than 4.

#### `POST /api/tournaments/[id]/set-next-format` (Admin Only)
Explicitly selects the next format when advancing more than 4 players.
*   **Request Body**: `{ "nextFormat": "group", "numberOfGroups": 2 }` // nextFormat: 'group' | 'round-robin' | 'knockout'
*   **Response**: `200 OK` with the newly generated active stage.

---

### Utility & Dev Endpoints

#### `GET /api/health`
Liveness probe.
*   **Response**: `200 OK` `{ "ok": true }` if MongoDB connection is active; `503 Service Unavailable` on database outage. Used by Docker health check.

#### `GET /api/dev/email-preview` (Development Only)
Renders Nodemailer transaction emails directly in the browser.
*   **Query Params**: `?type=password-reset&format=html` (Types: `password-reset`, `verify-email`, `welcome`, `tournament-update`. Formats: `html`, `text`).
*   **Response**: Renders raw HTML or text. Returns `404` in production mode.

---

## 📂 Directory & File Structure Map

```
├── .env.local.example           # Example local configuration file
├── .gitignore                   # Git exclusion rules
├── AGENTS.md                    # Agent directives and engineering guidelines
├── Dockerfile                   # Multi-stage optimized Node runtime setup
├── docker-compose.yml           # Production service mapping (App + Mongo + Traefik)
├── next.config.js               # Next.js bundler config
├── package.json                 # Node modules, project metadata, scripts
├── tailwind.config.js           # Tailwind design tokens and themes
├── public/                      # Static assets (images, icons)
├── scripts/
│   └── deploy.sh                # VPS deployment automation shell script
└── src/
    ├── app/                     # Page routes & API route handlers
    │   ├── api/                 # Endpoint logic (auth, tournaments, dev)
    │   ├── layout.js            # App shell, main HTML structure, fonts
    │   ├── globals.css          # CSS styles, color tokens, visual utilities
    │   ├── page.jsx             # Homepage displaying all tournaments
    │   ├── login/               # Admin login panel UI
    │   ├── register/            # Admin registration panel UI
    │   ├── forgot-password/     # Forgot password request UI
    │   ├── reset-password/      # Reset password token confirmation UI
    │   ├── create/              # Tournament setup form (Admin only)
    │   └── tournaments/
    │       └── [id]/            # Tournament view, standings, match grid, admin tools
    ├── components/
    │   └── Navbar.jsx           # Global sticky top navigation bar
    ├── lib/                     # Server utility functions
    │   ├── auth.js              # Server auth checks, token signing & verification
    │   ├── clientAuth.js        # Browser localStorage helpers & token checks
    │   ├── db.js                # Cached MongoDB connection management
    │   ├── mailer.js            # Nodemailer transport creation & send logic
    │   ├── tournament.js        # Fixture generation, standings calculations
    │   └── email/               # Transactional email builder templates
    └── models/                  # Mongoose models
        ├── User.js              # User schema
        └── Tournament.js        # Tournament schema (matches, stages, standings)
```

---

## 🛠️ Local Development Setup

### Prerequisites
*   Node.js 20+
*   MongoDB Instance (local or Atlas)

### Steps

1.  **Clone the Repository**:
    ```bash
    git clone <repository_url>
    cd tournament_manager_next
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Copy [.env.local.example](file:///Users/FaozulRafi/Projects/tournament_manager_next/.env.local.example) to `.env.local`:
    ```bash
    cp .env.local.example .env.local
    ```
    Open `.env.local` and define:
    *   `MONGODB_URI`: Connection string (e.g., `mongodb://localhost:27017/tournament`)
    *   `JWT_SECRET`: A secure random string for JWT signatures.
    *   `NEXT_PUBLIC_APP_URL`: Local URL (e.g., `http://localhost:3000`)
    *   *(Optional)* SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) to send real emails.

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Open `http://localhost:3000` in your browser.

---

## 🐳 VPS Production Deployment (Docker + Traefik)

The project includes configuration files optimized for a virtual private server (VPS) running a Traefik edge proxy.

### Setup Deployment Environment
1.  On your VPS, copy `.env.local.example` to `.env` (located in the project root directory).
2.  Set `APP_DOMAIN` to your domain name (e.g., `tournaments.mydomain.com`).
3.  Set `MONGO_USER` and `MONGO_PASS` to secure credentials. These will be configured automatically when MongoDB starts.
4.  Configure `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, and SMTP options.
5.  Set `APP_PREFIX` if you want to isolate containers on the host (defaults to `tournament`).
6.  Ensure a Traefik proxy is running on the host, attached to the docker network defined by `TRAEFIK_NETWORK` (defaults to `traefik`).

### Run Deployment Script
Execute the deployment script [deploy.sh](file:///Users/FaozulRafi/Projects/tournament_manager_next/scripts/deploy.sh):
```bash
./scripts/deploy.sh
```

#### What `deploy.sh` Does:
1.  **Validates Environment**: Verifies `.env` exists and checks required parameters.
2.  **Pull Code**: Runs `git pull --ff-only` to ensure safe, merge-free repository syncing on the host.
3.  **Validate Docker Compose**: Validates YAML configurations before initiating service builds.
4.  **Build and Run**: Rebuilds the custom Next.js image using Docker cache layers, and performs a zero-downtime container replace (`docker compose up --build -d --remove-orphans`).
5.  **Health Check Gate**: Blocks completion until the application liveness endpoint `/api/health` returns HTTP status `200`. If it fails within 3 minutes, the script prints recent logs and exits with error code `1`.
6.  **Cleanup**: Safely prunes dangling Docker images (`docker image prune -f`) without affecting other projects running on the host.
