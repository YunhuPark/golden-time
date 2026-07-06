# 🏥 Medi-Matrix - AI 의료 영상 3D 분석 & 응급실 자동 매칭 시스템

> **진단부터 이송까지, 생명을 구하는 완벽한 AI 파이프라인**
> 환자의 MRI/생체신호 실시간 3D 뷰어 분석 ➔ 위급 상황 시 골든타임 응급실 자동 매칭

[![Live Demo](https://img.shields.io/badge/Demo-Live-success?style=for-the-badge&logo=vercel)](https://medi-matrix.vercel.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev/)

---

## 📋 프로젝트 개요

**Medi-Matrix**는 의료 현장에서 환자의 상태를 즉각적으로 파악하고 최적의 병원으로 이송하기 위한 **통합 의료 AI 웹 애플리케이션**입니다. 
단순한 병원 검색을 넘어, **[Phase 1] 환자의 의료 영상(MRI/CT) 및 생체 신호 실시간 3D 분석**을 거쳐, 위급 환자로 판별될 경우 **[Phase 2] 전국의 응급실 실시간 병상 현황 및 AI 병원 특화 진료과 매칭 시스템**으로 자동 전환되어 환자의 골든타임을 확보합니다.

---

## ✨ 핵심 기능

### 🧠 [Phase 1] Medical Image 3D Viewer & Multi-Modal Evaluation (의료 영상 & 생체신호 분석)
- **3D 메쉬 뷰어 렌더링**: 뇌(Brain) 및 폐(Lung) 원본 환자 MRI 데이터(`.nii.gz`)를 업로드하여 웹 브라우저에서 즉각적으로 3D 메쉬로 시각화합니다.
- **생체 신호 시계열 모니터링**: 환자의 바이탈 사인(`.csv`) 데이터를 업로드하고 실시간 모니터링을 진행합니다.
- **Multi-Modal AI 평가**: 마스크 파일(`.npy`, `.nii.gz`)을 기반으로 AI가 환자의 병변을 평가하고 응급도를 판별합니다.
- **자동 라우팅 시스템**: 분석 결과 환자가 즉각적인 처치가 필요한 위급 상황으로 판단되면, 즉시 **응급실 매칭 시스템(Phase 2)**으로 화면이 전환됩니다.

### 🤖 [Phase 2] AI 병원 특화 분야 크롤링 파이프라인 (자동화)
- **전국 400개 병원 자동 추적**: 매일 밤 자정, 국립중앙의료원(E-Gen) API에서 전국 응급의료기관 목록을 갱신합니다.
- **네이버 뉴스 & 리뷰 NLP 분석**: 각 병원의 최근 뉴스, 수술 실적, 리뷰 데이터를 수집하여 OpenAI(GPT-4o-mini)로 분석합니다.
- **특화 질환 자동 추출**: AI가 "이 병원은 어떤 응급 질환(심근경색, 뇌출혈, 소아 응급 등)에 강한가?"를 판단하여 Supabase 데이터베이스에 자동 적재합니다.

### 🚨 [Phase 2] 실시간 응급실 검색 & 스마트 추천 매칭
- **병상 가용률 실시간 반영**: E-Gen 실시간 병상 API(`getEmrrmRltmUsefulSckbdInfoInqire`)를 직접 호출하여 현재 자리가 있는 병원만 우선순위로 올립니다.
- **AI + 거리 + 병상 복합 스코어링**: 거리가 가깝고(30%), 병상이 넉넉하며(30%), 1단계에서 분석된 환자의 증상과 병원의 특화 분야가 일치하는(40%) 최적의 병원을 1순위로 추천합니다.
- **만실(0병상) 긴급 경고**: 반경 내 모든 병원이 만실일 경우, UI 전체에 즉각적인 레드 알럿(119 즉시 전화)을 띄워 환자의 생명을 보호합니다.

### 🗺️ 경로 안내 및 위치 시스템
- **Kakao Maps 연동**: 실시간 교통 정보가 반영된 정밀한 맵 렌더링.
- **GPS 자동 확장 검색**: 5km 내 병원이 없으면 10km → 20km → 50km로 자동 반경을 넓혀 탐색합니다.

### 👤 암호화된 의료 프로필 (Web Crypto API)
- **로컬 보안 저장**: 환자의 기저질환, 알레르기, 복용 약물 등을 군사급(AES-256-GCM)으로 암호화하여 기기에만 안전하게 저장합니다.
- **응급 의료진용 QR 코드**: 1초 만에 나의 필수 의료 정보를 담은 QR 코드를 생성하여 구급대원에게 보여줄 수 있습니다.

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

### Security
- **Web Crypto API** - AES-256-GCM 의료 데이터 암호화
- **Row-Level Security** - Supabase 데이터베이스 접근 제어
- **HTTPS Only** - 모든 통신 암호화

### Monitoring & Analytics
- **Sentry** - 에러 추적 및 성능 모니터링
- **Vercel Analytics** - 사용자 행동 분석

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
│   ├── manifest.json               # PWA 매니페스트
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
# 공공데이터포털 API 키 (응급의료포털)
VITE_EGEN_SERVICE_KEY=your_egen_api_key_here

# Kakao Maps JavaScript 키
VITE_KAKAO_MAP_APP_KEY=your_kakao_map_key_here

# 의료 데이터 암호화 키 (32바이트 hex)
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
3. 승인 후 (1~2일 소요) 서비스 키를 `.env`의 `VITE_EGEN_SERVICE_KEY`에 입력

> ⚠️ 개발용/운영용 키가 다르므로 주의하세요. 활용 신청 시 "운영 계정 활용 신청"을 선택하세요.

### 2. Kakao Maps API (필수)

1. [Kakao Developers](https://developers.kakao.com) 로그인
2. **내 애플리케이션** → **애플리케이션 추가하기**
3. **플랫폼** → **Web 플랫폼 추가** → 사이트 도메인 등록 (예: `http://localhost:3000`)
4. **앱 키** → **JavaScript 키** 복사
5. `.env`의 `VITE_KAKAO_MAP_APP_KEY`에 입력

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
# 타입 체크
npm run type-check

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

### 점수 계산식

```
최종 점수 = (거리 × 40%) + (병상 가용률 × 35%) +
           (이동 시간 × 15%) + (외상센터 등급 × 10%)
```

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

---

## 📱 PWA 기능

### 설치 가능한 웹 앱

- **홈 화면 추가**: 모바일 기기에서 네이티브 앱처럼 사용
- **오프라인 지원**: Service Worker로 핵심 리소스 캐싱
- **빠른 로딩**: Vercel CDN + 자산 사전 로딩

### 오프라인 전략

```javascript
// Service Worker 캐싱 전략
- HTML, CSS, JS: Cache First (즉시 로딩)
- 병원 데이터: Network First → Cache Fallback (최신 데이터 우선)
- 이미지, 폰트: Cache First (대역폭 절약)
```

---

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
- [x] PWA 기본 기능

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
