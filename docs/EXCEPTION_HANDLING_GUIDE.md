# 예외 케이스 및 에러 처리 가이드 (Exception Handling Guide)

> **목적**: Golden Time 앱의 모든 예외 상황을 UX 관점에서 식별하고, 사용자 친화적인 처리 방안을 문서화합니다.

## 🎯 핵심 원칙 (Core Principles)

1. **긴급 상황 우선**: 응급실 앱 특성상 어떤 상황에서도 119 전화는 가능해야 함
2. **명확한 피드백**: 에러 발생 시 "무엇이 문제인지", "어떻게 해결하는지" 명확히 안내
3. **Graceful Degradation**: 일부 기능 실패 시에도 핵심 기능(병원 검색, 전화)은 유지
4. **자동 복구 시도**: 사용자 액션 없이도 가능한 복구 메커니즘 작동

---

## ✅ 구현 완료된 예외 케이스

### 1. 위치 정보 권한 거부 (`PERMISSION_DENIED`)
- **상황**: 사용자가 브라우저 위치 권한을 거부함
- **대응**:
  - 기본 위치(창원시청) 사용
  - LocationPermissionPrompt 컴포넌트로 권한 허용 방법 안내
  - 재시도 버튼 제공
- **구현 파일**:
  - `src/presentation/hooks/useGeolocation.ts:122`
  - `src/presentation/components/common/LocationPermissionPrompt.tsx`

### 2. 위치 확인 타임아웃 (`TIMEOUT`)
- **상황**: GPS 신호 수신 지연 (30초 초과)
- **대응**:
  - 10초 후 자동으로 fallback 위치 사용
  - localStorage의 마지막 알려진 위치 우선 사용
  - Wi-Fi 활성화 등 해결 방법 안내
- **구현 파일**: `src/presentation/hooks/useGeolocation.ts:157`

### 3. 위치 정확도 낮음 (`STALE_DATA`)
- **상황**: 위치 정확도가 100m 이상
- **대응**:
  - 경고 메시지 표시 (정확도 ±XXXm)
  - Wi-Fi 활성화 권장
  - 병원 검색은 계속 진행
- **구현 파일**: `src/presentation/hooks/useGeolocation.ts:86`

### 4. API 서버 장애/타임아웃 (`NETWORK_ERROR`)
- **상황**: 공공데이터 API 서버 다운 또는 응답 없음
- **대응**:
  - 로컬 스토리지 캐시 데이터 사용 (최대 30분)
  - 캐시 데이터의 "신선도" (fresh/stale) 표시
  - 데이터 오래됨 경고 표시
- **구현 파일**:
  - `src/infrastructure/cache/HospitalCache.ts`
  - `src/presentation/pages/HomePage.tsx:176`

### 5. 검색 결과 0건
- **상황**:
  - a) 필터 조건이 너무 엄격
  - b) 실제로 주변에 병원이 없음
- **대응**:
  - EmptyHospitalList 컴포넌트 표시
  - 필터 있을 경우: "필터 초기화" 버튼
  - 필터 없을 경우: "반경 확대" 제안 (TODO)
  - 119 긴급 전화 안내
- **구현 파일**: `src/presentation/components/hospital/EmptyHospitalList.tsx`

### 6. 브라우저 Geolocation API 미지원 (`NOT_SUPPORTED`)
- **상황**: 구형 브라우저 사용
- **대응**:
  - 기본 위치 사용
  - 최신 브라우저 업그레이드 권장
  - 수동 위치 입력 유도 (TODO)
- **구현 파일**: `src/presentation/hooks/useGeolocation.ts:51`

---

## 🚧 추가 구현 필요한 예외 케이스

### 7. 네트워크 완전 끊김 (Offline Mode)
- **상황**: 인터넷 연결이 완전히 끊어짐
- **현재 문제**: API 호출 실패 시 일반 에러로 처리됨
- **개선 방안**:
  ```typescript
  // Network status 감지
  window.addEventListener('offline', () => {
    // 즉시 캐시 모드 전환
    setNetworkStatus('offline');
    showOfflineNotification();
  });

  // Online 복구 시 자동 새로고침
  window.addEventListener('online', () => {
    setNetworkStatus('online');
    autoRefreshHospitals();
  });
  ```
- **우선순위**: ⭐⭐⭐ (높음)

