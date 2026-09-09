# 📚 Golden-Time Documentation

이 폴더에는 현재 Production 기준으로 유지할 가치가 있는 보조 문서만 둡니다. 프로젝트의 최신 개요, 아키텍처, 성능 개선 내역, 로컬 실행 방법은 루트 [`README.md`](../README.md)를 기준으로 합니다.

## 운영/배포

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Vercel 배포 및 환경 변수 설정
- [`PRODUCTION_CHECKLIST.md`](./PRODUCTION_CHECKLIST.md) — 배포 전후 확인 항목
- [`.env.example`](../.env.example) — 현재 환경 변수 계약

## 선택 기능

- [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) — Supabase 기반 인증/즐겨찾기/프로필/리뷰 기능을 **명시적으로 활성화할 때만** 참고
- [`GOOGLE_OAUTH_SETUP.md`](./GOOGLE_OAUTH_SETUP.md) — Supabase Auth에서 Google OAuth를 활성화할 때 참고
- [`EMERGENCY_QR_SETUP.md`](./EMERGENCY_QR_SETUP.md) — 응급 QR 관련 설명
- [`VISIT_TRACKING_GUIDE.md`](./VISIT_TRACKING_GUIDE.md) — 방문 기록 기능 설명

## 설계 참고

- [`EXCEPTION_HANDLING_GUIDE.md`](./EXCEPTION_HANDLING_GUIDE.md) — 장애/예외 처리 설계 참고

## 문서 원칙

- 구현과 다른 과거 계획/Phase 문서는 유지하지 않습니다.
- 비밀키, 실제 토큰, 실제 사용자 위치나 개인정보를 예시에 넣지 않습니다.
- Supabase/Sentry처럼 선택 기능은 기본 활성 기능처럼 표현하지 않습니다.
- 실제 Production 동작과 CI 상태가 바뀌면 루트 README를 먼저 갱신합니다.
