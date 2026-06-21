# 킵잇(KeepIt) 기획서 v4

> 한 줄 정의: 고등학생 질문-답변 커뮤니티와 멘토 채팅을 결합한 학습 플랫폼

---

## 1. 제품 정의

킵잇은 고등학생이 질문을 올리고 또래/선배가 텍스트 또는 영상으로 답변하는 서비스다.
MVP에서는 질문-답변 루프와 안전한 운영 구조를 먼저 확보하고, 베타에서 유료 멘토링을 확장한다.

핵심 방향:
- 질문 해결 속도 개선
- 답변자 기여 축적(포인트)
- 신고/안전정책 기반의 신뢰 가능한 커뮤니티 운영

---

## 2. 확정된 제품 원칙

- 홈은 단일 세로 피드 구조
- 질문 섹션은 TOP 10(인기 7 + 도움필요 3)
- 질문 필수값: 제목/본문/과목/학년
- 질문 해결 상태: open/solved
- 답변 타입: text/video
- 게스트 영상 시청: 50% 이후 로그인 유도
- 멘토 채팅 SLA: 첫 응답 24시간
- 신고 대응: MVP는 신고 기반 운영

---

## 3. 확정된 기술 스택

- 프론트엔드: TypeScript + Next.js
- 백엔드: TypeScript + NestJS
- DB/Auth/Storage/Realtime: Supabase(PostgreSQL 포함)
- 영상: Cloudflare Stream
- 배포: Render(API), Vercel(Web)

---

## 4. 확정된 정책 값

- 유료 멘토링 시작 가격: 3,000원 (베타)
- 플랫폼 수수료: 20%
- SLA 위반 환불: 첫 멘토 응답 24시간 초과 시 100% 자동 환불
- 환불 제외: 욕설/대리수행/정책 위반 요청
- 보상 가중치: 해결기여 60%, 좋아요율 25%, 유효조회 15%
- 우수 멘토 배지: 자동 자격 + 운영 승인

---

## 5. 현재 백엔드 구현 범위 (TDD 기반)

완료된 모듈:
- Questions: 생성/조회/해결/목록 TOP 조합
- Answers: 생성/조회
- Reports: 신고 생성/목록
- Mentoring: 세션 생성/메시지 전송/세션 조회
- Videos: 영상 등록/홈 목록/재생 정책(게스트 50% 게이트)
- Rewards: 포인트 적립/사용자 적립 내역 조회

테스트 체계:
- Unit
- Integration
- E2E

모든 단계에서 지속적으로 빌드와 전체 테스트를 통과시키는 방식으로 진행한다.

---

## 6. MVP 단계 목표

단계 1 (현재 집중):
- 질문/답변/신고/영상 기본 노출/기본 멘토링 채팅/리워드 히스토리

단계 2:
- 홈 랭킹 고도화
- 모더레이션 운영 자동화 일부

단계 3(베타 준비):
- 유료 멘토링 결제/환불 이벤트
- 운영 지표 대시보드 연동

---

## 7. 운영 및 안전 기준

- 채팅 안전정책: 욕설/연락처/외부링크 차단
- 신고 접수 기반 운영 리뷰
- 감사 가능한 기록 저장 구조 유지

---

## 8. 다음 실행 우선순위

1. 인증/권한(익명/닉네임/역할) 정식 반영
2. 데이터 영속화(Supabase PostgreSQL 리포지토리)
3. OpenAPI 문서 자동화
4. 베타 유료 멘토링 환불 이벤트 연결

---

## 9. 실행형 기획안 v1 (변경 용이성 우선)

목표:
- 지금 바로 앱을 만들 수 있는 수준의 실행 계획 확보
- 정책/기능 변경이 발생해도 빠르게 수정 가능한 구조 확보

핵심 원칙:
- 기능 모듈화
- 정책 분리(Policy Layer)
- API 계약 버전 관리
- Feature Flag 기반 점진 배포

---

## 10. MVP v1 범위 (포함/제외)

포함 기능:
- 질문 생성/조회/해결
- 답변 생성/조회/수정/삭제
- 영상 등록/노하우 공개
- 멘토링 세션/메시지/SLA 모니터
- 신고 접수/운영 큐/운영 액션
- 리워드 적립 내역 조회
- 운영자 모드 전환 + 운영 콘솔

제외 기능:
- 결제/정산/실환불 실제 연동
- 실시간 소켓 운영 화면
- AI 자동판정

