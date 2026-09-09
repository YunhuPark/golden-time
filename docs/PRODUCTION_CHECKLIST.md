# ✅ Golden-Time Production Checklist

현재 Production 아키텍처 기준 체크리스트입니다.

## 필수 설정

- [ ] Node.js 24.x 사용
- [ ] `npm ci` 성공
- [ ] `EGEN_SERVICE_KEY` 설정
- [ ] `KAKAO_REST_API_KEY` 설정
- [ ] `VITE_KAKAO_MAP_APP_KEY` 설정
- [ ] `VITE_ENCRYPTION_KEY`가 placeholder가 아님
- [ ] Kakao Web 플랫폼에 Production 도메인 등록
- [ ] `.env` 및 비밀키가 Git에 포함되지 않음

## 선택 기능

### Supabase

- [ ] 사용하지 않을 경우 `VITE_SUPABASE_ENABLED=false`
- [ ] 활성화할 경우 별도 프로젝트 URL/key 설정
- [ ] 활성화 전 schema/RLS/auth redirect 검증
- [ ] Preview에서 로그인/즐겨찾기/리뷰/프로필 기능 검증

### Sentry

- [ ] 필요 시에만 `VITE_SENTRY_DSN` 설정
- [ ] telemetry에 정확 위치/주소/전화번호가 포함되지 않는지 확인

## CI / 품질

- [ ] `node --test scripts/validate-env.test.cjs`
- [ ] `npm run test:unit`
- [ ] `npm run type-check`
- [ ] `npm run type-check:api`
- [ ] `npm run lint`
- [ ] `npm run test:api`
- [ ] `npm run build`
- [ ] `npm audit --omit=dev --audit-level=moderate` 통과

> 전체 dev dependency audit는 별도 관리 대상입니다. Production dependency gate와 혼동하지 않습니다.

## 핵심 기능 Smoke Test

- [ ] 초기 페이지 로딩
- [ ] 위치 권한 허용/거부 처리
- [ ] E-Gen 병상 데이터 조회
- [ ] 병원 좌표 매칭
- [ ] 병원 목록 즉시 표시
- [ ] 상위 후보 경로시간 background enrichment
- [ ] 특정 route timeout 시 다른 병원 결과 유지
- [ ] API 실패 시 동일 지역 cache fallback
- [ ] 다른 지역/오래된 cache 거부
- [ ] Kakao 지도 표시
- [ ] 119 안내/전화 UI

## 보안

- [ ] Production 응답에 `Content-Security-Policy` 헤더 존재
- [ ] 서버 비밀키가 브라우저 bundle/Network URL에 노출되지 않음
- [ ] E-Gen endpoint allowlist 동작
- [ ] Kakao server proxy 입력 검증 동작
- [ ] Supabase 비활성 상태에서 외부 Supabase 요청이 발생하지 않음
- [ ] Sentry 활성 상태에서도 민감 telemetry 필드가 redaction됨
- [ ] 과거 공개된 API 키가 있다면 폐기/재발급 완료

## 배포 후 확인

- [ ] `https://golden-time.vercel.app/` 200
- [ ] Vercel deployment `READY`
- [ ] Console에 CSP violation 없음
- [ ] Console에 반복적인 외부 DNS 오류 없음
- [ ] `[PERF] hospital_search_initial` 기록 확인
- [ ] geocoding fallback이 불필요하게 대량 발생하지 않음
- [ ] E-Gen coordinate match 수치 확인

## 문서

- [ ] 루트 README가 실제 기능과 일치
- [ ] `.env.example`이 현재 환경 변수 계약과 일치
- [ ] 폐기된 프로젝트 URL/키/과거 실패 리포트가 문서에 남아 있지 않음
- [ ] 운영상 제한사항과 의료 면책 문구가 명확함
