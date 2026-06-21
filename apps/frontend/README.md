# KeepIt Frontend

KeepIt frontend workspace built with Next.js App Router.

## Structure
- `src/app`: app routes and layouts
- `src/components`: shared UI primitives and shell
- `src/features`: feature-scoped UI entry points
- `src/lib`: API client and shared types
- `src/styles`: global styling and design tokens
- `public`: static assets
- `tests/unit`: unit tests
- `tests/integration`: integration tests
- `tests/e2e`: end-to-end tests

## Running
- Set `NEXT_PUBLIC_API_BASE_URL` (or `NEXT_PUBLIC_API_URL`) to the backend URL, or keep the default `http://localhost:3001`
- Install dependencies in this folder, then run `npm run dev`

## Notes
- Backend remains in `keepit-backend/`
- This frontend now includes the home dashboard, question composer, report composer, and admin dashboard
