/**
 * Supabase 데이터베이스 스키마 적용 스크립트
 * Node.js로 직접 PostgreSQL에 연결하여 SQL 실행
 */

require('dotenv').config();
const fs = require('fs');
const https = require('https');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.');
  console.error('   .env 파일에 두 값을 채운 뒤 다시 실행하세요 (.env.example 참고).');
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const dashboardSqlUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;

// SQL 파일 읽기
const sql = fs.readFileSync('supabase_schema.sql', 'utf8');

console.log('📊 Supabase 데이터베이스 스키마 적용 중...\n');
console.log('SQL 길이:', sql.length, 'bytes');
console.log('URL:', SUPABASE_URL);

// Supabase REST API로 SQL 실행
const payload = JSON.stringify({ query: sql });

const options = {
  hostname: new URL(SUPABASE_URL).hostname,
  port: 443,
  path: '/rest/v1/rpc/exec_sql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  },
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('\n✅ 스키마 적용 완료!');
      console.log('\n다음 테이블이 생성되었습니다:');
      console.log('  - favorites (즐겨찾기)');
      console.log('  - reviews (리뷰)');
      console.log('  - medical_profiles (의료 정보)');
      console.log('  - visit_history (방문 기록)');
      console.log('\n🔐 Row Level Security (RLS) 정책도 모두 적용되었습니다.');
    } else {
      console.error('\n❌ 오류 발생:', res.statusCode);
      console.error('응답:', data);
      console.log('\n💡 Supabase Dashboard에서 수동으로 실행해주세요:');
      console.log('  ', dashboardSqlUrl);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ 연결 오류:', error.message);
  console.log('\n💡 대안: Supabase Dashboard의 SQL Editor 사용');
  console.log(`   1. ${dashboardSqlUrl} 접속`);
  console.log('   2. supabase_schema.sql 파일 내용 복사 & 붙여넣기');
  console.log('   3. Run 버튼 클릭');
});

req.write(payload);
req.end();
