# AbuseApp - Account Farm Management Dashboard

## Overview

AbuseApp is a web-based dashboard for managing Telegram and Chrome account farms. It provides tools for launching campaigns across multiple accounts, tracking account health (live vs blocked), managing daily tasks, and viewing activity logs. The application features a dark cyber-themed UI with purple accents, built as a full-stack TypeScript application.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state caching and synchronization
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom dark theme (CSS variables for theming)
- **Animations**: Framer Motion for smooth transitions
- **Charts**: Recharts for statistics visualization (donut/pie charts)
- **Build Tool**: Vite with HMR support

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript (tsx for direct execution)
- **API Pattern**: RESTful endpoints defined in `shared/routes.ts` with Zod validation
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Session Management**: express-session with connect-pg-simple for PostgreSQL session storage

### Data Layer
- **Database**: PostgreSQL (required via DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` - defines tables for projects, accounts, daily_tasks, logs, and settings
- **Migrations**: Drizzle Kit (`drizzle-kit push` for schema sync)
- **Type Safety**: drizzle-zod generates Zod schemas from database tables

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # UI components (panels, sidebar)
│   ├── pages/           # Route pages (Dashboard, Accounts, Settings)
│   ├── hooks/           # Custom React hooks (use-dashboard, use-toast)
│   └── lib/             # Utilities (queryClient, utils)
├── server/              # Express backend
│   ├── index.ts         # Server entry point
│   ├── routes.ts        # API route handlers
│   ├── storage.ts       # Database operations interface
│   └── db.ts            # Database connection
├── shared/              # Shared code between client/server
│   ├── schema.ts        # Drizzle database schema
│   └── routes.ts        # API route definitions with Zod schemas
└── migrations/          # Database migrations (generated)
```

### API Design
Routes are defined centrally in `shared/routes.ts` with:
- HTTP method and path
- Input validation schemas (Zod)
- Response type definitions
- Used by both frontend hooks and backend handlers for type safety

### Key Entities
- **Projects**: Campaign containers (Telegram or Chrome type)
- **Accounts**: Individual accounts linked to projects with status tracking
- **Daily Tasks**: Checklist items with completion state
- **Logs**: Activity logging with timestamps
- **Settings**: Configuration (accounts per batch, folder paths)

## External Dependencies

### Database
- **PostgreSQL**: Primary data store (connection via DATABASE_URL env var)
- **connect-pg-simple**: Session storage in PostgreSQL

### Frontend Libraries
- **@tanstack/react-query**: Data fetching and caching
- **recharts**: Statistics charts
- **framer-motion**: Animations
- **date-fns**: Date formatting
- **wouter**: Client-side routing
- **Radix UI**: Accessible UI primitives (via shadcn/ui)

### Development Tools
- **Vite**: Frontend build and dev server
- **esbuild**: Production server bundling
- **Drizzle Kit**: Database migrations
- **tsx**: TypeScript execution for Node.js

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**: Error overlay in development
- **@replit/vite-plugin-cartographer**: Development tooling
- **@replit/vite-plugin-dev-banner**: Development indicator