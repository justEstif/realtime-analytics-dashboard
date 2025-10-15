# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A real-time analytics dashboard built as a learning project to explore data-intensive backend architecture. The system ingests high-volume event data, processes it asynchronously, and displays real-time insights through a server-rendered UI powered by HTMX.

## Development Environment

- **Container Management**: Podman (not Docker)
- **Environment Management**: mise (handles environment variables, tasks, and runtime)
- **Runtime**: Bun (latest version managed by mise)
- **Package Manager**: Bun

### Environment Variables

Defined in `mise.toml`:

- PostgreSQL configuration: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`
- Container names: `POSTGRES_CONTAINER_NAME`, `POSTGRES_VOLUME_NAME`

### Mise Tasks

Custom mise tasks follow Fish shell conventions. See `docs/mise-tasks-pattern.md` for task creation guidelines.

### JSON:API Specification

All API endpoints follow the [JSON:API specification](https://jsonapi.org/). See `docs/jsonapi-spec.md` for implementation details and examples.

## Common Commands

```bash
# Install dependencies
bun install

# Development (runs both servers in parallel)
bun run dev

# Run backend server only (with hot reload)
bun run dev:js

# Run Tailwind CSS watcher only
bun run dev:css
```

The application runs on http://localhost:3000

## Architecture

### Core Stack

- **Runtime**: Bun
- **Web Framework**: Hono (with JSX renderer for server-side rendering)
- **Frontend**: HTMX + TailwindCSS + DaisyUI
- **Database**: PostgreSQL (not yet integrated)
- **Planned**: BullMQ + Redis for background job processing

### Application Structure

```
src/
├── index.tsx              # Main application entry, middleware setup, server config
├── routes/                # Route definitions
│   ├── index.tsx         # Page routes (uses JSX renderer)
│   └── api.ts            # API routes (JSON responses, no renderer)
├── views/                # UI components (Hono JSX)
│   ├── layouts/          # Layout components (BaseLayout with HTML shell)
│   ├── pages/            # Full page components
│   └── partials/         # Reusable UI fragments for HTMX swaps
├── services/             # Business logic layer
│   └── events.ts         # Event validation, storage, retrieval
├── workers/              # Background job processors (planned)
└── styles/
    ├── input.css         # Tailwind entry point
    └── output.css        # Generated (git-ignored)
```

### Key Architectural Patterns

**Event Flow Pipeline** (planned): Submission → Validation → Queue → Processing → Storage → Presentation

**Rendering Strategy**:

- JSX renderer middleware applies BaseLayout to page routes
- API routes return JSON directly (no layout)
- HTMX handles partial updates via HTML fragments from partials/

**TypeScript Configuration**:

- Strict mode enabled
- JSX mode: `react-jsx` with import source `hono/jsx`

### Current Implementation Status

The project is in early development:

- ✅ Basic Hono server with hot reload
- ✅ Server-side JSX rendering with layouts
- ✅ TailwindCSS + DaisyUI integration
- ✅ HTMX setup in base layout
- ✅ Route structure (pages + API)
- ✅ Event service interface defined
- ⏳ Database integration (PostgreSQL setup in mise.toml, not connected)
- ⏳ Event ingestion endpoint (stubbed in api.ts)
- ⏳ Background workers (README only)
- ⏳ Real-time updates (SSE/WebSocket)
- ⏳ Caching layer (Redis)

## Important Implementation Details

### Middleware Order Matters

The JSX renderer middleware in `index.tsx` wraps all routes with BaseLayout. API routes that need to return JSON should be registered on a separate Hono instance without the renderer middleware (already done for `/api` routes).

### Static File Serving

CSS is served from `./src/styles/*` via `serveStatic` middleware. The output.css file is git-ignored and must be generated via the Tailwind watcher.

### Database Connection

PostgreSQL configuration is present in mise.toml but not yet connected to the application. When implementing database features, create a connection pool using the environment variables provided by mise.

### Event Service Pattern

The `EventService` class in `src/services/events.ts` defines the interface for event operations but methods throw "Not implemented" errors. Implement these methods when adding database integration.

### Real-Time Updates

HTMX is loaded in the BaseLayout. For real-time dashboard updates, implement Server-Sent Events endpoints and use HTMX's SSE extension or polling with `hx-trigger`.

## Project Goals

This is a **learning project** focused on understanding:

- Queue-based architectures and worker patterns
- Time-series data modeling and optimization
- Real-time communication (SSE/WebSockets)
- Caching strategies for analytics queries
- Server-driven UI updates with HTMX (no SPA complexity)

Refer to `docs/project-details.md` for comprehensive feature descriptions and architectural rationale.
