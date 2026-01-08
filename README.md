# 🏥 Golden Time

> **실시간 응급실 가용 현황 및 최단 경로 안내 시스템**
> 응급 상황에서 가장 빠르게 치료받을 수 있는 병원을 찾아드립니다.

---

## 📋 프로젝트 개요

Golden Time은 **생명이 걸린 순간**, 사용자 주변의 응급실 병상 가용 현황을 실시간으로 확인하고 최적의 병원까지 경로를 안내하는 웹 애플리케이션입니다.

### 핵심 기능

- ✅ **실시간 응급실 병상 현황** - 국립중앙의료원 응급의료포털 API 연동
- ✅ **최적 병원 추천** - 거리, 병상 가용률, 전문 진료과, 외상센터 등급 종합 분석
- ✅ **경로 안내** - Kakao Maps 기반 실시간 교통 정보 반영
- ✅ **긴급 전화 연동** - 119 및 병원 직통 전화 원터치 호출
- ✅ **의료 프로필 관리** - 혈액형, 알레르기, 기저질환 암호화 저장

---

## 🏗️ 기술 스택

### Frontend
- **React 18** + **TypeScript** - 타입 안정성 보장
- **Vite** - 빠른 개발 서버 및 빌드
- **Zustand** - 경량 상태 관리
- **Kakao Maps SDK** - 한국 최적화 지도 서비스

### Backend & Infrastructure
- **Cloudflare Workers** - 엣지 컴퓨팅 기반 API 프록시
- **Supabase** - PostgreSQL 기반 사용자 데이터 저장
- **IndexedDB** - 클라이언트 사이드 캐싱

### Security
- **Web Crypto API** - AES-256-GCM 의료 데이터 암호화
- **Row-Level Security** - Supabase 데이터베이스 접근 제어

---

## 📂 프로젝트 구조 (Clean Architecture)

```
golden-time/
├── src/
│   ├── domain/                 # 비즈니스 로직 (프레임워크 독립적)
│   │   ├── entities/           # Hospital, UserProfile
│   │   ├── usecases/           # GetNearbyHospitals, CalculateOptimalRoute
│   │   ├── repositories/       # 인터페이스 정의
│   │   └── valueObjects/       # Coordinates, BloodType
│   │
│   ├── data/                   # 데이터 접근 계층
│   │   ├── datasources/
│   │   │   ├── remote/         # EGenApiClient (응급의료포털)
│   │   │   └── local/          # IndexedDB, LocalStorage
│   │   ├── repositories/       # Repository 구현체
│   │   └── models/             # DTO 및 Mapper
│   │
│   ├── presentation/           # UI 계층
│   │   ├── components/         # React 컴포넌트
│   │   ├── pages/              # 페이지 컴포넌트
│   │   └── hooks/              # useGeolocation, useHospitals
│   │
│   └── infrastructure/         # 횡단 관심사
│       ├── state/              # Zustand 스토어
│       ├── config/             # 환경 설정
│       ├── utils/              # 암호화, 검증
│       └── errors/             # 커스텀 에러 클래스
```

---

## 🚀 빠른 시작

### 1. 사전 요구사항

- **Node.js** 18 이상
- **npm** 또는 **yarn**

### 2. 설치

```bash
# 저장소 클론
git clone https://github.com/your-username/golden-time.git
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
- `VITE_EGEN_SERVICE_KEY` - [공공데이터포털](https://www.data.go.kr)에서 응급의료포털 API 키 발급
- `VITE_KAKAO_MAP_APP_KEY` - [Kakao Developers](https://developers.kakao.com)에서 JavaScript 키 발급
- `VITE_ENCRYPTION_KEY` - 32바이트 암호화 키 생성 (`openssl rand -hex 32`)

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

1. [공공데이터포털](https://www.data.go.kr) 회원가입
2. 다음 API 신청:
   - **실시간 응급실 병상 정보 조회 서비스**
   - **응급의료기관 기본정보 조회 서비스**
3. 승인 후 서비스 키를 `.env`의 `VITE_EGEN_SERVICE_KEY`에 입력

### 2. Kakao Maps API (필수)

1. [Kakao Developers](https://developers.kakao.com) 로그인
2. 앱 생성 → 플랫폼 추가 (Web)
3. JavaScript 키 발급
4. `.env`의 `VITE_KAKAO_MAP_APP_KEY`에 입력

### 3. Supabase (선택 - 사용자 프로필 기능용)

1. [Supabase](https://supabase.com) 프로젝트 생성
2. Project URL 및 Anon Key 복사
3. `.env`에 입력

---

## 🧪 테스트

```bash
# 단위 테스트
npm run test

