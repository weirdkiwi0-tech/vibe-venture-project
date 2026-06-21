# Azure Deploy Guide (azd)

## Overview
이 가이드는 KeepIt 애플리케이션을 Azure Developer CLI(azd)를 통해 배포하는 방법을 설명합니다.

## 배포 구조
- **Backend**: NestJS TypeScript API (포트 3000)
- **Frontend**: Next.js React App (포트 3000)
- **Container Registry**: Azure Container Registry에 이미지 저장
- **Container Instances**: Azure Container Instances에서 실행

## 전제조건
```bash
# azd 설치 확인
azd --version

# Docker Desktop 실행 중인지 확인
docker --version

# Azure CLI 로그인
az login

# azd에 Azure 인증
azd auth login
```

## 배포 단계

### 1. 초기 설정 (첫 배포 시만)
```bash
cd /Users/parkjisung/Desktop/바이브\ 벤쳐\ 작품

# azd 프로젝트 초기화
azd init

# 또는 기존 프로젝트 연결
azd env new dev
```

### 2. 환경 변수 설정
```bash
# .azure/infra/main.parameters.json에서 필요한 값 수정:
# - environmentName: dev, staging, prod 등
# - containerRegistryName: 고유한 이름 (소문자/숫자만)
# - 기타 필요한 매개변수
```

### 3. 배포 실행

#### Option A: 자동 배포 (빌드 + 배포)
```bash
azd up
# 1. Docker 이미지 빌드
# 2. Azure 리소스 생성
# 3. 이미지 배포
```

#### Option B: 단계별 배포
```bash
# 1. Azure 리소스 프로비저닝만
azd provision

# 2. 애플리케이션 배포만
azd deploy
```

### 4. 배포 상태 확인
```bash
# 환경 상태 확인
azd env list

# 현재 환경의 정보 확인
azd env show

# 배포된 리소스 확인
az resource list --resource-group <resource-group-name>
```

### 5. 애플리케이션 접속
배포 완료 후 다음 URL로 접속할 수 있습니다:
- **Backend API**: `http://keepit-backend-{environmentName}.{region}.azurecontainer.io:3000`
- **Frontend**: `http://keepit-frontend-{environmentName}.{region}.azurecontainer.io:3000`

## 빌드 과정

### Backend (Dockerfile)
1. Node.js 22 Alpine 기반 이미지 사용
2. TypeScript 컴파일 (tsc)
3. 프로덕션 의존성만 설치
4. 최종 이미지는 ~300MB

### Frontend (Dockerfile)
1. Node.js 22 Alpine 기반 이미지 사용
2. Next.js 빌드
3. 프로덕션 의존성만 설치
4. 최종 이미지는 ~200MB

## 환경 변수

### Frontend
- `NEXT_PUBLIC_API_URL`: Backend API URL (배포 시 자동 설정)

### Backend
필요시 `.env` 파일에 추가:
```env
NODE_ENV=production
DATABASE_URL=your_database_url
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## 트러블슈팅

### 1. Docker 빌드 실패
```bash
# 로컬에서 먼저 테스트
docker build -t keepit-backend:test ./apps/backend
docker build -t keepit-frontend:test ./apps/frontend
```

### 2. 배포 실패
```bash
# 자세한 로그 확인
azd deploy --verbose

# 리소스 확인
az container logs --resource-group <rg-name> --name keepit-backend-dev
```

### 3. 이미지 푸시 실패
```bash
# Container Registry 로그인 확인
az acr login --name <registry-name>

# 이미지 태그 확인
docker images | grep keepit
```

## 정리 (리소스 삭제)
```bash
# 배포된 모든 리소스 삭제
azd down

# 특정 리소스 그룹 삭제
az group delete --name <resource-group-name>
```

## 추가 리소스
- [Azure Developer CLI 문서](https://learn.microsoft.com/azure/developer/azure-developer-cli/)
- [Bicep 문서](https://learn.microsoft.com/azure/azure-resource-manager/bicep/)
- [Container Instances 문서](https://learn.microsoft.com/azure/container-instances/)
