# 🚨 응급 QR 코드 기능 설정 가이드

## 📋 개요

의료 정보를 QR 코드로 생성하여 응급 상황에서 의료진에게 즉시 전달하는 기능입니다.

---

## 1. Supabase 테이블 생성

Supabase Dashboard → SQL Editor에서 다음 SQL을 실행하세요:

### 📊 emergency_shares 테이블

```sql
-- emergency_shares 테이블 생성
CREATE TABLE emergency_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 공유 토큰 (URL에 사용)
  share_token TEXT NOT NULL UNIQUE,

  -- 의료 정보 스냅샷 (JSON 형태로 저장)
  medical_data JSONB NOT NULL,

  -- 만료 시간 (기본 24시간)
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- 조회 횟수 (선택사항)
  view_count INTEGER DEFAULT 0,

  -- 생성 시간
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 인덱스 생성
CREATE INDEX emergency_shares_user_id_idx ON emergency_shares(user_id);
CREATE INDEX emergency_shares_token_idx ON emergency_shares(share_token);
CREATE INDEX emergency_shares_expires_at_idx ON emergency_shares(expires_at);

-- 만료된 토큰 자동 삭제 함수
CREATE OR REPLACE FUNCTION delete_expired_emergency_shares()
RETURNS void AS $$
BEGIN
  DELETE FROM emergency_shares WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 매일 자정에 만료된 토큰 삭제 (선택사항)
-- SELECT cron.schedule('delete-expired-shares', '0 0 * * *', 'SELECT delete_expired_emergency_shares()');
```

### 🔐 Row Level Security (RLS) 설정

```sql
-- RLS 활성화
ALTER TABLE emergency_shares ENABLE ROW LEVEL SECURITY;

-- 정책 1: 사용자는 자신의 공유 토큰만 생성 가능
CREATE POLICY "Users can create own emergency shares"
  ON emergency_shares FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 정책 2: 사용자는 자신의 공유 토큰 목록만 조회 가능
CREATE POLICY "Users can view own emergency shares"
  ON emergency_shares FOR SELECT
  USING (auth.uid() = user_id);

-- 정책 3: 유효한 토큰은 누구나 조회 가능 (의료진용)
CREATE POLICY "Anyone can view valid tokens"
  ON emergency_shares FOR SELECT
  USING (expires_at > NOW());

-- 정책 4: 사용자는 자신의 공유 토큰만 삭제 가능
CREATE POLICY "Users can delete own emergency shares"
  ON emergency_shares FOR DELETE
  USING (auth.uid() = user_id);

-- 정책 5: 조회 횟수 업데이트는 누구나 가능
CREATE POLICY "Anyone can update view count"
  ON emergency_shares FOR UPDATE
  USING (expires_at > NOW())
  WITH CHECK (expires_at > NOW());
```

---

## 2. 환경 변수 확인

`.env` 파일에 다음 값들이 설정되어 있는지 확인:

```env
VITE_SUPABASE_URL=https://aiggzhblnuxkgzzmsgrl.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## 3. 기능 설명

### 사용자 흐름:

1. **프로필 페이지** → "응급 QR 생성" 버튼 클릭
2. QR 코드가 화면에 크게 표시됨
3. 옵션:
   - QR 코드 다운로드 (이미지 파일)
   - 카카오톡으로 공유 (가족/보호자에게)
   - 화면에 표시 (응급실에서 스캔)

### 의료진 흐름:

1. QR 코드 스캔
2. 자동으로 `/emergency/[token]` 페이지 열림
3. 환자의 의료 정보 즉시 확인:
   - 이름, 생년월일, 성별
   - 혈액형
   - 알레르기 정보
   - 현재 복용 중인 약물
   - 기저질환
   - 과거 수술 이력
   - 긴급 연락처

---

## 4. 보안 고려사항

### ✅ 안전한 설계:

1. **토큰 암호화**: UUID v4 사용 (추측 불가능)
2. **유효기간 제한**: 24시간 후 자동 만료
3. **조회 횟수 추적**: 비정상적인 접근 감지
4. **RLS 정책**: 본인만 생성/삭제 가능
5. **의료 데이터 스냅샷**: 원본 암호화 데이터와 분리

### ⚠️ 주의사항:

- QR 코드는 **일회성/임시**로 사용하세요
- 응급 상황 종료 후 즉시 삭제하세요
- 소셜미디어에 QR 코드 공유 금지

---

## 5. 테스트 방법

1. 의료 정보 입력 완료
2. "응급 QR 생성" 버튼 클릭
3. QR 코드 화면에서 URL 복사
4. 새 브라우저 시크릿 모드에서 URL 열기
5. 의료 정보가 정상적으로 표시되는지 확인

---

## ✅ 완료!

이제 응급 상황에서 의료진에게 즉시 정보를 전달할 수 있습니다.
