# 🏥 방문 기록 추적 시스템 가이드

## 📋 개요

실제 병원 방문 여부를 정확하게 추적하기 위한 하이브리드 시스템입니다.

---

## 🎯 문제점 및 해결

### ❌ **이전 문제점**:
```
전화 버튼 클릭 → 10초 후 자동 팝업 "방문하셨나요?"
```
- 전화만 걸었는데 방문했다고 가정
- 실제 방문까지 몇 분~몇십 분 소요 (10초는 너무 짧음)
- 부정확한 기록 가능

### ✅ **개선된 솔루션**:

**3가지 방법으로 방문 기록 생성**:

1. **Geofencing (위치 기반 자동 감지)** ⭐ 가장 정확
2. **길찾기 복귀 감지** (카카오맵/카카오내비 → 앱 복귀)
3. **수동 추가** (프로필 페이지에서 직접 입력)

---

## 🛠️ 구현 내용

### 1. **GeofencingService (새로 추가)**

**파일**: `src/domain/services/GeofencingService.ts`

**기능**:
- 병원 좌표를 중심으로 반경 100미터 감시
- 사용자가 영역 진입 시 자동으로 팝업 표시
- 배터리 절약을 위한 최적화 (낮은 정확도 모드)
- Singleton 패턴으로 전역 관리

**사용 예시**:
```typescript
const geofencing = GeofencingService.getInstance();

geofencing.addGeofence(
  hospital.id,
  hospital.name,
  hospital.coordinates,
  {
    onEnter: (hospitalId, hospitalName) => {
      alert(`${hospitalName}에 도착하셨습니다!`);
    }
  },
  100 // 반경 100미터
);
```

**장점**:
- ✅ 실제 위치 기반으로 정확한 방문 확인
- ✅ 자동화 (사용자가 따로 버튼 누를 필요 없음)
- ✅ 일회성 (도착 시 한 번만 팝업)

**단점**:
- ⚠️ 위치 권한 필요 (사용자가 거부할 수 있음)
- ⚠️ 배터리 소모 (최적화되어 있지만)

---

### 2. **길찾기 후 복귀 감지**

**파일**: `src/presentation/components/hospital/HospitalCard.tsx` (190-269번 라인)

**작동 방식**:
1. 사용자가 "길찾기" 버튼 클릭
2. 카카오맵/카카오내비 앱 실행
3. `visibilitychange` 이벤트로 앱 복귀 감지
4. 5초 후 "방문 완료하셨나요?" 팝업

**코드**:
```typescript
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    setTimeout(() => {
      const shouldRecord = window.confirm(
        "방문을 완료하셨나요?"
      );
      if (shouldRecord) recordVisit();
    }, 5000);

    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }
};

document.addEventListener('visibilitychange', handleVisibilityChange);
```

**장점**:
- ✅ 구현 간단
- ✅ 위치 권한 불필요

**단점**:
- ⚠️ 정확도 낮음 (앱만 복귀해도 팝업)
- ⚠️ 사용자가 실제 방문하지 않고 앱만 닫았을 수도 있음

---

### 3. **수동 추가 (기존 유지)**

**파일**: `src/presentation/components/profile/VisitHistoryList.tsx`

**작동 방식**:
- 프로필 페이지 → 방문 기록 탭 → "+ 수동 추가" 버튼
- 병원 이름, 주소, 날짜, 시간, 사유, 메모 입력 가능

**장점**:
- ✅ 100% 정확 (사용자가 직접 입력)
- ✅ 과거 방문 기록도 추가 가능

**단점**:
- ⚠️ 사용자가 직접 해야 함 (번거로움)
- ⚠️ 잊어버릴 수 있음

---

## 📊 사용 시나리오

### **시나리오 1: 완벽한 케이스 (Geofencing)**

