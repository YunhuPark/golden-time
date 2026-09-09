# 🚀 Golden-Time Deployment Guide

이 문서는 현재 Production 구조 기준의 배포 절차만 다룹니다. 최신 기능 설명은 루트 [`README.md`](../README.md)를 기준으로 합니다.

## 1. Runtime

- Node.js: **24.x**
- Package manager: npm
- Hosting: Vercel
- Frontend: Vite + React
- Server boundary: Vercel Serverless Functions (`/api/egen`, `/api/kakao/*`)

의존성 설치는 재현 가능한 lockfile 설치를 위해 다음 명령을 사용합니다.

```bash
npm ci
```

## 2. 필수 환경 변수

### Server-only secrets

아래 값은 브라우저에 노출되면 안 됩니다.

```env
EGEN_SERVICE_KEY=...
KAKAO_REST_API_KEY=...
```

Vercel Project Settings의 Environment Variables에서 설정합니다.

### Browser configuration

```env
VITE_KAKAO_MAP_APP_KEY=...
VITE_ENCRYPTION_KEY=...
```

`VITE_` 접두사 값은 클라이언트 번들에 포함될 수 있습니다. 서버 비밀키를 넣지 마세요.

`VITE_ENCRYPTION_KEY`는 클라이언트 암호화 구현 시연용 설정입니다. 서버 비밀 마스터키로 간주하면 안 됩니다.

## 3. 선택 기능

### Supabase

기본값은 비활성입니다.

```env
VITE_SUPABASE_ENABLED=false
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Supabase 기반 인증/즐겨찾기/프로필/리뷰/방문기록을 실제로 운영할 때만 다음 순서를 따릅니다.

1. 별도 Supabase 프로젝트 준비
2. 필요한 schema와 RLS 정책 검증
3. URL/anon key 설정
4. 마지막에 `VITE_SUPABASE_ENABLED=true`로 전환
5. Preview에서 로그인/읽기/쓰기/RLS 동작 확인 후 Production 반영

설정 누락이나 잘못된 프로젝트 상태에서는 앱이 fail-closed되어 계정 기능만 비활성화되고 E-Gen/Kakao 병원 검색은 유지됩니다.

### Sentry

```env
VITE_SENTRY_DSN=
```

DSN이 없으면 Sentry는 초기화되지 않습니다. 활성화 시에도 telemetry sanitizer가 정확 위치, 주소, 전화번호 계열 필드를 제거합니다.

## 4. 로컬 실행

`.env.example`을 복사해 `.env`를 준비합니다.

```bash
npm ci
npm run dev
```

`npm run dev`는 Vercel 개발 서버를 사용해 `/api/*` 프록시까지 포함한 흐름을 실행합니다.

UI만 확인하려면:

```bash
npm run dev:ui
```

## 5. 배포 전 검증

```bash
node --test scripts/validate-env.test.cjs
npm run test:unit
npm run type-check
npm run type-check:api
npm run lint
npm run test:api
npm run build
npm audit --omit=dev --audit-level=moderate
```

GitHub Actions의 CI도 같은 핵심 검증을 수행합니다.

## 6. Vercel 배포

`master`에 merge되면 연결된 Vercel 프로젝트가 Production deployment를 생성합니다.

배포 완료 후 최소한 다음을 확인합니다.

- `https://golden-time.vercel.app/` 응답 200
- Kakao Maps SDK 로딩
- 브라우저 위치 권한 흐름
- E-Gen 병상 데이터 수신
- 병원 좌표 매칭
- 초기 병원 목록 표시
- 상위 병원 경로시간 보강
- `Content-Security-Policy` 응답 헤더 존재
- Supabase 비활성 상태에서 외부 Supabase 네트워크 요청이 발생하지 않음

## 7. CSP

Production은 `vercel.json`의 `Content-Security-Policy`를 실제 enforce 상태로 사용합니다.

정책 변경이 필요할 때는 바로 allowlist를 넓히지 말고 다음 절차를 권장합니다.

1. 필요한 외부 리소스의 출처 확인
2. 최소 범위 allowlist 작성
3. 가능하면 Report-Only에서 위반 확인
4. Preview 기능 검증
5. 실제 CSP enforce

Kakao Maps SDK 내부 동작 때문에 현재 `script-src`에는 `'unsafe-eval'`이 필요합니다. 애플리케이션 자체 inline JavaScript는 사용하지 않습니다.

## 8. API 키 운영 주의사항

- 실제 E-Gen/Kakao REST 비밀키를 소스, README, 이슈, PR 본문, Actions 로그 URL에 출력하지 않습니다.
- 키가 공개 로그나 Git history에 노출된 적이 있다면 저장소에서 문자열을 지우는 것만으로 충분하지 않습니다. 해당 공급자에서 **키를 폐기/재발급**하고 Vercel/GitHub Secrets 값을 교체해야 합니다.
- Kakao JavaScript 키는 브라우저 공개 키이므로 Kakao Developers에서 Web 도메인 제한을 설정합니다.

## 9. 롤백

Production에서 심각한 문제가 발견되면 이전 READY deployment로 rollback한 뒤 원인을 별도 PR에서 수정합니다. 외부 API 오류 한 건 때문에 전체 앱을 롤백하기보다는, E-Gen/Kakao/Supabase 중 어느 경계에서 문제가 발생했는지 먼저 분리합니다.
