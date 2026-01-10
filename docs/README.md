# 📚 Documentation

이 폴더에는 Golden Time 프로젝트의 상세 문서들이 포함되어 있습니다.

## 📋 문서 목록

### 시작하기
- **[QUICKSTART.md](./QUICKSTART.md)** - 빠른 시작 가이드 (5분 안에 프로젝트 실행)

### 배포 및 운영
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Vercel 배포 가이드
- **[PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)** - 프로덕션 배포 전 체크리스트

### 백엔드 설정
- **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** - Supabase 초기 설정 가이드
- **[SUPABASE_QUICKFIX.md](./SUPABASE_QUICKFIX.md)** - Supabase 관련 빠른 문제 해결
- **[GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md)** - Google OAuth 소셜 로그인 설정

### 기능별 가이드
- **[EMERGENCY_QR_SETUP.md](./EMERGENCY_QR_SETUP.md)** - 응급 QR 코드 생성 기능 가이드
- **[VISIT_TRACKING_GUIDE.md](./VISIT_TRACKING_GUIDE.md)** - 병원 방문 기록 기능 가이드
- **[EXCEPTION_HANDLING_GUIDE.md](./EXCEPTION_HANDLING_GUIDE.md)** - 예외 처리 및 에러 핸들링 가이드

### 테스트 및 품질
- **[TEST_REPORT.md](./TEST_REPORT.md)** - Playwright E2E 테스트 보고서

### 개발자 노트
- **[claude.md](./claude.md)** - Claude Code 프로젝트 헌법 및 개발 가이드라인

---

## 🗂️ 문서 카테고리별 색인

### 🚀 새로운 개발자를 위한 순서
1. [QUICKSTART.md](./QUICKSTART.md) - 프로젝트 실행
2. [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - 백엔드 설정
3. [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) - 로그인 기능 설정
4. [claude.md](./claude.md) - 개발 가이드라인 숙지

### 🔧 기능 개발자를 위한 가이드
- 응급 QR 기능: [EMERGENCY_QR_SETUP.md](./EMERGENCY_QR_SETUP.md)
- 방문 기록 기능: [VISIT_TRACKING_GUIDE.md](./VISIT_TRACKING_GUIDE.md)
- 에러 처리: [EXCEPTION_HANDLING_GUIDE.md](./EXCEPTION_HANDLING_GUIDE.md)

### 🚢 배포 담당자를 위한 가이드
1. [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) - 배포 전 체크
2. [DEPLOYMENT.md](./DEPLOYMENT.md) - Vercel 배포
3. [TEST_REPORT.md](./TEST_REPORT.md) - 테스트 결과 확인

---

## 📖 문서 작성 규칙

새로운 문서를 추가할 때는 다음 규칙을 따라주세요:

1. **파일명**: `UPPERCASE_WITH_UNDERSCORES.md` 형식 사용
2. **헤더**: 이모지를 포함한 명확한 제목
3. **목차**: 긴 문서는 목차 포함
4. **코드 블록**: 언어 지정 (```typescript, ```bash 등)
5. **스크린샷**: 필요시 `docs/images/` 폴더에 저장

---

## 🔗 관련 링크

- [메인 README](../README.md)
- [Supabase 마이그레이션](../supabase/migrations/)
- [테스트 코드](../tests/)
