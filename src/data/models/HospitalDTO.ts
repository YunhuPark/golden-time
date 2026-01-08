/**
 * Hospital DTO (Data Transfer Object)
 * 응급의료포털 API 응답 데이터 구조
 */

/**
 * 실시간 응급실 병상 정보 API 응답
 * GET /ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire
 */
export interface EmergencyRoomBedDTO {
  hpid: string;                    // 기관ID
  phpid?: string;                  // 기관코드
  hvidate?: string;                // 입력일시 (YYYY-MM-DD HH:mm:ss)
  hvec?: string;                   // 응급실병상수
  hvoc?: string;                   // 수술실병상수
  hvcc?: string;                   // 신경중환자병상수
  hvncc?: string;                  // 신생중환자병상수
  hvccc?: string;                  // 흉부중환자병상수
  hvicc?: string;                  // 일반중환자병상수
  hvgc?: string;                   // 입원실병상수
  hvctayn?: string;                // CT 가용 여부 (Y/N)
  hvmriayn?: string;               // MRI 가용 여부 (Y/N)
  // 병원 기본 정보 (실제 API 응답에 포함될 수 있음)
  dutyName?: string;               // 기관명
  dutyAddr?: string;               // 주소
  dutyTel1?: string;               // 대표전화
  dutyTel3?: string;               // 응급실전화
  wgs84Lat?: string | number;      // 위도
  wgs84Lon?: string | number;      // 경도
  // 참고: 모든 필드가 문자열로 반환됨 (숫자도 문자열)
}

/**
 * 응급의료기관 기본정보 API 응답
 * GET /HsptlAsembySearchService/getHsptlBassInfoInqire
 */
export interface HospitalBasicInfoDTO {
  hpid: string;                    // 기관ID (필수)
  dutyAddr: string;                // 주소
  dutyName: string;                // 기관명
  dutyTel1?: string;               // 대표전화1
  dutyTel3?: string;               // 응급실전화
  wgs84Lon?: string;               // 경도 (WGS84)
  wgs84Lat?: string;               // 위도 (WGS84)
  dutyEmcls?: string;              // 응급의료기관코드
  dutyEmclsName?: string;          // 응급의료기관코드명
  dutyEryn?: string;               // 응급실운영여부 (1/2)
  dutyTime1c?: string;             // 진료시간(월요일)C
  dutyTime2c?: string;             // 진료시간(화요일)C
  dutyTime3c?: string;             // 진료시간(수요일)C
  dutyTime4c?: string;             // 진료시간(목요일)C
  dutyTime5c?: string;             // 진료시간(금요일)C
  dutyTime6c?: string;             // 진료시간(토요일)C
  dutyTime7c?: string;             // 진료시간(일요일)C
  dutyTime8c?: string;             // 진료시간(공휴일)C
  MKioskTy1?: string;              // 응급의료정보제공동의
  MKioskTy2?: string;              // 응급의료정보제공동의
  MKioskTy3?: string;              // 응급의료정보제공동의
  MKioskTy4?: string;              // 응급의료정보제공동의
  MKioskTy5?: string;              // 응급의료정보제공동의
  MKioskTy6?: string;              // 응급의료정보제공동의
  MKioskTy7?: string;              // 응급의료정보제공동의
  MKioskTy8?: string;              // 응급의료정보제공동의
  MKioskTy9?: string;              // 응급의료정보제공동의
  MKioskTy10?: string;             // 응급의료정보제공동의
  MKioskTy11?: string;             // 응급의료정보제공동의
}

/**
 * 응급의료포털 API 공통 응답 래퍼
 */
export interface EGenApiResponse<T> {
  response: {
    header: {
      resultCode: string;          // "00" = 정상, "99" = 에러
      resultMsg: string;            // 결과 메시지
    };
    body: {
      items?: {
        item: T | T[];             // 단일 결과는 객체, 복수 결과는 배열
      };
      numOfRows?: number;          // 한 페이지 결과 수
      pageNo?: number;              // 페이지 번호
      totalCount?: number;          // 전체 결과 수
    };
  };
}

/**
 * 응급실 실시간 정보 통합 DTO
 * (기본정보 + 병상정보 결합)
 */
export interface CombinedHospitalDTO {
  basicInfo: HospitalBasicInfoDTO;
  bedInfo?: EmergencyRoomBedDTO;
}
