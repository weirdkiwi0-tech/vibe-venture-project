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

## Local multi-account testing
- With both local servers running, open `http://account-1.localhost:3000/profile`, `http://account-2.localhost:3000/profile`, etc. in separate integrated browser tabs.
- Sign in with a different email/password account at each address. These loopback hostnames separate the existing HttpOnly session cookies and role cookies; no session tokens are stored in JavaScript.
- Reloads, navigation, server-rendered pages, and logout stay within each account's hostname. Tabs opened at the same hostname still share a login.
- This routing is development-only. It rewrites only loopback API URLs and leaves production and remote API URLs unchanged. Google OAuth continues to use its separately configured callback URL; use email/password login for this local multi-account workflow.

## Notes
- Public profile dialogs show the nickname rather than internal account IDs or generated school/grade information. Both community and friend profiles include linked community-post, question, and video activity tabs. Anonymous posts and questions are excluded; loading failures are shown with a retry action.
- Backend remains in `keepit-backend/`
- This frontend now includes the home dashboard, question composer, report composer, and admin dashboard
