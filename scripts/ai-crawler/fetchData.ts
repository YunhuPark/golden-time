import axios from 'axios';
import { withRetry, TIMEOUTS } from './utils';

export async function fetchHospitalNewsAndReviews(hospitalName: string): Promise<string> {
  const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
  const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.warn(`⚠️ 네이버 API 키가 없습니다. 임시 더미 텍스트를 반환합니다. (${hospitalName})`);
    return `[Dummy News] ${hospitalName}은(는) 심혈관 질환과 뇌종양 수술에 탁월한 성과를 보이고 있으며, 최근 권역외상센터로 지정되었습니다.`;
  }

  const baseUrl = process.env.NAVER_BASE_URL || 'https://openapi.naver.com';

  try {
    return await withRetry(async () => {
      const response = await axios.get(`${baseUrl}/v1/search/news.json`, {
        params: {
          query: `${hospitalName} 전문센터 OR 수술 OR 치료 OR 권역외상`,
          display: 10,
          sort: 'sim'
        },
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
        timeout: TIMEOUTS.NAVER
      });

      const items = response.data.items || [];
      const textData = items.map((item: any) => {
        const title = item.title.replace(/<[^>]+>/g, '');
        const description = item.description.replace(/<[^>]+>/g, '');
        return `${title}\n${description}`;
      }).join('\n\n');

      return textData;
    });
  } catch (error) {
    console.error('❌ Naver API 호출 에러:', error);
    return '';
  }
}
