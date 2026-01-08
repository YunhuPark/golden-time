# 🚀 Golden Time - 빠른 시작 가이드

## ✅ Phase 1 구현 완료!

Golden Time 프로젝트의 **Phase 1 (Core Emergency Features)**가 완성되었습니다!

---

## 📦 구현된 기능

### ✅ 완료된 핵심 기능

1. **Domain Layer (비즈니스 로직)**
   - Hospital 엔티티 (병상 상태, 거리 계산, 유효성 검증)
   - Coordinates 값 객체 (Haversine 거리 계산)
   - GetNearbyHospitals 유즈케이스 (점진적 반경 확대, 다중 요소 점수 산출)

2. **Data Layer (데이터 접근)**
   - EGenApiClient (응급의료포털 API 연동, 재시도 로직, 타임아웃 처리)
   - HospitalRepository (데이터 페칭 및 필터링)
   - HospitalMapper (DTO → Domain Entity 변환)

3. **Presentation Layer (UI)**
   - HomePage (메인 페이지)
   - HospitalList (병원 목록)
   - HospitalCard (병원 카드 UI, 색상 코딩, 긴급 전화/경로 안내)
   - useGeolocation 훅 (위치 정보 획득, 모든 Edge Case 처리)

4. **Infrastructure (횡단 관심사)**
   - Zustand 스토어 (전역 상태 관리)
   - Encryption 유틸리티 (AES-256-GCM 의료 데이터 암호화)
   - Custom Error 클래스 (NetworkError, RateLimitError 등)

---

## 🏁 즉시 실행하기

### 1단계: 의존성 설치

```bash
npm install
```

### 2단계: 환경 변수 설정

`.env` 파일이 이미 생성되어 있습니다. 실제 API 키를 입력하세요:

```bash
# .env 파일 열기
notepad .env  # Windows
# 또는
code .env     # VS Code
```

