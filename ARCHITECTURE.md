# KeepIt Architecture

## 1. Purpose
This document defines the MVP and Beta architecture baseline for KeepIt.
Audience: product, engineering, and operations.

Scope:
- Home feed, Q&A, video upload, mentor chat
- Domain boundaries and data model
- Safety/moderation and operations
- MVP-to-Beta evolution path

## 2. Architecture Principles
- MVP first: optimize for fast learning loops
- Safety first: mandatory report/block/audit for teen users
- Observability: track all core product events
- Progressive scaling: keep MVP simple, automate in Beta

## 3. Product Flow (Decisions Applied)
- Home: single vertical feed
- Top section: Weekly Top 10 videos
- Fallback: if total videos < 50, show full video list
- Bottom section: Daily Top 10 questions (7 popular + 3 help-needed)
- Global CTA: fixed "+ Ask Question" button
- Guest playback gate: 50% of video duration
- Question input: text + image + attachment
- Required fields: title, body, subject, grade
- Answer mode: text or video
- Mentoring: real-time chat, 24h SLA, auto-refund after SLA breach

## 4. System Context
### 4.1 Client
- Web app (mobile-first responsive)
- Core screens: Home, Question Detail, Answer Composer, Chat, Report

### 4.2 Backend Services
- API Gateway / BFF
- Auth Service
- User Service
- Question Service
- Answer Service
- Video Service
- Feed Ranking Service
- Mentoring Chat Service
- Moderation Service
- Notification Service
- Admin Console Service

### 4.3 External Dependencies (Beta)
- Database/Storage: Supabase (PostgreSQL + Storage)
- Video hosting: Cloudflare Stream
- Real-time infra: Supabase Realtime (MVP) and Socket.IO service split at scale
- Notifications: FCM / SMS / Email
- Payments: domestic PG provider
- AI moderation: text/image policy API

## 5. Recommended Language and Framework Stack
- Frontend language: TypeScript
- Frontend framework: Next.js (React)
- Frontend styling: Tailwind CSS
- Frontend data fetching: TanStack Query
- Backend language: TypeScript
- Backend framework: NestJS
- Realtime chat: Supabase Realtime (MVP)
- Database: PostgreSQL via Supabase
- Auth: Supabase Auth
- API style: REST (OpenAPI spec)
- File storage: Supabase Storage (images and attachments)
- Video hosting: Cloudflare Stream
- Moderation: OpenAI Moderation API (text first, image rules in Beta)
- Error and product analytics: Sentry + PostHog
- Infra and deployment: Vercel (web) + Render (API)

Reasoning:
- Unified TypeScript across frontend and backend minimizes context switching for a small team.
- Next.js + NestJS gives clear separation of UI and service logic with strong ecosystem support.
- Supabase provides PostgreSQL, Auth, Realtime, and Storage to speed up MVP delivery and keeps a clean path to Beta scaling.

## 6. MVP vs Beta
### 6.1 MVP
- Single frontend app + single backend project
- Video upload: file upload first
- Moderation: report-driven post moderation
- Mentoring: free real-time chat
- Rewards: points accrual only (no redemption)

### 6.2 Beta
- Service separation (chat/ranking/moderation)
- AI first-pass moderation + report workflow
- Paid mentoring enabled
- Micro cash-out for points enabled

## 7. Core Domain Model
### 7.1 User
- id
- role (student, mentor, admin)
- grade
- nickname
- verificationStatus (none, pending, verified)
- badge

### 7.2 Question
- id
- authorId
- title
- body
- subject
- grade
- attachments
- visibility (anonymous, nickname)
- status (open, solved)
- createdAt

### 7.3 Answer
- id
- questionId
- authorId
- type (text, video)
- content
- createdAt

### 7.4 Video
- id
- uploaderId
- sourceType (answer, standalone)
- publishToKnowhow (boolean)
- duration
- moderationStatus

### 7.5 MentoringSession
- id
- studentId
- mentorId
- channelId
- startedAt
- slaDeadline
- firstResponseAt
- status

### 7.6 Report
- id
- reporterId
- targetType (question, answer, video, chat)
- targetId
- reason
- status

## 8. API Boundaries (Example)
- POST /questions
- GET /questions?sort=mixed
- POST /questions/{id}/answers
- POST /videos/upload
- POST /videos/{id}/publish-knowhow
- POST /mentoring/sessions
- POST /reports
- POST /questions/{id}/solve

## 9. Ranking Logic
### 9.1 Video Section
- Default: weekly score-based Top 10
- Fallback: full list if total videos < 50

### 9.2 Question Section
- Daily Top 10 = 7 popular + 3 help-needed
- Popular score candidates: views, reactions, answer count
- Help-needed criteria: zero answers + elapsed time

## 10. Safety and Security
- Block profanity/contact info/external links
- Put reported content into immediate review queue
- Store admin decision logs
- Record minor-protection consent/policy acknowledgements
- Validate extension/size and scan uploaded files

## 11. Observability
Event tracking:
- question_created
- answer_created
- video_uploaded
- mentoring_started
- report_created

Ops dashboard KPIs:
- unanswered question count
- SLA-violated sessions
- avg report handling time
- weekly active questions/answers

## 12. Performance and Scale Targets
- Initial concurrent users: 100-300
- API p95 latency: < 500ms (read APIs)
- Chat delivery latency: ~1s average

## 13. Risks and Mitigations
- Real-time chat ops burden: auto-refund + online/offline status
- Copyright risk: strict upload policy + immediate temporary hide on report
- Abuse risk: add account/device-level anti-abuse rules before Beta

## 14. Recommended Release Order
1) Text Q&A
2) Attachments + reporting
3) Video upload + 50% guest gate
4) Home ranking sections
5) Real-time chat
6) Beta paid flow + settlement

## 15. Decision Freeze (Single Source of Truth)
- Realtime baseline: Supabase Realtime.
- Realtime split trigger: move chat to Socket.IO when concurrent active chat rooms exceed 300.
- Primary database: PostgreSQL (Supabase), no Firestore path in current plan.
- Video provider: Cloudflare Stream as default provider for MVP and Beta.
- API deployment target: Render for backend API.
- Any deviation from this section requires a written RFC and owner approval.
