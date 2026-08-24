import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fetchHospitalNewsAndReviews } from './fetchData';
import { analyzeSpecialties } from './analyzeWithLLM';
import { updateHospitalSpecialties } from './updateSupabase';
import axios from 'axios';
import { withRetry, TIMEOUTS } from './utils';

// Load environment variables (.env.local or .env)
dotenv.config();
dotenv.config({ path: '.env.local' });

export async function runCrawler(): Promise<{ targetCount: number; successCount: number; failureCount: number }> {
  console.log('🚀 Starting AI Hospital Crawler...');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const EGEN_SERVICE_KEY = process.env.EGEN_SERVICE_KEY?.trim() || '';

  // 환경변수 안전 검증 (비밀값 노출 금지)
  if (!SUPABASE_URL) throw new Error('Missing VITE_SUPABASE_URL');
  if (process.env.NODE_ENV !== 'test') {
    if (!SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.startsWith('http://localhost')) {
      throw new Error('VITE_SUPABASE_URL must start with https://');
    }
    if (!SUPABASE_URL.endsWith('.supabase.co') && !SUPABASE_URL.includes('.supabase.') && !SUPABASE_URL.startsWith('http://localhost')) {
      throw new Error('VITE_SUPABASE_URL must be a valid Supabase domain');
    }
  }
  if (!SUPABASE_SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  if (!EGEN_SERVICE_KEY) throw new Error('Missing EGEN_SERVICE_KEY');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 사전 검증 (Pre-flight Check)
  console.log('📡 Supabase 사전 연결 검증 중...');
  try {
    await withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.SUPABASE);
      try {
        const { error } = await supabase.from('hospital_specialties').select('hpid').limit(1).abortSignal(controller.signal);
        if (error) throw error;
      } catch (e: any) {
        if (e.name === 'AbortError') throw new Error('Pre-flight Supabase request timed out');
        throw e;
      } finally {
        clearTimeout(timeoutId);
      }
    });
    console.log('✅ Supabase 사전 검증 성공');
  } catch (error: any) {
    console.error('❌ Supabase 사전 검증 실패. 작업을 중단합니다.');
    throw new Error('Preflight failed');
  }

  // 1. E-Gen API에서 전국 병원 목록 가져오기
  const baseUrl = process.env.EGEN_BASE_URL || 'http://apis.data.go.kr/B552657/ErmctInfoInqireService';
  const url = `${baseUrl}/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${encodeURIComponent(EGEN_SERVICE_KEY)}&pageNo=1&numOfRows=400&_type=json`;
  
  let targetHospitals: { hpid: string; name: string }[] = [];
  
  try {
    console.log('📡 E-Gen API에서 전국 병원 목록을 가져옵니다...');
    const response = await withRetry(async () => {
      return await axios.get(url, { timeout: TIMEOUTS.EGEN });
    });
    const items = response.data?.response?.body?.items?.item || [];
    const hospitalItems = Array.isArray(items) ? items : [items];
    
    targetHospitals = hospitalItems
      .filter((item: any) => item && item.hpid && item.dutyName)
      .map((item: any) => ({
        hpid: item.hpid,
        name: item.dutyName,
      }));
      
    console.log(`✅ 총 ${targetHospitals.length}개의 병원 목록을 가져왔습니다.`);
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.error(`❌ E-Gen API 인증 실패 (상태 코드: ${error.response.status}).`);
    } else {
      console.error('❌ E-Gen API 병원 목록 조회 실패:', error.message || 'Unknown error');
    }
    throw new Error('E-Gen API Fetch Failed');
  }

  const TEST_LIMIT = process.env.CRAWLER_TEST_LIMIT ? parseInt(process.env.CRAWLER_TEST_LIMIT) : 5;
  if (TEST_LIMIT > 0 && targetHospitals.length > TEST_LIMIT) {
    targetHospitals = targetHospitals.slice(0, TEST_LIMIT);
  }
  
  const { data: existingData } = await supabase.from('hospital_specialties').select('hpid, last_updated_at');
  
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = new Date().getTime();
  
  const freshHpids = new Set(
    existingData
      ?.filter(row => {
        if (!row.last_updated_at) return false;
        return now - new Date(row.last_updated_at).getTime() < THIRTY_DAYS_MS;
      })
      .map(row => row.hpid) || []
  );
  
  targetHospitals = targetHospitals.filter(h => !freshHpids.has(h.hpid));
  console.log(`✅ 최근 30일 이내에 갱신된 병원을 제외하고, 총 ${targetHospitals.length}개의 병원만 새로 크롤링합니다.`);

  let successCount = 0;
  let failureCount = 0;
  const targetCount = targetHospitals.length;

  for (const hospital of targetHospitals) {
    console.log(`\n========================================`);
    console.log(`🏥 대상 병원: ${hospital.name} (${hospital.hpid})`);
    
    try {
      const textData = await fetchHospitalNewsAndReviews(hospital.name);

      if (!textData) {
        console.warn(`⚠️ 수집된 데이터가 없습니다. DB에 빈 값으로 기록하여 30일간 재검색을 방지합니다(Negative Cache).`);
        await updateHospitalSpecialties(supabase, {
          hpid: hospital.hpid,
          hospital_name: hospital.name,
          specialties: [],
          confidence_score: 0,
          inferred_from: 'no_data'
        });
        successCount++;
        continue;
      }

      const analysisResult = await analyzeSpecialties(hospital.name, textData);

      if (analysisResult.specialties.length === 0) {
        console.log('⚠️ 추출된 전문 분야가 없습니다. DB에 빈 값으로 기록하여 30일간 재검색을 방지합니다.');
        await updateHospitalSpecialties(supabase, {
          hpid: hospital.hpid,
          hospital_name: hospital.name,
          specialties: [],
          confidence_score: 0,
          inferred_from: 'ai_empty'
        });
        successCount++;
        continue;
      }

      console.log(`✨ 추출된 전문 분야: ${analysisResult.specialties.join(', ')} (신뢰도: ${analysisResult.confidenceScore})`);

      await updateHospitalSpecialties(supabase, {
        hpid: hospital.hpid,
        hospital_name: hospital.name,
        specialties: analysisResult.specialties,
        confidence_score: analysisResult.confidenceScore,
        inferred_from: 'ai_crawler'
      });

      console.log('✅ 업데이트 완료!');
      successCount++;
    } catch (error: any) {
      // url, key 같은 민감 정보가 포함될 수 있으므로 에러 상세 메시지는 제외하고 최소한으로 로깅
      console.error(`❌ [${hospital.hpid}] 처리 중 에러 발생 (upsert 실패).`);
      failureCount++;
    }
    
    // API Rate Limit (429) 방지를 위한 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n🎉 크롤링 작업 요약');
  console.log(`- Preflight: OK`);
  console.log(`- Target: ${targetCount}`);
  console.log(`- Success: ${successCount}`);
  console.log(`- Failure: ${failureCount}`);
  const successRate = targetCount > 0 ? ((successCount / targetCount) * 100).toFixed(1) : '0.0';
  console.log(`- Success Rate: ${successRate}%`);

  return { targetCount, successCount, failureCount };
}

if (process.env.NODE_ENV !== 'test') {
  runCrawler()
    .then((result) => {
      if (result.failureCount > 0) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      // 상위 레벨에서 치명적 에러 발생 시
      console.error('❌ 크롤러 실행 중 치명적 오류 발생:', error.message || error);
      process.exitCode = 1;
    });
}
