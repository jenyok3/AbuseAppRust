# AbuseApp

AbuseApp is a desktop dashboard for managing Telegram/Chrome account farms. The UI runs on React + Vite, and the desktop shell uses Tauri. The current data source is **localStorage** (single-user, local-only). The server API still exists but the UI does not call `/api/*`.

## Tech Stack
- Client: React + Vite + Tailwind + Wouter
- Desktop: Tauri (Rust)
- Server: Express + Drizzle (optional, not used by UI now)

## Local Data
The UI reads/writes data from localStorage:
- Projects, accounts, daily tasks, logs
- Settings (also synced to Tauri backend)
- `client/src/lib/tauri-api.ts` data methods (`getAccounts`, `getRecentActions`, `getDailyTasks`) use the same localStorage source to avoid data divergence.

## Development
Install dependencies:
```
npm install
```

Run the app (client + server via Vite middleware):
```
npm run dev
```

Run tests:
```
npm test
```

## Production Build
Build client + server bundle:
```
npm run build
```

Start server (serves built client):
```
npm run start
```

## Tauri
Run Tauri dev:
```
npm run tauri:dev
```

Build Tauri app:
```
npm run tauri:build
```

## Environment Flags
- `ENABLE_API=1` enables `/api/*` routes on the server. By default API is disabled and the app runs in local-only mode.
- `SEED_DATABASE=1` enables API seed data on server start.

## Notes
- The API is still available but the UI does not depend on `/api/*`.
- SQLite file `abuseapp.db` is ignored in `.gitignore`.