```
1. 사용자가 "길찾기" 버튼 클릭
2. 카카오내비로 병원까지 이동
3. 병원 근처 100m 이내 진입
4. 자동 팝업: "📍 OO병원에 도착하셨습니다! 방문 기록을 남기시겠습니까?"
5. 사용자가 "확인" 클릭
6. 방문 기록 자동 생성 ✅
```

**결과**: Geofencing이 자동으로 정확한 위치 감지

---

### **시나리오 2: 위치 권한 거부 (복귀 감지)**

```
1. 사용자가 위치 권한 거부
2. Geofencing 작동 안 함
3. 사용자가 "길찾기" 버튼 클릭
4. 카카오내비로 이동 후 앱으로 복귀
5. 5초 후 팝업: "OO병원 방문을 완료하셨나요?"
6. 사용자가 "확인" 클릭
7. 방문 기록 생성 ✅
```

**결과**: 복귀 감지가 Fallback으로 작동

---

### **시나리오 3: 나중에 기록 (수동 추가)**

```
1. 사용자가 병원 방문 후 앱 안 열음
2. 다음 날 프로필 페이지 접속
3. "방문 기록" 탭 → "+ 수동 추가" 클릭
4. 어제 방문한 병원 정보 입력
5. 저장 ✅
```

**결과**: 과거 방문 기록도 추가 가능

---

## 🔐 보안 및 프라이버시

### **위치 권한 처리**:
- 사용자가 명시적으로 "길찾기" 버튼을 눌러야 Geofencing 시작
- 자동으로 위치 추적 시작하지 않음
- 병원 도착 후 Geofence 자동 제거 (일회성)

### **데이터 저장**:
- 방문 기록은 Supabase에 암호화 저장
- RLS 정책으로 본인 데이터만 접근 가능

---

## ⚡ 성능 최적화

### **배터리 절약**:
```typescript
{
  enableHighAccuracy: false, // 낮은 정확도 사용
  maximumAge: 30000,         // 30초 캐시
  timeout: 27000             // 27초 타임아웃
}
```

### **메모리 관리**:
- Singleton 패턴으로 GeofencingService 인스턴스 1개만 생성
- 방문 완료 후 Geofence 자동 제거
- 이벤트 리스너 일회성 설정 (`{ once: true }`)

---

## 🧪 테스트 방법

### **Geofencing 테스트**:

1. 모바일 디바이스에서 앱 실행
2. 위치 권한 허용
3. "길찾기" 버튼 클릭
4. 실제로 병원 근처 100m 이내로 이동
5. 팝업이 자동으로 뜨는지 확인

### **복귀 감지 테스트**:

1. "길찾기" 버튼 클릭
2. 카카오맵/카카오내비 실행
3. 앱으로 다시 복귀
4. 5초 후 팝업이 뜨는지 확인

### **수동 추가 테스트**:

1. 프로필 페이지 → 방문 기록 탭
2. "+ 수동 추가" 버튼 클릭
3. 정보 입력 후 저장
4. 목록에 표시되는지 확인

---

## 📝 코드 변경 사항 요약

### **추가된 파일**:
- `src/domain/services/GeofencingService.ts` (새로 생성)
- `VISIT_TRACKING_GUIDE.md` (이 문서)

### **수정된 파일**:
- `src/presentation/components/hospital/HospitalCard.tsx`
  - Line 7: GeofencingService import 추가
  - Line 134-143: 전화 버튼 자동 팝업 제거
  - Line 190-269: 길찾기 버튼에 Geofencing + 복귀 감지 추가

### **유지된 기능**:
- `src/presentation/components/profile/VisitHistoryList.tsx` (수동 추가 기능)

---

## ✅ 완료!

이제 방문 기록은 3가지 방법으로 생성할 수 있습니다:
1. 📍 **Geofencing** (자동, 가장 정확)
2. 🔄 **복귀 감지** (자동, Fallback)
3. ✍️ **수동 추가** (사용자 직접 입력)

모든 방법이 함께 작동하여 최상의 사용자 경험을 제공합니다! 🎉