---

## 11. 정보구조(IA)

사용자 영역:
- 홈(영상 TOP + 질문 TOP)
- 질문 상세
- 질문 작성
- 멘토링
- 리워드 히스토리

운영자 영역:
- 운영자 홈(대시보드)
- 신고 큐
- 콘텐츠 관리
- SLA 모니터
- 감사로그

---

## 12. 운영자 모드 전환 및 운영 정책

운영자 모드 전환:
- 프로필 메뉴에서 운영자 모드 진입
- 비밀번호 재입력 후 admin 권한 검증
- 성공 시 운영자 콘솔 진입, 실패 시 일반 화면 유지

운영 정책(확정값):
- 신고 큐 정렬: 신고누적 DESC -> 위험도 DESC -> 오래된순
- 위험도: 2단계(normal/high), 누적수 우선
- 자동 임시숨김: 신고 3회 이상, 질문/답변/영상 전체
- 자동 복구: 24시간 후 자동복구
- 운영 액션: 승인/기각/임시숨김 유지/즉시 복구
- 승인/기각 시 사유 입력 필수
- 사용자 알림: 작성자/신고자 모두 알림
- 신고 처리 SLA: 모든 신고 24시간

운영자 화면 핵심 구성:
- KPI 4카드(미처리 신고, 고위험 신고, SLA 임박, SLA 초과)
- 급한 신고 Top 10
- 트렌드 패널
- 신고 큐 기본 필터(pending/reviewing), 페이지 크기 20
- 신고 상세 전문 미리보기
- SLA 모니터 기본탭(6시간 이내 임박)
- 감사로그 전수 조회(1년 보관)

---

## 13. 도메인/정책 분리 설계

Domain Layer:
- Question, Answer, Video, MentoringSession, Report, Reward

Policy Layer:
- 질문 7+3 정렬 정책
- 신고 우선순위 정책
- 자동 임시숨김/자동복구 정책
- 리워드 정책

Delivery Layer:
- Controller/API
- User UI
- Admin UI

원칙:
- 정책값 변경 시 Policy 파일 또는 설정값만 수정하도록 설계

---

## 14. 데이터 모델 확장안

Report:
- id, targetType, targetId, reason, severity, reportCount, status, createdAt, resolvedAt, resolvedBy, resolutionReason

ModerationAction:
- id, reportId, actionType, actorId, reason, createdAt

AdminAuditLog:
- id, adminId, action, targetType, targetId, reason, metadata, createdAt

MentoringSession:
- id, startedAt, firstMentorResponseAt, slaDeadline, status

Notification:
- id, receiverId, type, payload, readAt, createdAt

---

## 15. API 계약 전략

- API 버전: /v1/...
- 리스트 응답 표준: items, page, pageSize, total
- 상태전이 API 분리:
	- /reports/{id}/approve
	- /reports/{id}/reject
	- /reports/{id}/restore
- 에러 응답 표준: code, message, details, traceId

---

## 16. 개발 백로그 (즉시 실행용)

Sprint A:
- 운영자 전환
- 신고 큐 조회
- 신고 액션 API
- 감사로그 기록

Sprint B:
- 자동 임시숨김/자동복구 배치
- 사용자 알림
- SLA 모니터 화면

Sprint C:
- 콘텐츠 관리 화면
- 리워드/배지 검토 위젯
- 운영 지표 대시보드 고도화

---

## 17. 품질/검증 기준

- 기능 테스트: unit/integration/e2e 전체 green
- 운영 테스트: 신고 3회 자동숨김, 24시간 자동복구, 승인/기각 사유 필수
- 권한 테스트: admin 외 접근 차단
- 회귀 테스트: 기존 질문/답변/멘토링 API 동작 보장

---

## 18. 변경 대응 전략

- 정책 버전 관리: policyVersion으로 운영 정책 변경 이력 추적
- Feature Flag: 자동숨김/알림/고급 모더레이션 on/off
- 문서-코드 동기화: PRD/IDIA 변경 시 API 계약표/정책표 동시 갱신
- 마이그레이션 준비: In-memory 인터페이스 유지, 저장소 구현체 교체 가능 구조

추가 검토 항목:
1. 정책값을 운영자 UI에서 수정 허용할지, 코드 배포 기반으로만 변경할지
2. 사용자 알림 채널을 인앱만 유지할지, 이메일/푸시를 병행할지
3. 감사로그 1년 보관 후 아카이브 정책
