# Database Setup

This document provides a high-level overview of the database stack, configuration, and migration workflow.

## Technology Stack

- **Database**: PostgreSQL (managed via Podman)
- **ORM**: Drizzle ORM for type-safe queries
- **Migrations**: Drizzle Kit for schema version control
- **Runtime Driver**: Bun's native PostgreSQL driver (`bun:sql`)
- **CLI Driver**: `postgres` npm package (for migrations only)

## Mise Database Tasks

| Task     | Command            | Description                                    |
| -------- | ------------------ | ---------------------------------------------- |
| Generate | `mise db:generate` | Create migration SQL files from schema changes |
| Migrate  | `mise db:migrate`  | Apply pending migrations to the database       |
| Push     | `mise db:push`     | Push schema directly (dev only, no migrations) |
| Studio   | `mise db:studio`   | Launch Drizzle Studio GUI for exploration      |

All tasks follow Fish shell conventions. See `docs/mise-tasks-pattern.md` for task guidelines.

## Driver Details

- Runtime: Bun Native SQL

- Migrations: postgres npm Package

## Related Documentation

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle Kit Migrations Guide](https://orm.drizzle.team/kit-docs/overview)
- [Mise Task Pattern](./mise-tasks-pattern.md)
- [JSON:API Specification](./jsonapi-spec.md)