### 8. 데이터 파싱 실패 (Malformed API Response)
- **상황**: API 응답이 예상과 다른 형식으로 반환됨
- **현재 문제**: HospitalMapper에서 null 반환 → 병원 수 감소
- **개선 방안**:
  ```typescript
  // HospitalMapper.ts
  static toDomain(dto: CombinedHospitalDTO): Hospital | null {
    try {
      // ... 매핑 로직
    } catch (error) {
      // 파싱 실패한 병원 정보를 별도 로그에 기록
      errorLogger.logParsingFailure(dto, error);
      // Sentry 등에 전송
      return null;
    }
  }
  ```
- **우선순위**: ⭐⭐ (중간)

### 9. Kakao 지도 API 로딩 실패
- **상황**: Kakao Maps SDK 스크립트 로딩 실패
- **현재 문제**: 지도가 표시되지 않고 빈 화면
- **개선 방안**:
  ```typescript
  // KakaoMap.tsx
  useEffect(() => {
    if (!window.kakao || !window.kakao.maps) {
      setMapError('지도를 불러올 수 없습니다. 페이지를 새로고침해주세요.');
      // 리스트 뷰로 강제 전환
      setShowMapView(false);
    }
  }, []);
  ```
- **우선순위**: ⭐⭐ (중간)

### 10. Kakao 길찾기 API 타임아웃
- **상황**: 경로 정보 조회 시 일부 병원만 응답 받음
- **현재 구현**: 타임아웃된 병원은 경로 정보 없이 표시
- **개선 방안**:
  ```typescript
  // 직선 거리 기반 예상 시간 계산 fallback
  const estimatedDuration = (distance / 1000) * 3 * 60; // 시속 20km 가정
  hospital.withRouteInfo(estimatedDuration, distance);
  ```
- **우선순위**: ⭐ (낮음) - 이미 부분 처리됨

### 11. 로그인 세션 만료 (Authentication Expiry) ✅ **구현 완료**
- **상황**: Supabase 세션이 만료되었는데 즐겨찾기 기능 사용 시도
- **대응**:
  - useAuthSession Hook으로 JWT 만료 자동 감지
  - SessionExpiredModal로 사용자 친화적 재로그인 UI 제공
  - 의도된 작업(즐겨찾기, 리뷰 등) 보존 후 재로그인 시 자동 복귀
  - Sentry 에러 로깅으로 세션 만료 추적
- **구현 파일**:
  - `src/presentation/hooks/useAuthSession.ts`
  - `src/presentation/components/common/SessionExpiredModal.tsx`
  - `src/presentation/components/hospital/HospitalCard.tsx` (즐겨찾기 토글)
  - `src/presentation/components/profile/FavoritesList.tsx` (즐겨찾기 목록)
- **우선순위**: ⭐⭐ (중간)

### 12. 병원 전화번호 없음/잘못됨
- **상황**: API에서 전화번호가 누락되거나 잘못된 형식
- **현재 구현**: "전화번호 없음" 표시
- **개선 방안**:
  ```typescript
  // 전화 버튼 클릭 시
  const handleCall = () => {
    if (!phoneNumber || phoneNumber === '전화번호 없음') {
      alert('전화번호 정보가 없습니다. 병원 주소로 직접 방문하거나 119에 문의하세요.');
      return;
    }
    window.location.href = `tel:${phoneNumber}`;
  };
  ```
- **우선순위**: ⭐ (낮음) - 이미 부분 처리됨

### 13. LocalStorage Quota 초과
- **상황**: 캐시 데이터 저장 시 localStorage 용량 초과
- **현재 구현**: 에러 발생 시 기존 캐시 삭제
- **개선 방안** (추가 개선):
  ```typescript
  // LRU 방식으로 오래된 캐시부터 삭제
  static evictOldCache() {
    const caches = JSON.parse(localStorage.getItem('cache-index') || '[]');
    caches.sort((a, b) => a.timestamp - b.timestamp); // 오래된 순
    caches.slice(0, -3).forEach(cache => {
      localStorage.removeItem(cache.key);
    });
  }
  ```
- **우선순위**: ⭐ (낮음)

