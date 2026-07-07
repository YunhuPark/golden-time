import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fetchHospitalNewsAndReviews } from './fetchData';
import { analyzeSpecialties } from './analyzeWithLLM';
import { updateHospitalSpecialties } from './updateSupabase';
import axios from 'axios';

// Load environment variables (.env.local or .env)
dotenv.config();
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase URL or Key');
  process.exit(1);
}

// Service role key is recommended for bypassing RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * AI 병원 특화 분야 크롤러 메인 파이프라인
 */
async function runCrawler() {
  console.log('🚀 Starting AI Hospital Crawler...');

  // 1. E-Gen API에서 전국 병원 목록 가져오기
  const HARDCODED_KEY = '24e573c3571a5e29f58333bd1b0ae2d7af7a69b89cacbbdc578e56961b469b4c';
  // 기본정보 API(getHsptlBassInfoInqire)가 404를 반환하므로, 정상 작동하는 병상 정보 API를 사용하여 병원 목록 추출
  const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${HARDCODED_KEY}&pageNo=1&numOfRows=400&_type=json`;
  
  let targetHospitals: { hpid: string; name: string }[] = [];
  
  try {
    console.log('📡 E-Gen API에서 전국 병원 목록을 가져옵니다...');
    const response = await axios.get(url);
    const items = response.data?.response?.body?.items?.item || [];
    
    // 배열이 아닌 경우 배열로 감싸기
    const hospitalItems = Array.isArray(items) ? items : [items];
    
    targetHospitals = hospitalItems
      .filter((item: any) => item && item.hpid && item.dutyName)
      .map((item: any) => ({
        hpid: item.hpid,
        name: item.dutyName,
      }));
      
    console.log(`✅ 총 ${targetHospitals.length}개의 병원 목록을 가져왔습니다.`);
  } catch (error) {
    console.error('❌ E-Gen API 병원 목록 조회 실패:', error);
    process.exit(1);
  }

  // 테스트를 위해 제한을 둘 수 있습니다. (비용/시간 절약)
  const TEST_LIMIT = process.env.CRAWLER_TEST_LIMIT ? parseInt(process.env.CRAWLER_TEST_LIMIT) : 5;
  if (TEST_LIMIT > 0 && targetHospitals.length > TEST_LIMIT) {
    console.log(`⚠️ 테스트 모드: ${TEST_LIMIT}개의 병원만 처리합니다. (제한 해제는 .env에서 CRAWLER_TEST_LIMIT=0 설정)`);
    targetHospitals = targetHospitals.slice(0, TEST_LIMIT);
  }
  
  // DB에서 이미 크롤링된 병원 목록 가져오기 (30일 주기 갱신 로직 적용)
  console.log('📡 Supabase에서 기존 병원 목록 및 갱신일을 확인합니다...');
  const { data: existingData } = await supabase.from('hospital_specialties').select('hpid, last_updated_at');
  
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = new Date().getTime();
  
  const freshHpids = new Set(
    existingData
      ?.filter(row => {
        if (!row.last_updated_at) return false;
        const lastUpdated = new Date(row.last_updated_at).getTime();
        return now - lastUpdated < THIRTY_DAYS_MS;
      })
      .map(row => row.hpid) || []
  );
  
  targetHospitals = targetHospitals.filter(h => !freshHpids.has(h.hpid));
  console.log(`✅ 최근 30일 이내에 갱신된 병원을 제외하고, 총 ${targetHospitals.length}개의 병원만 새로 크롤링합니다.`);

  // Rate Limit 방지를 위한 Delay 함수
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  for (const hospital of targetHospitals) {
    console.log(`\n========================================`);
    console.log(`🏥 대상 병원: ${hospital.name} (${hospital.hpid})`);
    
    try {
      // 2. 외부 데이터 수집 (뉴스, 블로그, 리뷰 등)
      console.log('🔍 뉴스/리뷰 데이터 수집 중...');
      const textData = await fetchHospitalNewsAndReviews(hospital.name);

      if (!textData) {
        console.warn(`⚠️ 수집된 데이터가 없습니다. 추론 엔진을 통과합니다.`);
        continue;
      }

      // 3. LLM 분석
      console.log('🤖 AI(LLM) 특화 분야 분석 중...');
      const analysisResult = await analyzeSpecialties(hospital.name, textData);

      if (analysisResult.specialties.length === 0) {
        console.log('⚠️ 추출된 전문 분야가 없습니다.');
        continue;
      }

      console.log(`✨ 추출된 전문 분야: ${analysisResult.specialties.join(', ')} (신뢰도: ${analysisResult.confidenceScore})`);

      // 4. Supabase DB 업데이트
      console.log('💾 Supabase 업데이트 중...');
      await updateHospitalSpecialties(supabase, {
        hpid: hospital.hpid,
        hospital_name: hospital.name,
        specialties: analysisResult.specialties,
        confidence_score: analysisResult.confidenceScore,
        inferred_from: 'ai_crawler'
      });

      console.log('✅ 업데이트 완료!');
      
      // 크롤링 딜레이 (Rate Limit 방지)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ [${hospital.name}] 처리 중 에러 발생:`, error);
    }
    
    // API Rate Limit (429) 방지를 위한 대기
    await delay(2000);
  }

  console.log('\n🎉 모든 크롤링 작업이 완료되었습니다!');
}

// 스크립트 실행
runCrawler().catch(console.error);
