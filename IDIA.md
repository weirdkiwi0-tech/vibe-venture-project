# 킵잇(KeepIt) 실행형 기획서 v5 (코드 동기화 기준)

> 기준일: 2026-06-21
>
> 이 문서는 현재 코드 구현 상태를 기준으로 정리한 실행 문서이며, 목표 아키텍처는 별도 섹션으로 분리한다.

---

## 1. 제품 한 줄 정의

고등학생 대상 질문-답변 커뮤니티에 영상 학습, 멘토링 세션, 신고/운영 도구를 결합한 학습 플랫폼.

---

## 2. 현재 구현 요약 (코드 기준)

- 프론트엔드: TypeScript + Next.js 15(App Router)
- 백엔드: TypeScript + NestJS 11
- 데이터 저장: SQLite(`better-sqlite3`, WAL 모드)
	- 앱 데이터: `apps/backend/data/keepit.sqlite`
	- 인증 데이터: `apps/backend/data/keepit-auth.sqlite`
- 인증: 세션 쿠키(`keepit-session`) + Google OAuth + 로컬 이메일/비밀번호
- 권한: `RolesGuard` + `RequireRoles('admin')`
- API 문서: Swagger `/docs`
- 테스트: unit/integration/e2e 분리 실행

참고: 기존 문서의 Supabase/Cloudflare 전제는 현재 코드에 아직 반영되어 있지 않다.

---

## 3. 현재 백엔드 모듈 범위

### 3.1 Auth
- Google OAuth 로그인/콜백
- 로컬 회원가입/로그인
- 세션 생성/조회/로그아웃
- 사용자 밴/해제 및 밴 정보 조회

### 3.2 Home
- 홈 피드 통합 응답
- 영상 목록 + 질문 목록 + 메타데이터 반환

### 3.3 Questions/Answers
- 질문 생성/상세/목록(Top, All, Mine)
- 질문 해결 상태 전환(`open/solved`)
- 질문 좋아요 토글
- 답변 생성/목록/좋아요
- 답변 댓글(트리 구조), 질문/답변 삭제

### 3.4 Videos
- 영상 등록/조회/목록/내 영상
- 영상 좋아요/조회수 증가
- 영상 댓글 생성/조회
- 게스트 50% 재생 제한 정책 API
- 영상 삭제

### 3.5 Mentoring
- 멘토링 세션 생성
- 세션 메시지 전송
- 세션 상세 + SLA 위반 여부 계산
- 관리자용 SLA breach 목록

### 3.6 Reports/Moderation
- 신고 생성/목록
- 관리자 신고 큐 조회(`pending/reviewing`)
- 관리자 액션: approve/reject/restore/delete-target
- 감사로그 조회

### 3.7 Admin
- 관리자 개요(KPI 카드/긴급 신고/버킷)
- 사용자 목록, 삭제, 밴, 언밴

### 3.8 Rewards
- 포인트 적립
- 사용자 리워드 히스토리/총점 조회

### 3.9 Community
- 게시글/댓글/좋아요/삭제
- 친구 요청/수락
- 친구 간 DM 전송

---

## 4. 현재 프론트엔드 화면 범위

구현된 주요 라우트:
- `/` 홈
- `/questions`, `/questions/new`, `/questions/[id]`
- `/videos`, `/videos/new`, `/videos/[id]`
- `/community`, `/community/posts/[id]`
- `/reports`, `/reports/new`
- `/admin`
- `/profile`, `/settings`, `/search`
- `/auth/callback`

---

## 5. 현재 정책 반영 상태

### 5.1 반영된 정책
- 질문 필수값: 제목/본문/과목/학년
- 질문 상태: `open/solved`
- 답변 타입: `text/video`
- 게스트 영상 시청 제한: 50% 이후 로그인 유도
- 멘토링 첫 응답 SLA: 24시간 위반 여부 계산
- 채팅 안전정책: 욕설/연락처/외부링크 패턴 차단
- 신고 처리 워크플로우 + 감사로그 저장

### 5.2 부분 반영/미반영
- 질문 TOP 10의 `인기 7 + 도움필요 3` 혼합 정책: 미반영
	- 현재는 좋아요/최신 기준 인기 정렬 중심
- 신고 3회 자동 숨김/24시간 자동 복구: 미반영
- 환불 자동화(결제 연동 기반): 미반영
- 실시간 소켓 채팅: 미반영(현재는 API 기반)

---

## 6. 데이터 모델(현재 코드 중심)

핵심 테이블:
- `users`, `local_accounts`, `sessions`
- `questions`, `answers`, `question_likes`, `answer_likes`, `comments`
- `videos`, `video_comments`
- `mentoring_sessions`, `mentoring_messages`
- `reports`, `admin_audit_logs`
- `community_posts`, `community_post_likes`, `friend_requests`, `direct_messages`

---

## 7. 운영자 기능(현재)

- 접근 제어: admin role 필수
- 신고 큐 조회 + 액션 처리
- 감사로그 조회
- 사용자 밴/언밴
- 개요 대시보드:
	- 미처리 신고
	- 검토 중 신고
	- 고위험 신고
	- 감사로그 수

---

## 8. 목표 아키텍처(로드맵)

현재 구현은 SQLite 중심 MVP 가속 구조이며, 중기적으로 아래 전환을 목표로 한다.

- 영속화 고도화: SQLite -> PostgreSQL(Supabase 포함 검토)
- 인증/스토리지/실시간: Supabase 연계 여부 확정
- 영상 파이프라인: Cloudflare Stream 연동
- 결제/환불: 베타 유료 멘토링 이벤트 연동
- 운영 자동화: 자동 숨김/복구, 알림 채널 확장

---

## 9. 우선순위 백로그 (코드 정합 기준)

1. 질문 랭킹 정책을 `인기 7 + 도움필요 3`으로 구현
2. 신고 누적 기반 자동 임시숨김/자동복구 배치 구현
3. 리포지토리 추상 유지한 채 PostgreSQL 구현체 추가
4. 운영 알림(작성자/신고자) 이벤트 추가
5. 결제/환불 도메인 이벤트(베타) 연결

---

## 10. 품질 기준

- 백엔드: unit/integration/e2e 모두 green
- 프론트엔드: unit/integration/e2e 모두 green
- 회귀 기준:
	- 질문/답변/영상/신고/멘토링 핵심 API 보장
	- admin 권한 없는 접근 차단 보장

---

## 11. 문서 운영 원칙

- IDIA는 "현재 코드 사실"과 "목표 계획"을 분리 표기한다.
- 정책 변경 시 PRD/IDIA/API 계약 문서를 동시 업데이트한다.
- 기능 완료 기준은 코드 + 테스트 + 문서 동기화 3가지를 모두 충족해야 한다.
