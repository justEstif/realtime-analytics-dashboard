## Phase 3: Event Ingestion Endpoint Implementation Plan

### 1. Install Dependencies

- Install zod package for validation
- Install @hono/zod-validator for Hono integration

### 2. Create Zod Validation Schema

- Create src/validators/event.validator.ts
- Define Zod schema matching database schema:
  - event_type: required string (max 255 chars)
  - metadata: required object (Record<string, unknown>)
  - timestamp: optional ISO date string (defaults to now)
- Export validator for use with Hono middleware

### 3. Update EventService (src/services/events.ts)

- Replace stub validateEvent() with Zod-based validation
- Implement createEvent() method:
  - Use Drizzle ORM to insert into events table
  - Import db from src/db/index.ts
  - Import schema types from src/db/schema.ts
  - Handle database errors appropriately
  - Return inserted event with generated ID

### 4. Implement API Endpoint (src/routes/api.ts)

- Create POST /api/events route
- Use @hono/zod-validator middleware for request validation
- Call EventService.createEvent() for storage
- Return responses:
  - 201 Created: { success: true, event: {...} }
  - 400 Bad Request: Validation errors with field details
  - 500 Internal Server Error: Database/unexpected errors

### 5. Error Handling

- Implement Hono validator error handling pattern (per docs)
- Map Zod validation errors to user-friendly format
- Add try-catch for database errors in EventService
- Return appropriate HTTP status codes and error messages

### Files to Modify

- package.json - Add dependencies
- src/validators/event.validator.ts - New file
- src/services/events.ts - Implement createEvent() and validation
- src/routes/api.ts - Add POST /events endpoint with validation

### Testing Approach

- Use curl/Postman to test endpoint
- Verify validation errors for invalid payloads
- Confirm successful inserts in PostgreSQL
- Check error responses match expected format

---

## Phase 4: Basic Dashboard View

### Initial Dashboard

- Simple HTML page served by Hono
- Display recent events from database
- Basic count metrics
- End-to-end system validation

### Tasks

- [ ] Create dashboard HTML page
- [ ] Query and display recent events
- [ ] Show basic metrics (counts)
- [ ] Test full data flow: ingest → store → display

---

## Future Enhancements

Add these features when current implementation becomes a bottleneck:

### Performance & Scalability

- **Queue System**: When direct writes slow down
- **Background Workers**: For data aggregations
- **Caching Layer**: When queries become slow

### Real-time Features

- **SSE/WebSockets**: For live dashboard updates
- **Push Notifications**: For critical events

---

## Next Steps

Set up the core infrastructure:

1. Configure Tailwind CSS and DaisyUI
2. Set up typed-htmx integration
3. Create project folder structure
4. Set up PostgreSQL connection
5. Begin database schema design
