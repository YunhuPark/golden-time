# Golden Time - 배포 가이드

이 문서는 Golden Time 애플리케이션의 프로덕션 배포 절차를 설명합니다.

## 목차

1. [사전 준비](#사전-준비)
2. [환경 변수 설정](#환경-변수-설정)
3. [빌드 및 테스트](#빌드-및-테스트)
4. [배포 플랫폼별 가이드](#배포-플랫폼별-가이드)
5. [배포 후 검증](#배포-후-검증)
6. [트러블슈팅](#트러블슈팅)

---

## 사전 준비

### 1. API 키 발급

배포 전에 다음 API 키들을 발급받아야 합니다:

#### 1.1 응급의료포털 API 서비스 키
- **발급처**: [공공데이터포털](https://www.data.go.kr/)
- **절차**:
  1. 공공데이터포털 회원가입 및 로그인
  2. [국립중앙의료원\_전국 응급의료기관 조회 서비스](https://www.data.go.kr/data/15000563/openapi.do) 페이지 접속
  3. "활용신청" 버튼 클릭
  4. 승인 완료 후 "마이페이지 > 오픈API > 개발계정" 에서 서비스 키 확인
- **소요 시간**: 보통 1-2시간 (빠르면 즉시, 늦으면 1영업일)

#### 1.2 Kakao API 키
- **발급처**: [Kakao Developers](https://developers.kakao.com/)
- **절차**:
  1. Kakao Developers 로그인 (카카오 계정 필요)
  2. "내 애플리케이션" > "애플리케이션 추가하기"
  3. 애플리케이션 이름 입력 후 생성
  4. "앱 설정 > 앱 키" 에서 **REST API 키**와 **JavaScript 키** 복사
  5. "플랫폼 > Web 플랫폼 추가" 클릭
  6. 배포할 사이트 도메인 등록 (예: `https://golden-time.vercel.app`)
- **필요한 키**:
  - `VITE_KAKAO_REST_API_KEY`: REST API 키
  - `VITE_KAKAO_MAP_APP_KEY`: JavaScript 키

#### 1.3 Supabase 프로젝트 생성
- **발급처**: [Supabase](https://supabase.com/)
- **절차**:
  1. Supabase 계정 생성 및 로그인
  2. "New Project" 클릭
  3. 프로젝트 이름, 데이터베이스 비밀번호, 리전(서울 추천) 선택
  4. 프로젝트 생성 완료 (약 2분 소요)
  5. "Settings > API" 에서 `Project URL`과 `anon public` 키 복사
  6. 데이터베이스 테이블 생성 (아래 SQL 실행)

**데이터베이스 테이블 생성 SQL**:
```sql
-- 즐겨찾기 테이블
CREATE TABLE favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id TEXT NOT NULL,
  hospital_name TEXT NOT NULL,
  hospital_address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 리뷰 테이블
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_hospital_id ON favorites(hospital_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_hospital_id ON reviews(hospital_id);

-- Row Level Security (RLS) 활성화
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (사용자는 자신의 데이터만 조회/수정 가능)
CREATE POLICY "Users can view own favorites" ON favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites" ON favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" ON favorites
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own reviews" ON reviews
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews" ON reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews" ON reviews
  FOR DELETE USING (auth.uid() = user_id);
```

#### 1.4 Sentry 프로젝트 생성 (선택사항)
- **발급처**: [Sentry](https://sentry.io/)
- **절차**:
  1. Sentry 계정 생성 (무료 플랜 사용 가능)
  2. "Projects > Create Project" 클릭
  3. 플랫폼: "React" 선택
  4. 프로젝트 이름 입력 후 생성
  5. "Settings > Projects > [프로젝트] > Client Keys (DSN)" 에서 DSN 복사
  6. (소스맵 업로드용) "Settings > Account > Auth Tokens" 에서 토큰 생성
     - 권한: `project:releases`, `project:write`

#### 1.5 암호화 키 생성
- **생성 방법**:
  ```bash
  # OpenSSL 사용
  openssl rand -hex 32

  # 또는 Node.js 사용
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **주의사항**:
  - 반드시 강력한 랜덤 값을 사용하세요
  - 이 키를 분실하면 암호화된 데이터를 복호화할 수 없습니다
  - 프로덕션 환경에서는 절대 기본값을 사용하지 마세요

---

## 환경 변수 설정

### 1. .env 파일 생성

```bash
# .env.example 파일을 복사하여 .env 파일 생성
cp .env.example .env
```

### 2. 환경 변수 값 입력

`.env` 파일을 열고 위에서 발급받은 키들을 입력합니다:

```bash
# 응급의료포털 API
VITE_EGEN_SERVICE_KEY=발급받은_서비스_키

# Kakao API
VITE_KAKAO_REST_API_KEY=발급받은_REST_API_키
VITE_KAKAO_MAP_APP_KEY=발급받은_JavaScript_키

# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=발급받은_anon_키

# 암호화 키
VITE_ENCRYPTION_KEY=생성한_32바이트_hex_키

# Sentry (선택사항)
VITE_SENTRY_DSN=발급받은_DSN
SENTRY_AUTH_TOKEN=생성한_Auth_Token
SENTRY_ORG=조직_slug
SENTRY_PROJECT=프로젝트_이름

# 환경 설정
VITE_ENV=production
VITE_APP_VERSION=0.1.0
```

### 3. 환경 변수 검증

```bash
# 프로덕션 환경 검증
npm run validate:env:prod

# 개발 환경 검증
npm run validate:env:dev
```

검증 스크립트가 모든 필수 환경 변수가 올바르게 설정되었는지 확인합니다.

---

## 빌드 및 테스트

### 1. 의존성 설치

```bash
npm install
```

### 2. 타입 체크

```bash
npm run type-check
```

TypeScript 타입 에러가 없는지 확인합니다.

### 3. Lint 체크

```bash
npm run lint
```

코드 스타일 및 잠재적 문제를 확인합니다.

### 4. 프로덕션 빌드

```bash
npm run build
```

이 명령어는 다음을 수행합니다:
1. 환경 변수 검증 (`npm run validate:env:prod`)
2. TypeScript 컴파일 (`tsc`)
3. Vite 프로덕션 빌드 (`vite build`)

빌드가 성공하면 `dist/` 폴더에 최적화된 파일들이 생성됩니다.

### 5. 로컬 프리뷰

```bash
npm run preview
```

프로덕션 빌드를 로컬에서 미리 테스트할 수 있습니다.

---

## 배포 플랫폼별 가이드

### Option 1: Vercel (권장)

Vercel은 React/Vite 애플리케이션 배포에 최적화되어 있으며, 자동 배포 및 무료 HTTPS를 제공합니다.

#### 1.1 Vercel CLI 사용

```bash
# Vercel CLI 설치
npm install -g vercel

# 로그인
vercel login

# 배포
vercel

# 프로덕션 배포
vercel --prod
```

#### 1.2 Vercel Dashboard 사용

1. [Vercel](https://vercel.com/) 로그인
2. "New Project" 클릭
3. GitHub 리포지토리 연결
4. 프로젝트 설정:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. 환경 변수 추가:
   - "Environment Variables" 섹션에서 `.env` 파일의 모든 변수 추가
   - `VITE_`로 시작하는 변수들은 클라이언트에 노출되므로 주의
6. "Deploy" 클릭

#### 1.3 자동 배포 설정

GitHub와 연동하면 `main` 브랜치에 푸시할 때마다 자동으로 배포됩니다.

---

### Option 2: Netlify

#### 2.1 Netlify CLI 사용

```bash
# Netlify CLI 설치
npm install -g netlify-cli

# 로그인
netlify login

# 배포
netlify deploy

# 프로덕션 배포
netlify deploy --prod
```

#### 2.2 netlify.toml 설정 파일

프로젝트 루트에 `netlify.toml` 파일 생성:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

### Option 3: GitHub Pages

#### 3.1 GitHub Actions 워크플로우

`.github/workflows/deploy.yml` 파일 생성:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        env:
          VITE_EGEN_SERVICE_KEY: ${{ secrets.VITE_EGEN_SERVICE_KEY }}
          VITE_KAKAO_REST_API_KEY: ${{ secrets.VITE_KAKAO_REST_API_KEY }}
          VITE_KAKAO_MAP_APP_KEY: ${{ secrets.VITE_KAKAO_MAP_APP_KEY }}
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_ENCRYPTION_KEY: ${{ secrets.VITE_ENCRYPTION_KEY }}
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
          VITE_ENV: production
        run: npm run build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

#### 3.2 GitHub Secrets 설정

1. GitHub 리포지토리 > Settings > Secrets and variables > Actions
2. "New repository secret" 클릭
3. `.env` 파일의 모든 환경 변수를 추가

---

## 배포 후 검증

### 1. 기능 테스트 체크리스트

배포 후 다음 기능들이 정상 작동하는지 확인하세요:

- [ ] 페이지 로딩 (초기 화면 표시)
- [ ] 위치 권한 요청 및 현재 위치 표시
- [ ] 병원 목록 로딩 및 표시
- [ ] 병원 검색 (키워드, 필터)
- [ ] 병원 상세 정보 모달
- [ ] Kakao 지도 표시
- [ ] 경로 안내 기능
- [ ] 로그인/회원가입 (Supabase)
- [ ] 즐겨찾기 추가/제거
- [ ] 리뷰 작성/수정/삭제
- [ ] 세션 만료 모달
- [ ] 119 긴급 호출 버튼
- [ ] 다크 모드 전환
- [ ] 모바일 반응형 UI

### 2. 성능 측정

#### 2.1 Lighthouse 테스트

Chrome DevTools > Lighthouse 탭에서 테스트:

- **Performance**: 90+ 목표
- **Accessibility**: 90+ 목표
- **Best Practices**: 90+ 목표
- **SEO**: 80+ 목표

#### 2.2 번들 사이즈 확인

```bash
npm run build
```

빌드 출력에서 각 청크의 크기를 확인:
- Main bundle: < 500KB (gzipped)
- Vendor bundles: < 300KB (gzipped)

### 3. Sentry 에러 모니터링 확인

- Sentry Dashboard에서 에러가 정상적으로 수집되는지 확인
- 테스트 에러 발생시켜 보기:
  ```javascript
  // 브라우저 콘솔에서
  throw new Error('Sentry test error');
  ```

### 4. 환경 변수 노출 확인

**중요**: 브라우저 개발자 도구에서 다음을 확인하세요:

- `VITE_`로 시작하는 환경 변수만 클라이언트에 노출됨
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` 등은 노출되지 않아야 함
- 소스 코드에 하드코딩된 API 키가 없는지 확인

---

## 트러블슈팅

### 문제 1: "환경 변수를 찾을 수 없습니다"

**증상**: 앱이 로딩되지 않거나 API 호출 실패

**해결 방법**:
```bash
# 1. .env 파일이 존재하는지 확인
ls -la .env

# 2. 환경 변수 검증
npm run validate:env:prod

# 3. 배포 플랫폼에서 환경 변수가 올바르게 설정되었는지 확인
# Vercel: Settings > Environment Variables
# Netlify: Site settings > Build & deploy > Environment
# GitHub Actions: Settings > Secrets and variables > Actions
```

### 문제 2: "Kakao 지도가 표시되지 않습니다"

**원인**: Kakao Developers에 도메인이 등록되지 않음

**해결 방법**:
1. [Kakao Developers](https://developers.kakao.com/) 로그인
2. 내 애플리케이션 > [프로젝트] > 플랫폼 > Web 플랫폼 수정
3. 배포한 사이트 도메인 추가 (예: `https://golden-time.vercel.app`)
4. 저장 후 5분 정도 대기

### 문제 3: "Supabase 인증이 작동하지 않습니다"

**원인**: Supabase 프로젝트에 허용된 URL이 설정되지 않음

**해결 방법**:
1. Supabase Dashboard > Authentication > URL Configuration
2. "Site URL"에 배포한 도메인 입력
3. "Redirect URLs"에 `https://your-domain.com/**` 추가

### 문제 4: "빌드가 실패합니다"

**일반적인 원인**:

1. **TypeScript 에러**:
   ```bash
   npm run type-check
   ```

2. **환경 변수 누락**:
   ```bash
   npm run validate:env:prod
   ```

3. **의존성 문제**:
   ```bash
   # package-lock.json 삭제 후 재설치
   rm package-lock.json
   rm -rf node_modules
   npm install
   ```

### 문제 5: "번들 사이즈가 너무 큽니다"

**해결 방법**:

1. **번들 분석**:
   ```bash
   npm install -D rollup-plugin-visualizer
   ```

2. **vite.config.ts**에 추가:
   ```typescript
   import { visualizer } from 'rollup-plugin-visualizer';

   export default defineConfig({
     plugins: [
       react(),
       visualizer({ open: true })
     ],
   });
   ```

3. 빌드 후 `stats.html` 파일에서 큰 모듈 확인

### 문제 6: "Sentry 소스맵이 업로드되지 않습니다"

**해결 방법**:

1. `SENTRY_AUTH_TOKEN`이 올바르게 설정되었는지 확인
2. Sentry 토큰 권한 확인: `project:releases`, `project:write`
3. 수동으로 소스맵 업로드:
   ```bash
   npx @sentry/cli releases files <VERSION> upload-sourcemaps ./dist
   ```

---

## 보안 체크리스트

배포 전 다음 항목들을 확인하세요:

- [ ] `.env` 파일이 `.gitignore`에 포함되어 Git에 커밋되지 않음
- [ ] 프로덕션 환경에서 강력한 암호화 키 사용 (기본값 X)
- [ ] Supabase Row Level Security (RLS) 정책 활성화
- [ ] API 키가 소스 코드에 하드코딩되지 않음
- [ ] HTTPS 사용 (배포 플랫폼이 자동 제공)
- [ ] Content Security Policy (CSP) 헤더 설정 (선택사항)
- [ ] 민감한 정보가 클라이언트 로그에 출력되지 않음 (프로덕션에서 console.log 제거됨)

---

## 추가 리소스

- [Vite 배포 가이드](https://vitejs.dev/guide/static-deploy.html)
- [Vercel 문서](https://vercel.com/docs)
- [Netlify 문서](https://docs.netlify.com/)
- [Supabase 문서](https://supabase.com/docs)
- [Sentry React 가이드](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Kakao Maps API 문서](https://apis.map.kakao.com/web/guide/)

---

## 지원

문제가 발생하면 다음을 확인하세요:

1. 이 문서의 [트러블슈팅](#트러블슈팅) 섹션
2. 브라우저 개발자 도구 콘솔 로그
3. Sentry 에러 로그 (설정된 경우)
4. 배포 플랫폼의 빌드 로그

---

**배포 완료 후 축하합니다!** 🎉

Golden Time이 성공적으로 배포되었습니다. 사용자들이 응급 상황에서 빠르게 병원을 찾을 수 있도록 도와주세요.