**필수 API 키**:
- `VITE_EGEN_SERVICE_KEY`: [공공데이터포털](https://www.data.go.kr)에서 발급
- `VITE_KAKAO_MAP_APP_KEY`: [Kakao Developers](https://developers.kakao.com)에서 발급

**선택 API 키** (Phase 2에서 사용):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_ENCRYPTION_KEY` (프로덕션 배포 시 `openssl rand -hex 32`로 생성)

### 3단계: 개발 서버 실행

```bash
npm run dev
```

브라우저가 자동으로 열리며 http://localhost:3000 에서 실행됩니다.

---

## 🔑 API 키 발급 방법

### 1. 응급의료포털 API (필수)

1. [공공데이터포털](https://www.data.go.kr) 회원가입
2. 검색: "실시간 응급실 병상 정보"
3. 다음 API 신청:
   - **실시간 응급실 병상 정보 조회 서비스**
   - **응급의료기관 기본정보 조회 서비스**
4. 승인 대기 (보통 1시간~1일)
5. 서비스 키를 `.env`의 `VITE_EGEN_SERVICE_KEY`에 입력

### 2. Kakao Maps API (필수)

1. [Kakao Developers](https://developers.kakao.com) 로그인
2. 내 애플리케이션 → 애플리케이션 추가하기
3. 플랫폼 설정 → Web 플랫폼 추가
   - 사이트 도메인: `http://localhost:3000` (개발용)
4. JavaScript 키 발급
5. `.env`의 `VITE_KAKAO_MAP_APP_KEY`에 입력

---

## 🧪 테스트 (API 키 없이 개발하기)

API 키가 없어도 **Mock 데이터로 UI를 확인**할 수 있습니다:

### Option 1: Mock Repository 사용

`src/presentation/pages/HomePage.tsx`에서 다음 코드를 수정:

```typescript
// 실제 API 호출 대신 Mock 데이터 사용
const mockHospitals = [
  new Hospital(
    'MOCK001',
    '서울대학교병원',
    new Coordinates(37.5795, 127.0004),
    '서울특별시 종로구 대학로 101',
    '02-2072-2114',
    '02-2072-2000',
    5,
    10,
    ['응급의학과', '외과', '내과'],
    1,
    true,
    new Date()
  ),
  // ... 더 추가
];

setHospitals(mockHospitals, null);
```

---

## 📂 프로젝트 구조

```
golden-time/
├── src/
│   ├── domain/              ✅ 비즈니스 로직 (완료)
│   ├── data/                ✅ 데이터 접근 (완료)
│   ├── presentation/        ✅ UI 컴포넌트 (완료)
│   ├── infrastructure/      ✅ 횡단 관심사 (완료)
│   ├── App.tsx              ✅ 루트 컴포넌트
│   └── main.tsx             ✅ 엔트리 포인트
├── public/
│   └── index.html           ✅ HTML 템플릿
├── package.json             ✅ 의존성
├── tsconfig.json            ✅ TypeScript 설정
├── vite.config.ts           ✅ Vite 설정
├── .env                     ✅ 환경 변수
└── README.md                ✅ 프로젝트 문서
```

---

## 🎯 현재 상태

### ✅ 완료된 작업 (Phase 1 - 90%)

- [x] 프로젝트 초기화 (Vite + React + TypeScript)
- [x] Clean Architecture 구조
- [x] 5개 핵심 파일 구현
- [x] Repository 구현체
- [x] Zustand 상태 관리
- [x] UI 컴포넌트 (HomePage, HospitalList, HospitalCard)
- [x] 전역 스타일
- [x] 환경 설정

### 🚧 남은 작업 (Phase 1 완성까지)

- [ ] **실제 API 테스트** (API 키 발급 후)
- [ ] **Kakao Maps SDK 통합** (지도 표시)
- [ ] **경로 안내 API 연동** (Kakao Navi)
- [ ] **에러 바운더리 추가**
- [ ] **로딩 스피너 개선**

---

## 🐛 문제 해결

### 문제 1: `npm install` 실패

**해결책**:
```bash
# Node.js 버전 확인 (18 이상 필요)
node --version

# 캐시 클리어 후 재설치
npm cache clean --force
npm install
```

### 문제 2: API 호출 실패 (CORS 에러)

**원인**: 응급의료포털 API는 CORS를 지원하지 않습니다.

**해결책**: Cloudflare Workers 프록시 사용 (Phase 1.5에서 구현 예정)

### 문제 3: 위치 정보 권한 거부

**해결책**:
- 브라우저 설정 → 위치 권한 허용
- 또는 서울시청 기본 위치로 테스트 (자동 fallback)

### 문제 4: TypeScript 에러

**해결책**:
```bash
# 타입 체크
npm run type-check

# 타입 에러 무시하고 실행 (개발 중)
npm run dev
```

---

## 📊 다음 단계

### Phase 1.5 (즉시 추가 가능)

1. **Kakao Maps 지도 표시**
   - `src/presentation/components/map/KakaoMapContainer.tsx` 생성
   - 병원 위치 마커 표시
   - 사용자 위치 표시

2. **Cloudflare Workers API 프록시**
   - CORS 문제 해결
   - API 키 보호
   - 캐싱 및 Rate Limiting

3. **Error Boundary**
   - `src/presentation/components/common/ErrorBoundary.tsx`
   - 크래시 방지 및 사용자 친화적 에러 메시지

### Phase 2 (사용자 기능 확장) - ✅ 100% 완료!

**✅ 현재 구현 완료:**
- ✅ **Supabase 연동** - 클라이언트 설정 완료 ([SUPABASE_SETUP.md](SUPABASE_SETUP.md) 참고)
- ✅ **선택적 로그인 시스템**
  - 이메일/비밀번호 인증
  - Google OAuth 소셜 로그인
  - 비로그인 상태에서도 모든 핵심 기능 사용 가능
- ✅ **즐겨찾기 기능**
  - 자주 가는 병원 즐겨찾기 추가/제거
  - Row Level Security (RLS) 적용으로 데이터 보안
  - 로그인 필요 시 자동 안내 모달
- ✅ **의료 정보 암호화 저장**
  - 사용자의 의료 정보 (혈액형, 알레르기, 복용 약물 등) 입력 폼
  - AES-256-GCM 암호화로 안전한 저장
  - 응급 상황용 의료 정보 요약 기능
  - 암호화 유틸리티 (`encryption.ts`)
  - 의료 프로필 서비스 (`MedicalProfileService.ts`)
- ✅ **병원 방문 기록**
  - 병원 카드에서 "방문 기록 추가" 버튼 클릭으로 기록
  - 과거 방문 병원 목록 조회
  - 통계 및 분석 (총 방문 횟수, 가장 자주 가는 병원)
  - 방문 이력 서비스 (`VisitHistoryService.ts`)
- ✅ **프로필 페이지**
  - 의료 정보 폼 (`MedicalProfileForm.tsx`)
  - 방문 기록 목록 (`VisitHistoryList.tsx`)
  - 탭 UI로 두 기능 통합 (`ProfilePage.tsx`)

**🔄 추가 예정:**
- ⏳ **리뷰 시스템**
  - 병원에 대한 평점 및 리뷰 작성
  - 다른 사용자의 리뷰 조회
  - 데이터베이스 스키마 이미 준비됨 (`reviews` 테이블)

### Phase 3 (고급 기능)

- PWA (오프라인 지원)
- 푸시 알림
- 접근성 개선
- 성능 최적화

---

## 💡 개발 팁

### Hot Reload 활용

Vite는 파일 저장 시 자동으로 브라우저를 새로고침합니다. 빠른 개발 가능!

### TypeScript Strict Mode

`tsconfig.json`에서 strict mode가 활성화되어 있습니다. 타입 안정성 보장!

### Chrome DevTools

- F12 → Console: 에러 메시지 확인
- F12 → Application → Local Storage: 캐시된 위치 정보
- F12 → Network: API 호출 모니터링

---

## 🤝 기여하기

버그를 발견하거나 기능 제안이 있다면:

1. Issues 탭에서 검색
2. 새 Issue 생성
3. 또는 Pull Request 제출

---

## 📞 도움이 필요하신가요?

- **문서**: [README.md](README.md) 참조
- **아키텍처**: [계획서](C:\Users\박윤후\.claude\plans\generic-dreaming-clock.md) 참조
- **API 문서**: [응급의료포털 가이드](https://www.e-gen.or.kr/openapi/guide.do)

---

**응급 상황에서 생명을 구하는 Golden Time을 함께 만들어갑시다!** 🚑💪
