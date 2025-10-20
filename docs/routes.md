# Routes

## Page Routes

All page routes are server-side rendered with JSX and wrapped with the `BaseLayout` component. These routes return HTML with integrated HTMX for interactive components.

| Method | Path       | Purpose                        | Notes                              |
| ------ | ---------- | ------------------------------ | ---------------------------------- |
| GET    | /          | Home page with welcome message | Shows dashboard quick stats        |
| GET    | /dashboard | Real-time analytics dashboard  | Displays metrics and recent events |

## API Routes

All API routes return JSON responses following the [JSON:API specification](https://jsonapi.org/). API routes are handled separately without the JSX renderer middleware.

| Method | Path               | Purpose                        | Status Code |
| ------ | ------------------ | ------------------------------ | ----------- |
| GET    | /api/health        | Health check endpoint          | 200, 500    |
| POST   | /api/events        | Create event (with validation) | 201, 400    |
| GET    | /api/sse/dashboard | Real-time metrics stream (SSE) | 200         |
