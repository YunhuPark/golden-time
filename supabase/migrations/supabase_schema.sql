-- ===================================
-- Golden Time Database Schema
-- 전체 테이블 및 RLS 정책 생성
-- ===================================

-- 1. favorites 테이블 생성
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id TEXT NOT NULL,
  hospital_name TEXT NOT NULL,
  hospital_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(user_id, hospital_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON favorites(user_id);
CREATE INDEX IF NOT EXISTS favorites_hospital_id_idx ON favorites(hospital_id);
CREATE INDEX IF NOT EXISTS favorites_created_at_idx ON favorites(created_at DESC);

-- 2. reviews 테이블 생성 (향후 확장용)
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id TEXT NOT NULL,
  hospital_name TEXT NOT NULL,
  hospital_address TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(user_id, hospital_id)
);

CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON reviews(user_id);
CREATE INDEX IF NOT EXISTS reviews_hospital_id_idx ON reviews(hospital_id);
CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_rating_idx ON reviews(rating);

-- 3. medical_profiles 테이블 생성 (암호화된 의료 정보)
CREATE TABLE IF NOT EXISTS medical_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_data TEXT NOT NULL,
  encryption_version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS medical_profiles_user_id_idx ON medical_profiles(user_id);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_medical_profiles_updated_at ON medical_profiles;
CREATE TRIGGER update_medical_profiles_updated_at BEFORE UPDATE
  ON medical_profiles FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- 4. visit_history 테이블 생성 (병원 방문 기록)
CREATE TABLE IF NOT EXISTS visit_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id TEXT NOT NULL,
  hospital_name TEXT NOT NULL,
  hospital_address TEXT NOT NULL,
  visit_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  visit_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS visit_history_user_id_idx ON visit_history(user_id);
CREATE INDEX IF NOT EXISTS visit_history_hospital_id_idx ON visit_history(hospital_id);
CREATE INDEX IF NOT EXISTS visit_history_visit_date_idx ON visit_history(visit_date DESC);
CREATE INDEX IF NOT EXISTS visit_history_created_at_idx ON visit_history(created_at DESC);

-- ===================================
-- Row Level Security (RLS) 설정
-- ===================================

-- favorites RLS
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own favorites" ON favorites;
CREATE POLICY "Users can view own favorites"
  ON favorites FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own favorites" ON favorites;
CREATE POLICY "Users can insert own favorites"
  ON favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own favorites" ON favorites;
CREATE POLICY "Users can delete own favorites"
  ON favorites FOR DELETE
  USING (auth.uid() = user_id);

-- reviews RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON reviews;
CREATE POLICY "Authenticated users can insert reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;
CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);

-- medical_profiles RLS
ALTER TABLE medical_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own medical profile" ON medical_profiles;
CREATE POLICY "Users can view own medical profile"
  ON medical_profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own medical profile" ON medical_profiles;
CREATE POLICY "Users can insert own medical profile"
  ON medical_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own medical profile" ON medical_profiles;
CREATE POLICY "Users can update own medical profile"
  ON medical_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own medical profile" ON medical_profiles;
CREATE POLICY "Users can delete own medical profile"
  ON medical_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- visit_history RLS
ALTER TABLE visit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own visit history" ON visit_history;
CREATE POLICY "Users can view own visit history"
  ON visit_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own visit history" ON visit_history;
CREATE POLICY "Users can insert own visit history"
  ON visit_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own visit history" ON visit_history;
CREATE POLICY "Users can update own visit history"
  ON visit_history FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own visit history" ON visit_history;
CREATE POLICY "Users can delete own visit history"
  ON visit_history FOR DELETE
  USING (auth.uid() = user_id);
