# 🚑 Golden-Time - 실시간 응급실 검색 시스템

> **응급 상황 발생 시 최적의 병상 검색 지원 (포트폴리오/프로토타입)**
> 전국 응급실 병상 가용 현황을 파악하여 적합한 병원으로 안내를 돕는 시스템입니다.
> ⚠️ 이 프로젝트는 포트폴리오 목적이며, 실제 의료 판단이나 응급 구조 요청(119)을 대체하지 않습니다.

[![Live Demo](https://img.shields.io/badge/Demo-Live-success?style=for-the-badge&logo=vercel)](https://golden-time.vercel.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev/)

---

## 📋 프로젝트 개요

**Golden-Time**은 응급 상황에서 환자를 수용 가능한 병원으로 안내하는 **응급실 검색 시스템**입니다.
추후 외부 의료 영상 분석 프로젝트인 **Medi-Matrix**와 연동하여 분석 결과를 기반으로 적합한 병원을 찾을 수 있도록 구상 중인 독립적인 웹 애플리케이션입니다.

---

## ✨ 핵심 기능

### 🚨 실시간 응급실 검색 & 추천 매칭
- **병상 가용률 실시간 파악**: 국립중앙의료원(E-Gen) API를 호출하여 현재 가용 병상이 있는 병원을 우선적으로 안내합니다.
- **다중 요소 스코어링**: 최단 소요 시간, 병상 여유, 질환 적합도, 외상센터 등급, 운영 여부를 기반으로 점수를 합산하여 병원을 추천합니다.
- **만실 긴급 경고**: 반경 내 응급실이 모두 만실일 경우, 레드 알럿(119 호출 안내) UI로 전환됩니다.

### 🤖 AI 기반 병원 특화 분야 데이터 파이프라인
- **전국 병원 무인 자동 모니터링**: 백그라운드 파이프라인을 통해 각 병원의 최신 진료 특화 분야 데이터를 지속 갱신합니다.
- **비용 최적화 캐싱**: 빈번한 API 호출을 줄이고 데이터 최신성을 보장하기 위해 TTL 기반 Negative 캐싱을 적극 활용합니다.

### 🗺️ 정밀 GPS 탐색 및 카카오 모빌리티 연동
- **위치 기반 자동 반경 확장 검색**: 환자 주변 5km 이내 병원이 부족하면 10km → 20km → 50km로 반경을 스마트하게 확대합니다.
- **Kakao Directions API**: 실시간 교통 상황을 반영한 정확한 도착 예상 시간(ETA)과 경로를 제공합니다.

### 👤 로컬 의료 프로필 암호화 시연 (Web Crypto API)
- **로컬 보안 저장**: 기저질환, 알레르기 등을 브라우저 내장 Web Crypto API (AES-256-GCM)로 암호화하여 기기에 저장하는 기능을 시연합니다. (주의: 프론트엔드 환경의 특성상 완전한 보안을 보장하지 않습니다.)
- **응급 의료진용 QR 코드**: 의료 정보를 담은 QR 코드를 생성합니다.

---

## 🏗️ 기술 스택

### Frontend
- **React 18** + **TypeScript** - 타입 안정성 보장
- **Vite 6** - 초고속 개발 서버 및 빌드 (HMR)
- **Zustand** - 경량 상태 관리 라이브러리
- **Tailwind CSS** + **shadcn/ui** - Utility-first CSS + 디자인 시스템
- **Kakao Maps SDK** - 지도 및 경로 안내

### Backend & Infrastructure
- **Supabase** - PostgreSQL 기반 백엔드 (인증, DB, RLS)
- **Vercel** - 글로벌 CDN 배포 및 서버리스 함수
- **Google OAuth 2.0** - 소셜 로그인
- **IndexedDB** - 클라이언트 사이드 캐싱

### Security & Monitoring
- **Web Crypto API** - 의료 데이터 암호화 구현 시연
- **Row-Level Security** - Supabase 데이터베이스 접근 제어
- **Sentry** - 에러 추적 및 성능 모니터링

---

## 📂 프로젝트 구조 (Clean Architecture)

```
golden-time/
├── src/
│   ├── domain/                     # 비즈니스 로직 (프레임워크 독립적)
│   │   ├── entities/               # 핵심 엔티티
│   │   │   ├── Hospital.ts         # 병원 정보
│   │   │   ├── HospitalRoute.ts    # 경로 정보
│   │   │   └── UserProfile.ts      # 사용자 프로필
│   │   ├── usecases/               # 유즈케이스
│   │   │   ├── GetNearbyHospitals.ts
│   │   │   └── CalculateOptimalRoute.ts
│   │   ├── repositories/           # Repository 인터페이스
│   │   │   └── IHospitalRepository.ts
│   │   └── types/                  # 도메인 타입
│   │       ├── HospitalFilter.ts
│   │       └── SortOption.ts
│   │
│   ├── data/                       # 데이터 접근 계층
│   │   ├── datasources/
│   │   │   ├── remote/
│   │   │   │   ├── EGenApiClient.ts  # 응급의료포털 API
│   │   │   │   └── KakaoMapClient.ts # 카카오맵 API
│   │   │   └── local/
│   │   │       └── IndexedDBClient.ts
│   │   ├── repositories/
│   │   │   └── HospitalRepositoryImpl.ts
│   │   └── models/                 # DTO 및 Mapper
│   │       └── HospitalDTO.ts
│   │
│   ├── presentation/               # UI 계층
│   │   ├── components/
│   │   │   ├── hospital/           # 병원 관련 컴포넌트
│   │   │   │   ├── HospitalList.tsx
│   │   │   │   ├── HospitalCard.tsx
│   │   │   │   ├── HospitalDetailModal.tsx
│   │   │   │   ├── HospitalBottomSheet.tsx
│   │   │   │   └── HospitalFilterPanel.tsx
│   │   │   ├── profile/            # 프로필 관련 컴포넌트
│   │   │   │   ├── MedicalProfileForm.tsx
│   │   │   │   ├── EmergencyQRGenerator.tsx
│   │   │   │   ├── VisitHistoryList.tsx
│   │   │   │   ├── FavoritesList.tsx
│   │   │   │   └── MyReviewsList.tsx
│   │   │   ├── review/             # 리뷰 관련 컴포넌트
│   │   │   │   ├── ReviewList.tsx
│   │   │   │   └── ReviewForm.tsx
│   │   │   ├── map/                # 지도 컴포넌트
│   │   │   │   └── KakaoMap.tsx
│   │   │   ├── auth/               # 인증 컴포넌트
│   │   │   │   └── LoginModal.tsx
│   │   │   └── common/             # 공통 컴포넌트
│   │   │       ├── EcgLoader.tsx   # ECG 애니메이션 로더
│   │   │       ├── ThemeToggle.tsx # 다크모드 토글
│   │   │       └── NetworkStatusBanner.tsx
│   │   ├── pages/
│   │   │   ├── HomePage.tsx        # 메인 페이지
│   │   │   └── ProfilePage.tsx     # 프로필 페이지
│   │   ├── hooks/                  # Custom Hooks
│   │   │   ├── useGeolocation.ts   # GPS 위치 정보
│   │   │   ├── useAuth.ts          # 인증 상태
│   │   │   └── useNetworkStatus.ts # 네트워크 상태
│   │   └── styles/
│   │       ├── global.css          # 글로벌 스타일 (Tailwind)
│   │       └── theme.ts            # 테마 설정
│   │
│   └── infrastructure/             # 횡단 관심사
│       ├── state/
│       │   └── store.ts            # Zustand 글로벌 스토어
│       ├── supabase/
│       │   └── supabaseClient.ts   # Supabase 초기화
│       ├── cache/
│       │   └── HospitalCache.ts    # 병원 데이터 캐싱
│       ├── monitoring/
│       │   └── sentry.ts           # Sentry 에러 추적
│       └── utils/
│           ├── encryption.ts       # AES-256-GCM 암호화
│           └── validation.ts       # 입력값 검증
│
├── public/                         # 정적 파일
│   └── icons/                      # 앱 아이콘
│
├── scripts/                        # 유틸리티 스크립트
│   └── apply-schema.js             # Supabase 스키마 적용
│
└── supabase/                       # Supabase 설정
    └── migrations/                 # DB 마이그레이션
```

---

## 🚀 빠른 시작

### 1. 사전 요구사항

- **Node.js** 18 이상
- **npm** 또는 **yarn**

### 2. 설치

```bash
# 저장소 클론
git clone https://github.com/YunhuPark/golden-time.git
cd golden-time

# 의존성 설치
npm install
```

### 3. 환경 변수 설정

`.env.example`을 `.env`로 복사하고 실제 값을 입력하세요:

```bash
cp .env.example .env
```

필수 환경 변수:

```env
# 서버 전용 환경 변수 (브라우저에 노출되지 않음)
EGEN_SERVICE_KEY=your_egen_api_key_here
KAKAO_REST_API_KEY=your_kakao_rest_key_here

# 브라우저 전용 환경 변수
# ⚠️ VITE_ 접두사가 붙은 변수는 브라우저 번들에 포함되므로 실제 비밀 키를 넣지 마세요!
VITE_KAKAO_MAP_APP_KEY=your_kakao_map_key_here

# 클라이언트 사이드 암호화 키 (주의: 소스 코드에 노출되므로 완전한 보안이 아님)
VITE_ENCRYPTION_KEY=your_encryption_key_here

# Supabase 설정
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google OAuth (선택)
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id

# Sentry (선택)
VITE_SENTRY_DSN=your_sentry_dsn
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속

### 5. 프로덕션 빌드

```bash
npm run build
npm run preview  # 빌드 결과 미리보기
```

---

## 🔑 API 키 발급 가이드

### 1. 응급의료포털 API (필수)

1. [공공데이터포털](https://www.data.go.kr) 회원가입 및 로그인
2. 다음 API 신청:
   - **실시간 응급실 병상 정보 조회 서비스**
   - **응급의료기관 기본정보 조회 서비스**
3. 승인 후 서비스 키를 `.env`의 `EGEN_SERVICE_KEY`에 입력

> ⚠️ 개발용/운영용 키가 다르므로 주의하세요. 활용 신청 시 "운영 계정 활용 신청"을 선택하세요.

### 2. Kakao Maps API (필수)

1. [Kakao Developers](https://developers.kakao.com) 로그인
2. **내 애플리케이션** → **애플리케이션 추가하기**
3. **플랫폼** → **Web 플랫폼 추가** → 사이트 도메인 등록 (예: `http://localhost:3000`)
4. **앱 키** → **JavaScript 키** 복사 후 `.env`의 `VITE_KAKAO_MAP_APP_KEY`에 입력
5. **REST API 키** 복사 후 `.env`의 `KAKAO_REST_API_KEY`에 입력

### 3. Supabase (선택 - 사용자 프로필 기능용)

1. [Supabase](https://supabase.com) 회원가입
2. **New Project** 생성
3. **Project Settings** → **API**에서:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Project API keys** → **anon public** → `VITE_SUPABASE_ANON_KEY`
4. 데이터베이스 스키마 적용:
   ```bash
   npm run apply-schema
   ```

### 4. Google OAuth (선택 - 소셜 로그인용)

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth Client ID**
3. **Application type**: Web application
4. **Authorized JavaScript origins**: `http://localhost:3000`, `https://your-domain.com`
5. **Authorized redirect URIs**: `https://your-supabase-project.supabase.co/auth/v1/callback`
6. Client ID 복사 → `.env`의 `VITE_GOOGLE_CLIENT_ID`에 입력

---

## 🧪 테스트

```bash
# 프론트엔드 타입 체크
npm run type-check

# API 타입 체크
npm run type-check:api

# API 단위 테스트
npm run test:api

# Playwright E2E 테스트
npm run test:e2e

# 린트
npm run lint
```

---

## 🛡️ 보안

### 의료 데이터 암호화

모든 민감한 의료 정보는 **AES-256-GCM** 알고리즘으로 클라이언트 사이드에서 암호화됩니다.

```typescript
import { encryptString, decryptString } from '@/infrastructure/utils/encryption';

// 저장 전 암호화
const encrypted = await encryptString('A+');

// 불러올 때 복호화
const decrypted = await decryptString(encrypted); // 'A+'
```

### Supabase Row-Level Security (RLS)

데이터베이스 접근 제어:

```sql
-- 사용자는 자신의 의료 정보만 조회/수정 가능
CREATE POLICY "Users can view own medical profile"
  ON medical_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own medical profile"
  ON medical_profiles FOR UPDATE
  USING (auth.uid() = user_id);
```

### API 키 보호

- ❌ 프론트엔드 코드에 API 키 직접 노출 금지
- ✅ 환경 변수 사용 (`.env` 파일은 `.gitignore`에 포함)
- ✅ Vercel 환경 변수에 프로덕션 키 등록

---

## 📊 알고리즘: 최적 병원 선정

Golden Time은 다중 요소 점수 시스템으로 최적의 병원을 추천합니다.

### 점수 항목 (총점 130점)

- **경로 소요시간 (최대 40점)**: 가장 빠른 병원 40점, 가장 느린 병원 0점 비례 할당. 경로 정보가 없으면 기본 20점.
- **병상 가용률 (최대 30점)**: 가용 비율에 따라 20~30점 부여. 제한적일 시 15점, 만실이면 0점 처리.
- **질환 적합도 (최대 30점)**: 환자의 질환과 병원의 진료 특화 분야가 매칭될 경우 추가 점수.
- **외상센터 등급 (최대 20점)**: 권역외상센터 20점, 지역외상센터 15점, 일반센터 10점, 없음 5점.
- **응급실 운영 여부 (최대 10점)**: 현재 운영 중일 시 10점.

### 검색 반경 전략

1. **1단계**: 5km 이내 검색 → 10개 이상 병원 발견 시 중단
2. **2단계**: 10km 이내 검색 → 5개 이상 병원 발견 시 중단
3. **3단계**: 20km 이내 검색 → 3개 이상 병원 발견 시 중단
4. **최종**: 50km 이내 모든 병원 반환

---

## ⚠️ Edge Case 처리

Golden Time은 **모든 예외 상황**을 안전하게 처리합니다:

| 상황 | 처리 방법 |
|------|----------|
| 위치 권한 거부 | 수동 위치 입력 옵션 + 서울시청 기본 위치 제공 |
| GPS 타임아웃 (모바일) | 10초 대기 후 최후 위치 사용 |
| GPS 타임아웃 (데스크톱) | 30초 대기 (Wi-Fi 기반 위치 측정) |
| API 타임아웃 | 15초 타임아웃 + IndexedDB 캐시 사용 |
| 주변에 병원 없음 | "119 호출" 버튼 + 검색 반경 확대 제안 |
| 모든 응급실 만실 | 119 병상 배정 요청 안내 표시 |
| 네트워크 오프라인 | 캐시된 데이터 사용 (최대 5분) + 배너 표시 |
| 낮은 GPS 정확도 (>100m) | 경고 배너 + Wi-Fi 활성화 권장 |
| 암호화 키 없음 | 의료 정보 저장 불가 + 안내 메시지 |
| Supabase 연결 실패 | 로컬 저장소 사용 + 동기화 대기 |

---

## 🎨 UX 원칙 (응급 상황 최적화)

### 패닉 프루프 디자인

- **대형 터치 영역**: 최소 44px × 44px - 떨리는 손도 정확한 탭 가능
- **색상 코딩**: 🟢 녹색(가능) / 🟡 노랑(제한) / 🔴 빨강(만실) - 직관적 상태 인식
- **단순한 계층**: 상위 3개 병원은 스크롤 없이 표시
- **원터치 액션**: 전화 걸기, 경로 안내 등 확인 대화상자 최소화
- **ECG 로딩 애니메이션**: 사용자가 시스템 작동을 인지하도록 심전도 애니메이션 표시
- **다크 모드 Neon Glow**: 야간 응급 상황에서도 가독성 확보



## 🤝 기여 가이드

1. 이 저장소를 Fork합니다
2. 새 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'feat: Add amazing feature'`)
4. 브랜치에 Push합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

### 커밋 컨벤션

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅 (기능 변경 없음)
refactor: 코드 리팩토링
test: 테스트 코드 추가
chore: 빌드 설정 변경
perf: 성능 개선
```

---

## 📈 성능 최적화

- **Code Splitting**: 라우트 기반 동적 import로 초기 로딩 속도 개선
- **이미지 최적화**: WebP 포맷 + lazy loading
- **API 요청 최적화**: Debouncing + Request Deduplication
- **상태 관리 최적화**: Zustand의 선택적 구독으로 불필요한 리렌더링 방지
- **Bundle 크기 최적화**: Tree-shaking + 미사용 코드 제거

---

## 🌍 브라우저 지원

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ 모바일 브라우저 (iOS Safari, Chrome Mobile)

---

## 📜 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

## 📚 상세 문서

자세한 설정 및 사용 가이드는 다음 문서를 참조하세요:

- **[📖 전체 문서 목록](./docs/)** - 모든 상세 문서
- **[🗄️ 데이터베이스 스키마](./supabase/)** - Supabase 스키마 및 마이그레이션
- **[🚀 빠른 시작](./docs/QUICKSTART.md)** - 5분 안에 프로젝트 실행
- **[🔐 Supabase 설정](./docs/SUPABASE_SETUP.md)** - 백엔드 초기 설정
- **[🚢 배포 가이드](./docs/DEPLOYMENT.md)** - Vercel 배포 방법

---

## 📞 문의

프로젝트 관련 문의사항은 [Issues](https://github.com/YunhuPark/golden-time/issues)에 등록해주세요.

---

## 🙏 감사의 말

- **국립중앙의료원** - 응급의료포털 API 제공
- **Kakao** - Kakao Maps API 제공
- **공공데이터포털** - 오픈 API 플랫폼
- **Supabase** - 백엔드 인프라
- **Vercel** - 배포 플랫폼

---

## 🗺️ 로드맵

### Phase 1: Core Features ✅ (완료)
- [x] 실시간 응급실 검색
- [x] Kakao Maps 경로 안내
- [x] 의료 프로필 관리
- [x] 응급 QR 생성
- [x] 병원 리뷰 시스템
- [x] 다크 모드 지원

### Phase 2: Enhancement (진행 중)
- [ ] Service Worker 완전한 오프라인 지원
- [ ] 푸시 알림 (병상 변동 시)
- [ ] 다국어 지원 (영어, 일본어, 중국어)
- [ ] 음성 안내 기능

### Phase 3: Advanced Features (예정)
- [ ] AI 기반 증상 분석 및 병원 추천
- [ ] 응급 상황 실시간 공유 (가족/보호자)
- [ ] 병원 혼잡도 예측 (머신러닝)
- [ ] Apple Watch / Wear OS 연동

---

**⚠️ 면책 조항**: 이 애플리케이션은 정보 제공 목적으로만 사용됩니다. 실제 응급 상황에서는 반드시 119에 먼저 연락하시기 바랍니다.

---

<div align="center">
  <strong>생명을 구하는 골든타임, 함께 지켜요 🚑</strong>
</div>
