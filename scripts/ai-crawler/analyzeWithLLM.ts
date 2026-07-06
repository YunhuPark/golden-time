import axios from 'axios';

export interface AnalysisResult {
  specialties: string[];
  confidenceScore: number;
}

/**
 * 수집된 텍스트를 바탕으로 병원의 핵심 특화 질환(분야)을 추출합니다.
 */
export async function analyzeSpecialties(hospitalName: string, textData: string): Promise<AnalysisResult> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    console.warn(`⚠️ OpenAI API 키가 없습니다. 휴리스틱 더미 분석을 수행합니다.`);
    
    // 더미 분석 로직 (텍스트 기반 단순 키워드 매칭)
    const mockSpecialties = [];
    if (textData.includes('심혈관')) mockSpecialties.push('심혈관');
    if (textData.includes('뇌종양') || textData.includes('뇌졸중')) mockSpecialties.push('뇌질환');
    if (textData.includes('권역외상')) mockSpecialties.push('중증외상');
    
    return {
      specialties: mockSpecialties.length > 0 ? mockSpecialties : ['일반응급'],
      confidenceScore: 70
    };
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `당신은 의료 데이터 분석 AI입니다. 주어진 텍스트는 특정 병원에 대한 뉴스 기사, 리뷰, 소개글의 모음입니다.
이 텍스트를 분석하여 해당 병원이 전문적으로 다루는 핵심 '특화 질환(분야)'을 정확히 추출하세요.
(예: 패혈증, 뇌종양, 화상, 중환자의학, 심혈관, 장기이식, 소아응급, 중증외상 등)

응답은 반드시 아래 JSON 형식으로만 반환해야 합니다. 다른 말은 추가하지 마세요.
{
  "specialties": ["분야1", "분야2"],
  "confidenceScore": 90
}
confidenceScore는 0부터 100 사이의 신뢰도 점수입니다.`
          },
          {
            role: 'user',
            content: `대상 병원: ${hospitalName}\n\n텍스트 데이터:\n${textData}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const resultString = response.data.choices[0].message.content;
    const result = JSON.parse(resultString);

    return {
      specialties: result.specialties || [],
      confidenceScore: result.confidenceScore || 50
    };
  } catch (error) {
    console.error('❌ LLM 분석 에러:', error);
    return { specialties: [], confidenceScore: 0 };
  }
}