# 타입 체크
npm run type-check

# 린트
npm run lint
```

---

## 🛡️ 보안

### 의료 데이터 암호화

모든 민감한 의료 정보(혈액형, 알레르기, 기저질환)는 **AES-256-GCM** 알고리즘으로 암호화됩니다.

```typescript
import { encryptString, decryptString } from '@infrastructure/utils/encryption';

// 저장 전 암호화
const encrypted = await encryptString('A형');

// 불러올 때 복호화
const decrypted = await decryptString(encrypted); // 'A형'
```

### API 키 보호

- ❌ 프론트엔드 코드에 API 키 직접 노출 금지
- ✅ Cloudflare Workers를 통한 프록시 패턴 사용
- ✅ 환경 변수는 `.gitignore`에 포함되어 Git에 커밋되지 않음

---

## 📊 알고리즘: 최적 병원 선정

Golden Time은 다중 요소 점수 시스템으로 최적의 병원을 추천합니다.

```
최종 점수 = (이동시간 × 50%) + (병상가용률 × 30%) +
           (전문과매칭 × 15%) + (외상센터등급 × 5%)
```

### 검색 반경 전략

1. **1단계**: 5km 이내 검색 → 10개 이상 병원 발견 시 중단
2. **2단계**: 10km 이내 검색 → 5개 이상 병원 발견 시 중단
3. **3단계**: 20km 이내 검색 → 3개 이상 병원 발견 시 중단
4. **최종**: 50km 이내 모든 병원 반환

---

## ⚠️ Edge Case 처리

Golden Time은 **모든 예외 상황**을 처리합니다:

| 상황 | 처리 방법 |
|------|----------|
| 위치 권한 거부 | 서울시청 기본 위치 + 수동 입력 옵션 제공 |
| API 타임아웃 | Exponential Backoff 재시도 (2초, 4초, 8초) |
| 주변에 병원 없음 | 119 호출 버튼 표시 |
| 모든 응급실 만실 | 119 병상 배정 요청 안내 |
| 네트워크 오프라인 | 캐시된 데이터 사용 (최대 5분) |
| 낮은 GPS 정확도 (>100m) | 경고 배너 표시 + Wi-Fi 활성화 권장 |

---

## 🎨 UX 원칙 (응급 상황 최적화)

### 패닉 프루프 디자인

- **대형 터치 영역** (최소 44px) - 떨리는 손도 정확한 탭 가능
- **색상 코딩** - 🟢 녹색(가능) / 🟡 노랑(제한) / 🔴 빨강(만실)
- **단순한 계층** - 상위 3개 병원은 스크롤 없이 표시
- **원터치 액션** - 확인 대화상자 없이 즉시 실행

---

## 📱 PWA 지원 (예정)

Phase 3에서 Progressive Web App 기능 추가:

- 홈 화면에 설치 가능
- 오프라인 모드 (Service Worker)
- 푸시 알림 (병상 가용 상태 변경 시)

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
```

---

## 📜 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

## 📞 문의

프로젝트 관련 문의사항은 [Issues](https://github.com/your-username/golden-time/issues)에 등록해주세요.

---

## 🙏 감사의 말

- **국립중앙의료원** - 응급의료포털 API 제공
- **Kakao** - Kakao Maps API 제공
- **공공데이터포털** - 오픈 API 플랫폼

---

**⚠️ 면책 조항**: 이 애플리케이션은 정보 제공 목적으로만 사용됩니다. 실제 응급 상황에서는 반드시 119에 먼저 연락하시기 바랍니다.
