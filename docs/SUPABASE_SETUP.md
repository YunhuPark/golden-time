# 🗄️ Supabase 설정 가이드

Golden Time 앱의 선택적 로그인 및 즐겨찾기 기능을 위한 Supabase 설정 가이드입니다.

## 📋 목차

1. [Supabase 프로젝트 생성](#supabase-프로젝트-생성)
2. [데이터베이스 스키마 생성](#데이터베이스-스키마-생성)
3. [Row Level Security (RLS) 설정](#row-level-security-rls-설정)
4. [Google OAuth 설정](#google-oauth-설정)
5. [환경 변수 설정](#환경-변수-설정)

---

## 1. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에 접속하여 계정 생성/로그인
2. "New Project" 클릭
3. 프로젝트 정보 입력:
   - Project name: `golden-time`
   - Database Password: 안전한 비밀번호 생성 (저장 필수!)
   - Region: `Northeast Asia (Seoul)`
4. "Create new project" 클릭 (약 2분 소요)

---

## 2. 데이터베이스 스키마 생성

프로젝트 생성 완료 후, 좌측 메뉴에서 **SQL Editor** 선택 후 다음 SQL을 실행하세요:

### 📊 favorites 테이블 (즐겨찾기)

```sql
-- favorites 테이블 생성
CREATE TABLE favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id TEXT NOT NULL,
  hospital_name TEXT NOT NULL,
  hospital_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,

  -- 중복 방지: 동일 사용자가 같은 병원을 두 번 즐겨찾기할 수 없음
  UNIQUE(user_id, hospital_id)
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX favorites_user_id_idx ON favorites(user_id);
CREATE INDEX favorites_hospital_id_idx ON favorites(hospital_id);
CREATE INDEX favorites_created_at_idx ON favorites(created_at DESC);
```

### 📝 reviews 테이블 (리뷰 - 향후 추가용)

```sql
-- reviews 테이블 생성 (향후 확장용)
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,

  -- 중복 방지: 동일 사용자가 같은 병원에 여러 리뷰 작성 불가
  UNIQUE(user_id, hospital_id)
);

-- 인덱스 생성
CREATE INDEX reviews_user_id_idx ON reviews(user_id);
CREATE INDEX reviews_hospital_id_idx ON reviews(hospital_id);
CREATE INDEX reviews_created_at_idx ON reviews(created_at DESC);
CREATE INDEX reviews_rating_idx ON reviews(rating);
```

### 🏥 medical_profiles 테이블 (의료 정보 - 암호화 저장)

```sql
-- medical_profiles 테이블 생성
CREATE TABLE medical_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 암호화된 의료 정보 (JSON 형태로 저장)
  encrypted_data TEXT NOT NULL,

  -- 암호화 메타데이터
  encryption_version INTEGER DEFAULT 1,

  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 인덱스 생성
CREATE INDEX medical_profiles_user_id_idx ON medical_profiles(user_id);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_medical_profiles_updated_at BEFORE UPDATE
  ON medical_profiles FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();
```

### 📚 visit_history 테이블 (병원 방문 기록)

```sql
-- visit_history 테이블 생성
CREATE TABLE visit_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id TEXT NOT NULL,
  hospital_name TEXT NOT NULL,
  hospital_address TEXT NOT NULL,

  -- 방문 정보
  visit_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  visit_reason TEXT, -- 방문 사유 (선택사항)
  notes TEXT, -- 메모 (선택사항)

  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 인덱스 생성
CREATE INDEX visit_history_user_id_idx ON visit_history(user_id);
CREATE INDEX visit_history_hospital_id_idx ON visit_history(hospital_id);
CREATE INDEX visit_history_visit_date_idx ON visit_history(visit_date DESC);
CREATE INDEX visit_history_created_at_idx ON visit_history(created_at DESC);
```

---

## 3. Row Level Security (RLS) 설정

데이터 보안을 위해 RLS를 활성화합니다. SQL Editor에서 실행:

### 🔐 favorites 테이블 RLS

```sql
-- RLS 활성화
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- 정책 1: 사용자는 자신의 즐겨찾기만 조회 가능
CREATE POLICY "Users can view own favorites"
  ON favorites FOR SELECT
  USING (auth.uid() = user_id);

-- 정책 2: 사용자는 자신의 즐겨찾기만 추가 가능
CREATE POLICY "Users can insert own favorites"
  ON favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 정책 3: 사용자는 자신의 즐겨찾기만 삭제 가능
CREATE POLICY "Users can delete own favorites"
  ON favorites FOR DELETE
  USING (auth.uid() = user_id);
```

### 🔐 reviews 테이블 RLS

```sql
-- RLS 활성화
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 정책 1: 모든 사용자가 리뷰 조회 가능 (익명 포함)
CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  USING (true);

-- 정책 2: 로그인한 사용자만 리뷰 작성 가능
CREATE POLICY "Authenticated users can insert reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 정책 3: 사용자는 자신의 리뷰만 수정 가능
CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 정책 4: 사용자는 자신의 리뷰만 삭제 가능
CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);
```

### 🔐 medical_profiles 테이블 RLS

```sql
-- RLS 활성화
ALTER TABLE medical_profiles ENABLE ROW LEVEL SECURITY;

-- 정책 1: 사용자는 자신의 의료 프로필만 조회 가능
CREATE POLICY "Users can view own medical profile"
  ON medical_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- 정책 2: 사용자는 자신의 의료 프로필만 생성 가능
CREATE POLICY "Users can insert own medical profile"
  ON medical_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 정책 3: 사용자는 자신의 의료 프로필만 수정 가능
CREATE POLICY "Users can update own medical profile"
  ON medical_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 정책 4: 사용자는 자신의 의료 프로필만 삭제 가능
CREATE POLICY "Users can delete own medical profile"
  ON medical_profiles FOR DELETE
  USING (auth.uid() = user_id);
```

### 🔐 visit_history 테이블 RLS

```sql
-- RLS 활성화
ALTER TABLE visit_history ENABLE ROW LEVEL SECURITY;

-- 정책 1: 사용자는 자신의 방문 기록만 조회 가능
CREATE POLICY "Users can view own visit history"
  ON visit_history FOR SELECT
  USING (auth.uid() = user_id);

-- 정책 2: 사용자는 자신의 방문 기록만 추가 가능
CREATE POLICY "Users can insert own visit history"
  ON visit_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 정책 3: 사용자는 자신의 방문 기록만 수정 가능
CREATE POLICY "Users can update own visit history"
  ON visit_history FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 정책 4: 사용자는 자신의 방문 기록만 삭제 가능
CREATE POLICY "Users can delete own visit history"
  ON visit_history FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 4. Google OAuth 설정

Google 로그인을 활성화하려면:

### 4.1 Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. 좌측 메뉴: **APIs & Services** → **Credentials**
4. **Create Credentials** → **OAuth 2.0 Client IDs**
5. Application type: **Web application**
6. Name: `Golden Time`
7. **Authorized redirect URIs** 추가:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   (Supabase 프로젝트의 URL은 Settings → API에서 확인)

8. **Create** 클릭
9. **Client ID**와 **Client Secret** 복사

### 4.2 Supabase에 Google OAuth 등록

1. Supabase Dashboard → **Authentication** → **Providers**
2. **Google** 선택
3. **Enable Google Provider** 활성화
4. 복사한 **Client ID**와 **Client Secret** 입력
5. **Save** 클릭

---

## 5. 환경 변수 설정

### 5.1 Supabase URL 및 Anon Key 확인

1. Supabase Dashboard → **Settings** → **API**
2. 다음 값들을 복사:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** (API Key)

### 5.2 .env 파일 생성

프로젝트 루트에 `.env` 파일 생성:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

⚠️ **중요**: `.env` 파일은 절대 Git에 커밋하지 마세요!

---

## ✅ 설정 완료 확인

모든 설정이 완료되었으면 앱을 실행하여 테스트:

```bash
npm run dev
```

### 테스트 체크리스트

- [ ] 로그인 없이 병원 검색 가능
- [ ] 즐겨찾기 버튼 클릭 시 로그인 모달 표시
- [ ] 이메일 로그인 가능
- [ ] Google 로그인 가능
- [ ] 로그인 후 즐겨찾기 추가/제거 가능
- [ ] 로그아웃 후에도 핵심 기능 사용 가능

---

## 🚀 추가 기능 (선택사항)

### 이메일 인증 비활성화 (개발용)

개발 중에는 이메일 인증을 건너뛸 수 있습니다:

1. Supabase Dashboard → **Authentication** → **Providers** → **Email**
2. **Confirm email** 체크 해제
3. **Save**

⚠️ **프로덕션에서는 반드시 활성화하세요!**

---

## 📞 문제 해결

### 로그인 시 CORS 에러 발생

Supabase Dashboard → **Settings** → **API** → **CORS**에서 허용된 도메인 확인:

```
http://localhost:3003
http://localhost:5173
```

### Google 로그인 리다이렉트 실패

Authorized redirect URIs가 정확한지 확인:

```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

---

## 📚 참고 자료

- [Supabase 공식 문서](https://supabase.com/docs)
- [Supabase Auth 가이드](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
