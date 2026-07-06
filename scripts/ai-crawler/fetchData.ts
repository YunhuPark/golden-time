import axios from 'axios';

/**
 * 네이버 뉴스 검색 API를 활용하여 병원 관련 최근 기사/블로그를 수집합니다.
 * @param hospitalName 병원 이름
 * @returns 분석에 사용할 합쳐진 텍스트 문자열
 */
export async function fetchHospitalNewsAndReviews(hospitalName: string): Promise<string> {
  const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
  const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.warn(`⚠️ 네이버 API 키가 없습니다. 임시 더미 텍스트를 반환합니다. (${hospitalName})`);
    return `[Dummy News] ${hospitalName}은(는) 심혈관 질환과 뇌종양 수술에 탁월한 성과를 보이고 있으며, 최근 권역외상센터로 지정되었습니다.`;
  }

  try {
    // 1. 네이버 뉴스 검색 API 호출
    const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
      params: {
        query: `${hospitalName} 전문센터 OR 수술 OR 치료 OR 권역외상`,
        display: 10,
        sort: 'sim'
      },
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      }
    });

    const items = response.data.items || [];
    
    // HTML 태그 제거 및 텍스트 결합
    const textData = items.map((item: any) => {
      const title = item.title.replace(/<[^>]+>/g, '');
      const description = item.description.replace(/<[^>]+>/g, '');
      return `${title}\n${description}`;
    }).join('\n\n');

    return textData;
  } catch (error) {
    console.error('❌ Naver API 호출 에러:', error);
    return '';
  }
}