### 14. 동시에 여러 병원 전화 시도 (Race Condition)
- **상황**: 사용자가 빠르게 여러 병원 전화 버튼 클릭
- **현재 문제**: 마지막 클릭만 작동
- **개선 방안**:
  ```typescript
  // 전화 버튼 debounce 처리
  const handleCall = useMemo(
    () => debounce(() => {
      window.location.href = `tel:${phoneNumber}`;
    }, 500),
    [phoneNumber]
  );
  ```
- **우선순위**: ⭐ (낮음)

### 15. 지도 마커 너무 많음 (Performance)
- **상황**: 검색 결과 100개 이상 → 지도 렌더링 느림
- **현재 구현**: 모든 병원 마커 표시
- **개선 방안**:
  ```typescript
  // 지도 뷰포트에 보이는 병원만 마커 생성 (Clustering)
  const visibleHospitals = hospitals.filter(h =>
    isInViewport(h.coordinates, mapBounds)
  ).slice(0, 50); // 최대 50개
  ```
- **우선순위**: ⭐⭐ (중간)

---

## 📊 예외 케이스 우선순위 매트릭스

| 케이스 | 발생 빈도 | 영향도 | 구현 난이도 | 우선순위 |
|--------|----------|--------|------------|----------|
| 네트워크 완전 끊김 | 중간 | 치명적 | 낮음 | ⭐⭐⭐ |
| Kakao 지도 로딩 실패 | 낮음 | 높음 | 낮음 | ⭐⭐ |
| 로그인 세션 만료 | 중간 | 중간 | 낮음 | ⭐⭐ |
| 데이터 파싱 실패 | 낮음 | 중간 | 중간 | ⭐⭐ |
| 지도 마커 성능 문제 | 낮음 | 중간 | 중간 | ⭐⭐ |
| 기타 | 매우 낮음 | 낮음 | 다양 | ⭐ |

---

## 🔄 에러 처리 플로우차트

```
사용자 액션
    ↓
[Try] 정상 동작 시도
    ↓
  실패?
    ↓
[Catch] 1차 Fallback
    - 캐시 데이터 사용
    - 기본값 적용
    - 이전 상태 유지
    ↓
  여전히 실패?
    ↓
[Notify] 사용자 안내
    - 명확한 에러 메시지
    - 해결 방법 제시
    - 재시도 옵션
    ↓
[Log] 에러 기록
    - Console.error()
    - (선택) Sentry 전송
```

---

## 🎨 UX 가이드라인

### 에러 메시지 톤 & 매너
- ❌ 나쁜 예: "오류가 발생했습니다 (ERR_NETWORK_FAILURE)"
- ✅ 좋은 예: "서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요."

### 에러 심각도별 표현
- **치명적 (Critical)**: 빨간색 배경, 119 안내
- **경고 (Warning)**: 노란색 배경, 해결 방법 제시
- **정보 (Info)**: 파란색 배경, 참고 사항

### 액션 버튼 우선순위
1. **Primary**: 문제 해결 액션 (재시도, 권한 허용)
2. **Secondary**: 대안 제시 (필터 초기화, 119 전화)
3. **Tertiary**: 도움말 보기

---

## 🧪 테스트 시나리오

### 수동 테스트 체크리스트
- [ ] 비행기 모드 켜고 앱 실행 → 캐시 데이터 표시 확인
- [ ] 위치 권한 거부 → LocationPermissionPrompt 표시 확인
- [ ] Wi-Fi 끄고 GPS만 사용 → 타임아웃 fallback 확인
- [ ] 필터 전체 활성화 → EmptyHospitalList 표시 확인
- [ ] DevTools에서 API throttle 3G → 캐시 사용 확인
- [ ] localStorage 수동 삭제 후 새로고침 → 정상 작동 확인

---

## 📝 개발자 노트

### Ironclad Law #3 준수 사항
이 문서는 "Edge Case Obsession" 원칙에 따라 작성되었습니다. 모든 예외 케이스는:
1. **식별되어야 함**: 발생 가능한 모든 시나리오 나열
2. **문서화되어야 함**: 처리 방법과 우선순위 명시
3. **테스트되어야 함**: 수동/자동 테스트 시나리오 포함
4. **모니터링되어야 함**: 실운영 환경에서 발생 빈도 추적

### 다음 스프린트 액션 아이템
1. ⭐⭐⭐ 우선순위 케이스 구현 (네트워크 끊김 감지)
2. Sentry 등 에러 모니터링 도구 통합
3. E2E 테스트로 예외 케이스 자동화
