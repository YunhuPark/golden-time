# 🗄️ Supabase Database

이 폴더에는 Golden Time 프로젝트의 Supabase 데이터베이스 스키마 및 마이그레이션 파일이 포함되어 있습니다.

## 복구 후 필수 보안 마이그레이션

프로젝트가 복구됐다는 상태만으로 테이블 접근 정책이 안전하다고 판단하지 마세요.
프런트엔드의 `VITE_SUPABASE_ENABLED=false`는 직접 Data API 접근을 차단하지 않습니다.
복원 작업이 **완료된 뒤** 다음 마이그레이션을 데이터베이스 소유자로 적용하고,
실제 `pg_class.relrowsecurity`, 정책 및 역할별 권한을 확인하세요. 복원 중 적용한
설정은 복원된 데이터베이스로 교체되면서 사라질 수 있습니다.

1. `20261113000000_secure_emergency_shares.sql`
2. `20261118000000_secure_private_tables.sql`

새 데이터베이스는 먼저 `supabase_schema.sql`로 기본 테이블을 생성해야 합니다.

두 번째 마이그레이션은 행을 삭제하지 않고 기존의 모든 정책을 재설정합니다.
의료 프로필·방문 기록·즐겨찾기는 인증된 소유자에게만 허용합니다. 병원 리뷰의
공개 읽기는 기존 제품 동작대로 유지하며, 생성·변경·삭제는 인증된 소유자에게만
허용합니다. 익명 쓰기와 모든 클라이언트의 TRUNCATE 권한은 제거합니다.
공개 병원 전문과목 참조 데이터도 클라이언트에는 읽기만 허용하며, 크롤러의
별도 `service_role` 권한은 유지합니다. RLS는 TRUNCATE 권한을 대신하지 않습니다.
검증이 끝나기 전에는 Supabase 선택 기능을 활성화하지 마세요.

실제 PostgreSQL 권한 회귀 테스트(환자 데이터·운영 자격 증명 사용 없음):

```sh
NODE_PATH=/path/to/rls-runtime/node_modules node --test scripts/emergency-rls.test.cjs scripts/private-tables-rls.test.cjs
```

테스트 런타임은 `@electric-sql/pglite@0.5.16`이며 CI에서도 별도 임시 경로에
설치해 익명 접근, 소유자 간 경계, 소유자 변경, TRUNCATE 및 재적용을 검증합니다.

## 📂 폴더 구조

```
supabase/
├── README.md                           # 이 파일
└── migrations/                         # 데이터베이스 마이그레이션
    ├── supabase_schema.sql            # 전체 스키마 (초기 설정)
    └── supabase_migration_add_hospital_info.sql  # 병원 정보 필드 추가
```

---

## 📋 데이터베이스 스키마

Golden Time은 다음 테이블들을 사용합니다:

### 1. `medical_profiles` - 의료 프로필
사용자의 의료 정보를 브라우저에서 암호화(AES-GCM)해 저장합니다. 암호화 키(`VITE_ENCRYPTION_KEY`)는 앱 번들에 포함되므로 **서버 비밀키가 아니며, 실제 접근 제어는 RLS 정책**이 담당합니다.

**컬럼:**
- `id` (UUID, PK) - 프로필 고유 ID
- `user_id` (UUID, FK → auth.users) - 사용자 ID
- `blood_type_encrypted` (TEXT) - 암호화된 혈액형
- `allergies_encrypted` (TEXT) - 암호화된 알레르기 정보
- `chronic_diseases_encrypted` (TEXT) - 암호화된 기저질환
- `medications_encrypted` (TEXT) - 암호화된 복용 약물
- `surgeries_encrypted` (TEXT) - 암호화된 수술 이력
- `emergency_contact_encrypted` (TEXT) - 암호화된 응급 연락처
- `notes_encrypted` (TEXT) - 암호화된 특이사항
- `created_at` (TIMESTAMP) - 생성 시간
- `updated_at` (TIMESTAMP) - 수정 시간

**보안:**
- Row-Level Security (RLS) 활성화
- 사용자는 자신의 의료 정보만 조회/수정 가능

---

### 2. `favorites` - 즐겨찾기
사용자가 즐겨찾기한 병원 목록입니다.

**컬럼:**
- `id` (UUID, PK) - 즐겨찾기 고유 ID
- `user_id` (UUID, FK → auth.users) - 사용자 ID
- `hospital_id` (TEXT) - 병원 고유 ID (응급의료포털 API)
- `hospital_name` (TEXT) - 병원 이름
- `hospital_address` (TEXT) - 병원 주소
- `hospital_phone` (TEXT) - 병원 전화번호
- `created_at` (TIMESTAMP) - 추가 시간

**인덱스:**
- `idx_favorites_user_hospital` (user_id, hospital_id) - 중복 방지 및 빠른 조회

**보안:**
- RLS 활성화
- 사용자는 자신의 즐겨찾기만 조회/추가/삭제 가능

---

### 3. `visit_history` - 병원 방문 기록
과거 방문한 병원 이력을 저장합니다.

