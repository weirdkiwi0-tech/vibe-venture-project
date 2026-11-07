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
- Questions, videos, community posts, comments, search results, and profile activity share monochrome Unicode metrics with accessible labels. Likes use an outlined/filled heart instead of color; eye and speech-bubble glyphs explicitly request text presentation (VS15), and flags retain their report links and tooltips. Home TOP rank numbers remain plain; other card styling is unchanged.
- Question speech-bubble metrics open the registered answer/comment list directly (`#answers`), including from home, question lists, search, and own-profile activity. On a question detail page they jump past the answer form to the existing discussion, including its empty state.
- The question finder omits rank numbers, their badges, and the empty left column, including filtered results. Only the home TOP carousel retains its plain rank numbers.
- The icons use a locally served 6 KB Noto Sans Symbols 2 subset with native text-symbol fallbacks so macOS cannot substitute color emoji for the eye and speech bubble despite VS15. The font is licensed under the [SIL Open Font License](./public/content-symbols-OFL.txt); its [Google Fonts subset source](https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols+2&text=%E2%99%A1%E2%99%A5%F0%9F%91%81%F0%9F%97%A8%E2%9A%91) is public. No icon-font requests go to third-party servers at runtime.
- Public profile dialogs show the nickname rather than internal account IDs or generated school/grade information. Both community and friend profiles include linked community-post, question, and video activity tabs. Anonymous posts and questions are excluded; loading failures are shown with a retry action.
- Backend remains in `keepit-backend/`
- This frontend now includes the home dashboard, question composer, report composer, and admin dashboard
