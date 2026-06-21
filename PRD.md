# KeepIt PRD

## 1. Product Overview
KeepIt is a learning community where high school students ask questions and peers/seniors answer via text or video, then expand into 1:1 mentoring chat.

## 2. Problem Statement
Current alternatives have limits:
- AI answers: fast, but weak on personal confusion context
- Online lectures: high quality, but one-way
- General Q&A communities: high quality variance, poor structure

## 3. Goals
### 3.1 Business Goals
- Build a sustainable ask-answer learning loop
- Increase weekly active users
- Validate conversion to paid mentoring in Beta

### 3.2 User Goals
- Learners: solve blocked questions quickly
- Contributors: build reputation and rewards through sharing

## 4. Non-Goals (MVP)
- Advanced AI grading
- Fully automated anti-abuse system
- Complex subscription/settlement engine

## 5. Target Users
### Learners
- High school students (grades 1-3)

### Contributors
- Recent graduates, repeat-test students, early college students

## 6. Key User Scenarios
### Scenario A: Learner
1. Open Home
2. Tap "+ Ask Question"
3. Submit title/body/subject/grade + image/attachment
4. Review answers
5. Mark as solved

### Scenario B: Contributor
1. Browse top question section
2. Open question details
3. Submit text or video answer
4. Optionally publish answer video into know-how feed

### Scenario C: Mentoring
1. Start chat session
2. Receive response within 24h
3. Auto-refund after SLA breach (post-monetization)

## 7. Functional Requirements
### 7.1 Home
- Single vertical feed
- Top: Video Top 10
- Fallback to full list when video count < 50
- Bottom: Question Top 10 (7 popular + 3 help-needed)
- Fixed "+ Ask Question" FAB

Acceptance:
- First content renders within 2s on normal network
- Fallback works in low-content environment

### 7.2 Video Playback
- Guests can watch only first 50%
- Prompt login/signup afterward

Acceptance:
- Playback halts at 50% with overlay CTA

### 7.3 Question Creation
- Required: title, body, subject, grade
- Attachments: image/file allowed
- Visibility: anonymous by default, optional nickname

Acceptance:
- Block submission if required fields are missing
- Visibility option is correctly persisted

### 7.4 Answer Creation
- Supports text or video answers
- Video answer includes "publish to know-how" checkbox

Acceptance:
- New answer appears immediately in question detail

### 7.5 Question Lifecycle
- Asker can mark question as solved
- No "accepted answer" in MVP

Acceptance:
- Solved status is reflected in lists/details

### 7.6 Mentor 1:1 Chat
- Real-time chat
- Response SLA: 24h
- Paid flow starts in Beta
- Safety: profanity/contact/external-link block + report
- Beta entry price: KRW 3,000 per mentoring question
- Platform fee: 20%
- Refund: 100% auto-refund if first mentor response is not sent within 24h
- Refund exclusions: policy-violating requests (abusive language, cheating/ghostwriting)

Acceptance:
- First response timestamp recorded
- SLA breach triggers refund event (Beta)

### 7.7 Rewards
- Hybrid metric (fixed): solved-contribution 60%, like-rate 25%, valid-views 15%
- Reward type: points + micro cash-out (after launch)
- MVP anti-abuse: report-only (upgrade trigger defined in Section 13)
- Top mentor badge: hybrid (auto eligibility + admin approval)
- Badge auto eligibility: monthly solved-contribution >= 5 and report rate < 2%

Acceptance:
- Users can view point accrual history

## 8. Non-Functional Requirements
- Mobile-first UX
- Minimum necessary personal data collection
- Audit logs for moderation actions
- Core API p95 target: 500ms

## 9. Policy Requirements
- Minor safety notices and consent
- Copyright report/takedown process
- Community policy with prohibited behavior and penalties
- Report handling SLA: high-risk content within 6h, normal reports within 24h

## 10. Metrics
### Core Metrics
- Weekly questions created
- Avg answers per question
- First-answer-within-24h rate
- Solved conversion rate
- Report rate and handling time

### Beta Metrics
- Paid mentoring conversion rate
- Refund rate
- Mentor retention/re-engagement

## 11. Release Phases
### Phase 1: MVP (0-3 months)
- Home, question, answer, attachments, reporting, basic video playback

### Phase 2: Seed Expansion (3-6 months)
- Grow video inventory, improve ranking, partial ops automation

### Phase 3: Beta (6-9 months)
- Paid mentoring, auto-refunds, stronger verification/badge flow

## 12. Risks and Mitigation
- Copyright/inappropriate content: report -> temporary hide -> SLA review
- Real-time chat ops load: status indicators, auto-refund, FAQ
- Manual badge fairness: publish explicit badge criteria

## 13. Decision Freeze (Resolved Items)
- Reward weighting fixed: solved-contribution 60%, like-rate 25%, valid-views 15%
- Badge process fixed: auto eligibility + admin approval
- Anti-abuse automation trigger fixed: move from report-only when monthly posts > 1,000 or report rate > 3%
- Realtime stack fixed: Supabase Realtime for MVP and Beta baseline
- Database fixed: PostgreSQL via Supabase
- Video hosting fixed: Cloudflare Stream

## 14. Recommended Language and Framework Stack
- Frontend: TypeScript + Next.js (React)
- Backend: TypeScript + NestJS
- Realtime: Supabase Realtime
- Database: PostgreSQL (Supabase)
- API: REST + OpenAPI
- Storage and video: Supabase Storage + Cloudflare Stream

Rationale:
- A unified TypeScript stack reduces development overhead for a small team.
- This stack supports fast MVP delivery and a clean path to Beta scaling.
