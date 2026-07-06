-- Migration: Create hospital_specialties table
-- Description: Stores AI-crawled specialty information for hospitals

CREATE TABLE IF NOT EXISTS public.hospital_specialties (
    hpid VARCHAR(50) PRIMARY KEY,
    hospital_name VARCHAR(255) NOT NULL,
    specialties TEXT[] NOT NULL DEFAULT '{}',
    inferred_from VARCHAR(50) NOT NULL DEFAULT 'ai_crawler', -- e.g., 'ai_crawler', 'heuristic', 'manual'
    confidence_score INTEGER, -- 0 to 100
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) 설정
ALTER TABLE public.hospital_specialties ENABLE ROW LEVEL SECURITY;

-- 누구나 읽을 수 있게 허용 (익명/로그인 사용자 모두)
CREATE POLICY "Enable read access for all users" ON public.hospital_specialties
    FOR SELECT USING (true);

-- 크롤러(서버) 권한 업데이트는 Service Role Key를 통해 우회되므로 별도의 INSERT/UPDATE Policy는 불필요함.

-- (선택) 인덱스 추가: 특정 질환 전문 병원을 빠르게 검색하기 위해
CREATE INDEX IF NOT EXISTS idx_hospital_specialties_on_specialties
    ON public.hospital_specialties USING gin (specialties);
