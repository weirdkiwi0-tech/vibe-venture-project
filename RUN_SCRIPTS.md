# 실행 스크립트 안내

KeepIt 워크스페이스에서 개발 서버 실행, 테스트, TDD 순환을 빠르게 수행하는 방법입니다.

## 1. 스크립트 목록

- `scripts/run-all.sh`: 백엔드 + 프론트 동시 실행
- `scripts/test-all.sh`: 백엔드 + 프론트 전체 테스트 실행
- `scripts/tdd-cycle.sh`: 대상(`backend`/`frontend`/`all`)별 TDD 테스트 순환

## 2. 빠른 시작

### 2-1. 전체 앱 실행

```bash
bash scripts/run-all.sh
```

실행 동작:

- 백엔드: `apps/backend`에서 `PORT=3001 npm run start:dev`
- 프론트: `apps/frontend`에서 `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001 npm run dev`

접속 주소:

- 프론트: `http://localhost:3000`
- 백엔드 API: `http://localhost:3001`

### 2-2. 전체 테스트 실행

```bash
bash scripts/test-all.sh
```

실행 순서:

- `apps/backend` `npm run test:all`
- `apps/frontend` `npm run test:all`

### 2-3. TDD 사이클 실행

```bash
bash scripts/tdd-cycle.sh backend
bash scripts/tdd-cycle.sh frontend
bash scripts/tdd-cycle.sh all
```

각 대상에서 `unit -> integration -> e2e` 순서로 테스트가 실행됩니다.

## 3. 종료 방법

- `run-all.sh` 실행 중: `Ctrl + C`
- `test-all.sh` 실행 중단: `Ctrl + C`
- 정상 종료 시 `run-all.sh`는 trap으로 백엔드/프론트 프로세스를 함께 정리합니다.

## 4. 단독 실행 명령

- 백엔드만 실행: `cd apps/backend && npm run start:dev`
- 프론트만 실행: `cd apps/frontend && npm run dev`
- 백엔드 테스트: `cd apps/backend && npm run test:all`
- 프론트 테스트: `cd apps/frontend && npm run test:all`

## 5. 자주 발생하는 이슈

### 5-1. `/admin`에서 500 또는 에러 오버레이가 뜰 때

- 원인: 관리자 세션 만료 또는 권한 쿠키 미일치
- 조치: `설정` 화면에서 다시 로그인 후 `http://localhost:3000/admin` 재접속

### 5-2. 404: This page could not be found.

- 원인: URL 오타 또는 문장 일부가 URL에 포함됨 (예: `/(으)로`)
- 조치: 정확한 주소를 직접 입력
  - 홈: `http://localhost:3000/`
  - 운영자: `http://localhost:3000/admin`

### 5-3. `next lint --fix`가 멈춘 것처럼 보일 때

- 현재 프로젝트는 ESLint 초기 설정이 완료되지 않아 대화형 선택 화면이 뜰 수 있습니다.
- 코드 정리 목적이라면 우선 실행/테스트 기준으로 정리하고, ESLint는 별도 시간에 설정 후 적용하는 것을 권장합니다.