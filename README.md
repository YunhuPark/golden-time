# 🚑 Golden-Time

> 실시간 응급실 가용 병상, 병원 위치, 이동시간을 결합해 **현재 위치에서 실제로 갈 만한 응급의료기관을 빠르게 찾는 웹 애플리케이션**입니다.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-golden--time.vercel.app-000000?style=for-the-badge&logo=vercel)](https://golden-time.vercel.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-24.x-339933?style=flat-square&logo=node.js)](https://nodejs.org/)

> [!IMPORTANT]
> Golden-Time은 포트폴리오/프로토타입입니다. 의료기기나 진단 시스템이 아니며 119, 의료진의 판단, 실제 병원의 수용 가능 여부 확인을 대체하지 않습니다.

---

## 1. 문제 정의

응급 상황에서 단순히 "가까운 병원"만 찾는 것으로는 충분하지 않습니다.

- 가까워도 응급실 가용 병상이 없을 수 있습니다.
- 직선거리와 실제 도로 이동시간은 다릅니다.
- 공공 API 데이터와 지도 API 데이터는 서로 다른 식별자/좌표 품질을 가질 수 있습니다.
- 외부 API 하나가 느리거나 실패하면 전체 검색 UI가 같이 멈출 수 있습니다.

Golden-Time은 이 문제를 **실시간 병상 + 공식 병원 좌표 + 실제 경로시간 + 부분 실패 허용** 구조로 해결하는 것을 목표로 합니다.

---

## 2. 현재 동작 방식

```text
사용자 위치
   ↓
행정지역 추론
   ↓
E-Gen 실시간 병상 API ─────────────┐
E-Gen 지역 병원목록 A/B/C ────────┤  병렬 조회
                                   ↓
                         HPID 기준 정확 병합
                                   ↓
                    공식 좌표 우선 사용
                                   ↓
              좌표 누락 건만 Kakao Geocoding
                                   ↓
                 거리 필터 + 1차 병원 랭킹
                                   ↓
                    병원 목록 즉시 화면 표시
                                   ↓
              상위 10개 Kakao Directions 계산
                                   ↓
                 실제 이동시간 반영 최종 랭킹
```

핵심은 **경로 계산이 끝날 때까지 병원 목록 전체를 기다리지 않는 것**입니다. 먼저 E-Gen 기반 후보를 보여주고, 상위 후보의 실제 이동시간을 백그라운드에서 보강한 뒤 최종 순서를 갱신합니다.

---

## 3. 핵심 기능

### 🏥 E-Gen 실시간 응급실 검색

- 국립중앙의료원 E-Gen 실시간 가용병상 데이터 조회
- 지역 병원목록을 병렬 조회하고 `HPID`로 실시간 병상 데이터와 병합
- E-Gen 공식 위도/경도를 우선 사용
- 좌표가 없는 병원만 Kakao Geocoding fallback
- 현재 위치 기준 100km 이내 후보 필터링

### 🚗 Progressive Route Enrichment

- 병원 목록을 먼저 렌더링하고 상위 10개 경로를 백그라운드 계산
- Kakao Directions 동시 요청 수 제한
- 성공한 경로는 메모리 캐시(60초)
- 동일 경로의 in-flight 요청 deduplication
- 502/503/504, timeout, 일시적 network failure만 1회 재시도
- 한 병원의 경로 실패가 전체 검색 실패로 전파되지 않음

### 🏆 결정론적 병원 랭킹

현재 Golden-Time 자체가 진단 AI를 실행하지는 않습니다. 병원 추천은 아래 정보를 조합하는 **설명 가능한 점수 기반 로직**입니다.

- 실제 도로 이동시간
- 응급실 가용 병상
- ICU 가용 병상/대응 자원
- 외상 대응 등급
- 운영 상태
- 외부 AI 프로젝트가 전달한 `AIAnalysisContext`가 있는 경우 질환/중증도 기반 capability match

즉 Medi-Matrix 같은 외부 분석 시스템과 연결될 수 있지만, Golden-Time 내부의 랭킹 결과를 "AI 진단"으로 표현하지 않습니다.

### 📍 지역 인식 캐시 fallback

- 최근 병원 검색 결과를 브라우저에 30분 TTL로 저장
- 저장 지역은 문자열 하드코딩이 아니라 현재 좌표에서 계산
- 현재 지역과 캐시 지역이 다르면 사용하지 않음
- 위치가 100km 이상 달라진 캐시도 무효화
- API 장애 시에만 최근 데이터를 fallback으로 사용하고 stale 상태를 UI에 표시

### 👤 선택적 계정 기능

Supabase 기반 인증/즐겨찾기/프로필/리뷰/방문기록은 **선택 기능**입니다.

- 기본값: `VITE_SUPABASE_ENABLED=false`
- 명시적으로 활성화하지 않으면 외부 Supabase 네트워크 요청을 차단
- URL/key 누락, 잘못된 URL, 알려진 비가용 프로젝트, project mismatch 시 fail-closed
- Supabase가 없어도 병원 검색, E-Gen, Kakao 기능은 정상 동작

### 🔐 로컬 암호화 시연

의료 프로필 관련 일부 로컬 데이터에 Web Crypto API(AES-GCM)를 사용하는 시연 코드가 포함되어 있습니다.

`VITE_ENCRYPTION_KEY`는 Vite 클라이언트 번들에 포함되는 값이므로 **서버 비밀키가 아니며 실제 민감 의료정보 저장용 보안 모델로 간주하지 않습니다.**

---

## 4. 성능 개선 사례

병원 검색이 느렸던 가장 큰 원인은 E-Gen 실시간 병상 응답에 좌표가 없어 **수십 개 병원을 Kakao로 전부 geocoding**하던 구조였습니다.

이를 다음과 같이 개선했습니다.

1. E-Gen 지역 병원목록을 실시간 병상 조회와 병렬 호출
2. `HPID` 기준으로 공식 좌표를 정확 병합
3. 공식 좌표가 없는 병원만 Kakao fallback
4. 경로 계산은 초기 렌더링 이후 background enrichment
5. 경로 캐시 + in-flight dedup + 제한적 retry 적용

### 수동 계측 예시: 광주 검색

| 항목 | 개선 전 | 개선 후 관찰값 |
| --- | ---: | ---: |
| E-Gen fetch | 약 1.5s | 약 1~2s |
| Geocoding | **12,206ms** | **1ms** |
| Ranking | 1ms | 수 ms |
| E-Gen coordinate match | - | 61/61 (해당 실행) |

> 위 값은 브라우저의 내장 성능 telemetry로 관찰한 특정 실행 예시이며 공식 벤치마크가 아닙니다. 네트워크와 외부 API 상태에 따라 달라질 수 있습니다.

개발 중에는 콘솔의 `[PERF] hospital_search_initial`, `[PERF] hospital_search_complete`와 `window.__GOLDEN_TIME_PERF__`에서 최근 검색 계측값을 확인할 수 있습니다. 위치 좌표나 병원명은 성능 기록에 저장하지 않습니다.

---

## 5. 보안/운영 하드닝

### API 키 보호

- `EGEN_SERVICE_KEY`, `KAKAO_REST_API_KEY`는 Vercel Serverless Function에서만 사용
- 브라우저는 `/api/egen`, `/api/kakao/*` 프록시만 호출
- E-Gen endpoint allowlist
- GET-only / query validation / timeout / upstream error normalization
- 비밀값을 URL 로그나 저장소에 하드코딩하지 않음

### Content Security Policy

Production은 `Content-Security-Policy`를 **실제 enforce 상태**로 사용합니다.

- `default-src 'self'`
- `object-src 'none'`
- `frame-ancestors 'none'`
- Kakao Maps SDK/지도 리소스만 필요한 범위에서 허용
- Supabase/Sentry는 선택 기능 연결 범위만 허용

Kakao Maps SDK 내부 동작 때문에 현재 `script-src`에는 `'unsafe-eval'`이 포함됩니다. 애플리케이션 자체 inline JavaScript는 제거했습니다.

### CI Security Gate

GitHub Actions는 Node 24.x에서 `npm ci` 기반으로 재현 가능한 설치를 수행하고 아래 검증을 통과해야 합니다.

```text
npm audit --omit=dev --audit-level=moderate
Environment validation tests
Security header regression tests
Brand metadata regression tests
Storage scope regression tests
Unit Tests
Frontend Type Check
API Type Check
ESLint
API Tests
Production Build
```

Production dependency에서 moderate 이상 취약점이 발견되면 CI가 실패합니다.

---

## 6. 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | React 18, TypeScript 5.6, Vite 8 |
| State | Zustand |
| Styling | Tailwind CSS |
| Public data | National Emergency Medical Center E-Gen |
| Maps / Route | Kakao Maps SDK, Kakao Geocoding, Kakao Directions |
| Server boundary | Vercel Serverless Functions |
| Optional account backend | Supabase |
| Optional monitoring | Sentry (`VITE_SENTRY_DSN`이 있을 때만 초기화) |
| Testing | Node test runner, Vitest, Playwright |
| CI/CD | GitHub Actions, Vercel |
| Runtime | Node.js 24.x |

---

## 7. 프로젝트 구조

```text
golden-time/
├─ api/                         # Vercel serverless API proxies
│  ├─ egen.ts
│  └─ kakao/
├─ src/
│  ├─ domain/                  # Entities, value objects, ranking/use cases
│  ├─ data/                    # E-Gen/Kakao clients, repository implementation
│  ├─ infrastructure/          # Cache, Supabase, monitoring, security utilities
│  └─ presentation/            # React pages/components/hooks
├─ scripts/                    # env validation, crawler/maintenance scripts
├─ e2e/                        # Playwright scenarios
├─ docs/                       # operational/supporting documentation
├─ vercel.json                 # routing, cache headers, CSP
└─ .github/workflows/ci.yml    # quality/security gate
```

---

## 8. 로컬 실행

### 요구사항

- Node.js **24.x**
- npm
- E-Gen API service key
- Kakao REST API key
- Kakao JavaScript key

### 설치

```bash
git clone https://github.com/YunhuPark/golden-time.git
cd golden-time
npm ci
cp .env.example .env
```

Windows PowerShell에서는 `.env.example`을 `.env`로 직접 복사해도 됩니다.

### 핵심 환경 변수

```env
# Server-only secrets
EGEN_SERVICE_KEY=...
KAKAO_REST_API_KEY=...

# Browser public/config values
VITE_KAKAO_MAP_APP_KEY=...
VITE_ENCRYPTION_KEY=...

# Optional account features: disabled by default
VITE_SUPABASE_ENABLED=false
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Optional monitoring
VITE_SENTRY_DSN=
```

> `VITE_`로 시작하는 값은 브라우저 번들에 포함될 수 있으므로 서버 비밀값을 넣으면 안 됩니다.

### 실행

```bash
# Vite UI 개발 서버만 실행
npm run dev

# 동일한 UI 개발 서버 명령의 명시적 별칭
npm run dev:ui
```

> 현재 저장소는 Vercel CLI를 개발 의존성으로 포함하지 않습니다. Serverless API 프록시는 `npm run test:api`와 Vercel Preview/Production 배포에서 검증합니다.

### 품질 검증

```bash
npm run test:unit
npm run type-check
npm run type-check:api
npm run lint
npm run test:api
npm run build
```

---

## 9. 장애 대응 설계

Golden-Time은 외부 API를 많이 사용하므로 "항상 성공한다"고 가정하지 않습니다.

| 실패 지점 | 대응 |
| --- | --- |
| 위치 권한 거부/timeout | 별도 UI와 fallback 처리 |
| E-Gen 실패 | 최근 같은 지역 병원 캐시 사용 가능 |
| E-Gen 공식 좌표 일부 누락 | 해당 병원만 Kakao geocoding fallback |
| Kakao route timeout/5xx | 해당 요청만 1회 재시도 |
| 특정 병원 route 실패 | 다른 병원 결과 유지 |
| Supabase 장애/미설정 | 계정 기능만 fail-closed, 검색 기능 유지 |
| 오래되거나 다른 지역의 cache | 사용하지 않음 |

---

## 10. 현재 제한사항

- 공공데이터의 갱신 시점과 실제 현장 수용 가능 상태는 다를 수 있습니다.
- 병원이 표시되더라도 실제 환자 수용 가능 여부를 보장하지 않습니다.
- 경로시간은 Kakao API 응답과 당시 교통정보에 의존합니다.
- 행정지역 추론은 좌표 bounding rule 기반이며 법정 행정경계 GIS 판정이 아닙니다.
- Supabase 계정 기능은 기본 비활성이고, 운영하려면 별도 프로젝트/RLS 검증이 필요합니다.
- Sentry는 DSN이 설정된 경우에만 활성화됩니다.
- 클라이언트 암호화 기능은 보안 개념 시연이며 실제 의료정보 보관 설계가 아닙니다.

---

## 11. 포트폴리오에서 보여주려는 것

이 프로젝트의 핵심은 단순한 지도 UI가 아니라 아래 엔지니어링 문제를 실제 production 배포까지 해결한 과정입니다.

- 서로 다른 외부 데이터 소스의 식별자/좌표 병합
- 느린 critical path를 telemetry로 찾아 구조적으로 제거
- progressive rendering과 background enrichment
- timeout/retry/cache/dedup을 통한 외부 API resilience
- optional dependency의 fail-closed 설계
- 서버 비밀값 격리와 CSP enforcement
- CI 기반 dependency audit / type / lint / API regression gate
- 장애 시 stale cache를 명시적으로 표시하는 graceful degradation

---

## 12. 관련 문서

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — 배포 관련 가이드
- [`docs/PRODUCTION_CHECKLIST.md`](docs/PRODUCTION_CHECKLIST.md) — 배포 전/후 체크리스트
- [`docs/EXCEPTION_HANDLING_GUIDE.md`](docs/EXCEPTION_HANDLING_GUIDE.md) — 예외 처리 설계
- [`.env.example`](.env.example) — 현재 환경 변수 계약

---

## License / Disclaimer

개인 포트폴리오 프로젝트입니다. 실제 응급 상황에서는 **119 또는 의료기관의 공식 안내를 우선**하세요.