**컬럼:**
- `id` (UUID, PK) - 방문 기록 고유 ID
- `user_id` (UUID, FK → auth.users) - 사용자 ID
- `hospital_id` (TEXT) - 병원 고유 ID
- `hospital_name` (TEXT) - 병원 이름
- `hospital_address` (TEXT) - 병원 주소
- `hospital_phone` (TEXT) - 병원 전화번호
- `visit_date` (DATE) - 방문 날짜
- `visit_reason` (TEXT) - 방문 사유
- `notes` (TEXT) - 메모
- `source` (TEXT) - 추가 방법 ('auto' | 'manual')
- `created_at` (TIMESTAMP) - 생성 시간

**인덱스:**
- `idx_visit_history_user_date` (user_id, visit_date DESC) - 날짜순 정렬

**보안:**
- RLS 활성화
- 사용자는 자신의 방문 기록만 조회/추가/수정/삭제 가능

---

### 4. `reviews` - 병원 리뷰
사용자가 작성한 병원 후기입니다.

**컬럼:**
- `id` (UUID, PK) - 리뷰 고유 ID
- `user_id` (UUID, FK → auth.users) - 작성자 ID
- `hospital_id` (TEXT) - 병원 고유 ID
- `hospital_name` (TEXT) - 병원 이름
- `rating` (INTEGER, 1~5) - 별점
- `content` (TEXT) - 리뷰 내용
- `created_at` (TIMESTAMP) - 작성 시간
- `updated_at` (TIMESTAMP) - 수정 시간

**인덱스:**
- `idx_reviews_hospital` (hospital_id, created_at DESC) - 병원별 리뷰 조회
- `idx_reviews_user` (user_id, created_at DESC) - 사용자별 리뷰 조회

**보안:**
- RLS 활성화
- 모든 사용자는 리뷰 조회 가능
- 사용자는 자신의 리뷰만 수정/삭제 가능

---

## 🚀 스키마 적용 방법

### 방법 1: Node.js 스크립트 사용 (권장)

```bash
# 프로젝트 루트에서 실행
npm run apply-schema
```

이 명령은 `scripts/apply-schema.js`를 실행하여 자동으로 스키마를 적용합니다.

### 방법 2: Supabase Dashboard 사용

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. **SQL Editor** 메뉴 클릭
4. `migrations/supabase_schema.sql` 파일 내용 복사
5. SQL 에디터에 붙여넣기
6. **Run** 버튼 클릭

---

## 🔐 Row-Level Security (RLS) 정책

모든 테이블에 RLS가 활성화되어 있으며, 다음 정책이 적용됩니다:

### medical_profiles
```sql
-- 사용자는 자신의 의료 정보만 조회 가능
CREATE POLICY "Users can view own medical profile"
  ON medical_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 자신의 의료 정보만 수정 가능
CREATE POLICY "Users can update own medical profile"
  ON medical_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- 사용자는 자신의 의료 정보를 생성 가능
CREATE POLICY "Users can insert own medical profile"
  ON medical_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### favorites, visit_history, reviews
유사한 RLS 정책이 적용되어 사용자는 자신의 데이터만 접근할 수 있습니다.

---

## 📊 마이그레이션 히스토리

| 파일 | 날짜 | 설명 |
|------|------|------|
| `supabase_schema.sql` | 2024-12-29 | 초기 스키마 생성 (모든 테이블) |
| `supabase_migration_add_hospital_info.sql` | 2025-01-02 | 병원 정보 필드 추가 (favorites, visit_history에 hospital_phone 등) |

---

## 🔧 유용한 SQL 쿼리

### 사용자별 통계 조회
```sql
SELECT
  u.email,
  COUNT(DISTINCT f.id) as favorites_count,
  COUNT(DISTINCT v.id) as visits_count,
  COUNT(DISTINCT r.id) as reviews_count
FROM auth.users u
LEFT JOIN favorites f ON u.id = f.user_id
LEFT JOIN visit_history v ON u.id = v.user_id
LEFT JOIN reviews r ON u.id = r.user_id
GROUP BY u.email;
```

### 병원별 리뷰 평균 별점
```sql
SELECT
  hospital_name,
  COUNT(*) as review_count,
  ROUND(AVG(rating), 2) as avg_rating
FROM reviews
GROUP BY hospital_name
ORDER BY avg_rating DESC, review_count DESC;
```

### 최근 방문 기록 (자동/수동 구분)
```sql
SELECT
  hospital_name,
  visit_date,
  source,
  visit_reason
FROM visit_history
WHERE user_id = auth.uid()
ORDER BY visit_date DESC
LIMIT 10;
```

---

## 📝 데이터베이스 백업

Supabase는 자동 백업을 제공하지만, 수동 백업도 가능합니다:

```bash
# Supabase CLI 사용
supabase db dump -f backup.sql

# 특정 테이블만 백업
supabase db dump -t medical_profiles -t favorites -f backup_user_data.sql
```

---

## 🔗 관련 문서

- [Supabase Setup Guide](../docs/SUPABASE_SETUP.md)
- [Supabase Quickfix](../docs/SUPABASE_QUICKFIX.md)
- [Main README](../README.md)
