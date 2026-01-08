import { useEffect, useRef, useState } from 'react';
import { Hospital } from '../../../domain/entities/Hospital';
import { Coordinates } from '../../../domain/valueObjects/Coordinates';
import { logError } from '../../../infrastructure/monitoring/sentry';
import { cn } from '../../../lib/utils';
import { useAppStore } from '../../../infrastructure/state/store';

// Kakao Maps 타입 정의는 global로 선언되어 있음

/**
 * KakaoMap Component
 *
 * Kakao Maps JavaScript SDK를 사용한 지도 컴포넌트
 *
 * Features:
 * - 사용자 현재 위치 마커 표시
 * - 병원 위치 마커 표시 (거리순 색상 구분)
 * - 마커 클릭 시 병원 정보 표시 (InfoWindow)
 * - 지도 중심 자동 조정 (모든 마커가 보이도록)
 *
 * Edge Cases:
 * - Kakao SDK 로드 실패
 * - 좌표가 없는 병원
 * - 빈 병원 목록
 */

interface KakaoMapProps {
  userLocation: Coordinates | null;
  hospitals: Hospital[];
  selectedHospitalId?: string | null;
  onHospitalClick?: (hospital: Hospital) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function KakaoMap({
  userLocation,
  hospitals,
  selectedHospitalId,
  onHospitalClick,
  className = '',
  style = {},
}: KakaoMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const initialBoundsSetRef = useRef<boolean>(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { themeMode } = useAppStore();

  // 전역 토글 핸들러 함수 (window 객체에 등록)
  useEffect(() => {
    let currentOpenInfoId: string | null = null;

    (window as any).toggleMarkerInfo = (hospitalId: string) => {
      console.log('🔵 Marker clicked:', hospitalId);

      // 모든 정보창 숨기기
      const allInfos = document.querySelectorAll('.marker-info');
      allInfos.forEach((info) => {
        (info as HTMLElement).style.display = 'none';
      });

      // 클릭한 정보창이 이미 열려있었으면 닫기만 하고 종료
      if (currentOpenInfoId === hospitalId) {
        currentOpenInfoId = null;
        return;
      }

      // 새 정보창 열기
      const infoElement = document.getElementById(`info-${hospitalId}`);
      if (infoElement) {
        infoElement.style.display = 'block';
        currentOpenInfoId = hospitalId;
        console.log('✅ Info window opened:', hospitalId);
      }

      // onHospitalClick 콜백 호출 (Bottom Sheet 열기)
      if (onHospitalClick) {
        const hospital = hospitals.find((h) => h.id === hospitalId);
        if (hospital) {
          console.log('✅ Calling onHospitalClick for hospital:', hospital.name);
          onHospitalClick(hospital);
        }
      }
    };

    return () => {
      delete (window as any).toggleMarkerInfo;
    };
  }, [hospitals, onHospitalClick]);

  /**
   * Kakao Maps SDK 초기화 및 지도 생성
   */
  useEffect(() => {
    const initMap = async () => {
      // Edge Case 1: Kakao SDK가 로드되지 않음
      if (!window.kakao || !window.kakao.maps) {
        const errorMsg = 'Kakao Maps SDK를 불러올 수 없습니다.';
        setError(errorMsg);
        console.error('Kakao Maps SDK not loaded');

        // Sentry에 에러 로깅
        logError(new Error(errorMsg), {
          area: 'ui',
          severity: 'high',
          extra: {
            has_kakao: !!window.kakao,
            has_kakao_maps: !!(window.kakao && window.kakao.maps),
          },
        });
        return;
      }

      // Edge Case 2: 컨테이너 요소 없음
      if (!mapContainerRef.current) {
        setError('지도 컨테이너를 찾을 수 없습니다.');
        return;
      }

      // SDK가 이미 로드되었는지 확인
      if (window.kakaoSDKReady) {
        const isReady = await window.kakaoSDKReady;
        if (!isReady) {
          const errorMsg = 'Kakao Maps SDK 초기화에 실패했습니다.';
          setError(errorMsg);

          logError(new Error(errorMsg), {
            area: 'ui',
            severity: 'high',
          });
          return;
        }
      }

      try {
        // 기본 중심 좌표 (사용자 위치 또는 서울시청)
        const centerLat = userLocation?.latitude ?? 37.5665;
        const centerLng = userLocation?.longitude ?? 126.9780;

        const mapOption = {
          center: new window.kakao.maps.LatLng(centerLat, centerLng),
          level: 5, // 확대 레벨 (1~14, 작을수록 확대)
        };

        const map = new window.kakao.maps.Map(mapContainerRef.current!, mapOption);
        mapRef.current = map;

        // 줌 컨트롤 추가
        const zoomControl = new window.kakao.maps.ZoomControl();
        map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

        setIsMapLoaded(true);
        console.log('✅ Kakao Map initialized successfully');
      } catch (err) {
        console.error('Failed to initialize Kakao Map:', err);
        setError('지도를 초기화할 수 없습니다.');
      }
    };

    initMap();
  }, []); // 최초 1회만 실행

  /**
   * 사용자 위치 마커 업데이트
   */
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !userLocation) return;

    const map = mapRef.current;
    const position = new window.kakao.maps.LatLng(
      userLocation.latitude,
      userLocation.longitude
    );

    // 사용자 위치 마커 생성 (파란색 원형 마커)
    const userMarkerContent = `
      <div style="
        position: relative;
        width: 24px;
        height: 24px;
      ">
        <!-- 외곽 흰색 원 -->
        <div style="
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background-color: white;
          border: 3px solid #3B82F6;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>
        <!-- 중앙 파란색 점 -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #3B82F6;
        "></div>
      </div>
    `;

    const userMarker = new window.kakao.maps.CustomOverlay({
      position,
      content: userMarkerContent,
      zIndex: 100, // 가장 위에 표시
    });

    userMarker.setMap(map);

    // 지도 중심 이동
    map.setCenter(position);

    return () => {
      userMarker.setMap(null);
    };
  }, [isMapLoaded, userLocation]);

  /**
   * 병원 마커 업데이트
   */
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;

    const map = mapRef.current;

    // 기존 마커 제거
    markersRef.current.forEach((markerData) => markerData.overlay.setMap(null));
    markersRef.current = [];

    // Edge Case 3: 빈 병원 목록
    if (hospitals.length === 0) {
      console.warn('No hospitals to display on map');
      return;
    }

    const bounds = new window.kakao.maps.LatLngBounds();
    let hasValidMarker = false;

    hospitals.forEach((hospital, index) => {
      const coords = hospital.coordinates;

      // Edge Case 4: 좌표 없는 병원은 스킵
      if (!coords) {
        console.warn(`Hospital "${hospital.name}" has no coordinates`);
        return;
      }

      const position = new window.kakao.maps.LatLng(
        coords.latitude,
        coords.longitude
      );

      // 병상 가용 상태에 따른 색상 결정
      const status = hospital.getAvailabilityStatus();
      let markerColor = '#34C759'; // 기본: 녹색 (AVAILABLE)

      if (status === 'FULL') {
        markerColor = '#FF3B30'; // 빨강 (만실)
      } else if (status === 'LIMITED') {
        markerColor = '#FFD60A'; // 노랑 (제한)
      }

      // 펄스 애니메이션 마커 + 간단한 정보창 생성
      const markerId = `pulse-marker-${hospital.id}`;
      const distance = userLocation ? (hospital.distanceFrom(userLocation) / 1000).toFixed(1) : '?';

      const pulseMarkerContent = `
        <div id="${markerId}" style="
          position: absolute;
          width: 60px;
          height: 60px;
          left: -30px;
          top: -30px;
        ">
          <!-- Pulse ring 1 -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            width: 30px;
            height: 30px;
            margin: -15px 0 0 -15px;
            border-radius: 50%;
            background-color: ${markerColor};
            animation: hospital-pulse 2s ease-out infinite;
            pointer-events: none;
          "></div>

          <!-- Pulse ring 2 -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            width: 30px;
            height: 30px;
            margin: -15px 0 0 -15px;
            border-radius: 50%;
            background-color: ${markerColor};
            animation: hospital-pulse 2s ease-out infinite;
            animation-delay: 0.7s;
            pointer-events: none;
          "></div>

          <!-- Center dot (클릭 가능) -->
          <div
            class="marker-dot"
            onclick="window.toggleMarkerInfo('${hospital.id}')"
            style="
              position: absolute;
              top: 50%;
              left: 50%;
              width: 16px;
              height: 16px;
              margin: -8px 0 0 -8px;
              border-radius: 50%;
              background-color: ${markerColor};
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
              cursor: pointer;
              transition: transform 0.2s;
              z-index: 100;
            "
            onmouseover="this.style.transform='scale(1.3)'"
            onmouseout="this.style.transform='scale(1)'"
          ></div>

          <!-- 간단한 정보창 (처음엔 숨김) -->
          <div
            id="info-${hospital.id}"
            class="marker-info"
            style="
              display: none;
              position: absolute;
              bottom: 75px;
              left: 50%;
              transform: translateX(-50%);
              background: white;
              padding: 10px 12px;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
              white-space: nowrap;
              z-index: 1000;
              pointer-events: auto;
            "
          >
            <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px; color: #333;">
              ${hospital.name}
            </div>
            <div style="font-size: 11px; color: #666; margin-bottom: 2px;">
              📍 ${distance}km · 🏥 ${hospital.availableBeds}/${hospital.totalBeds} 병상
            </div>
            <div style="font-size: 11px; color: ${hospital.isOperating ? '#22C55E' : '#EF4444'};">
              ${hospital.isOperating ? '✅ 운영중' : '❌ 미운영'}
            </div>
            <!-- 말풍선 꼬리 -->
            <div style="
              position: absolute;
              bottom: -6px;
              left: 50%;
              transform: translateX(-50%) rotate(45deg);
              width: 12px;
              height: 12px;
              background: white;
              box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
            "></div>
          </div>
        </div>
      `;

      const overlay = new window.kakao.maps.CustomOverlay({
        position,
        content: pulseMarkerContent,
        zIndex: 50 - index,
      });

      overlay.setMap(map);

      // 마커 정보 저장 (overlay, hospital ID)
      markersRef.current.push({
        overlay,
        hospitalId: hospital.id,
      });
      bounds.extend(position);
      hasValidMarker = true;
    });

    // 모든 마커가 보이도록 지도 범위 조정 (최초 1회만)
    if (hasValidMarker && !initialBoundsSetRef.current) {
      map.setBounds(bounds);
      initialBoundsSetRef.current = true;
      console.log('✅ Initial map bounds set');
    }

  }, [isMapLoaded, hospitals, selectedHospitalId, onHospitalClick, userLocation]);

  return (
    <div className={className} style={{ width: '100%', height: '100%', position: 'relative', ...style }}>
      {/* 지도 컨테이너 (항상 렌더링) */}
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%' }}
      />

      {/* 에러 오버레이 */}
      {error && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            themeMode === 'dark' ? 'bg-secondary' : 'bg-gray-100'
          )}
        >
          <div className="text-center p-6 max-w-md">
            <span className="text-5xl mb-4 block">🗺️</span>
            <p
              className={cn(
                'font-bold text-lg mb-2',
                themeMode === 'dark' ? 'text-destructive' : 'text-red-600'
              )}
            >
              지도를 불러올 수 없습니다
            </p>
            <p
              className={cn(
                'text-sm mb-4',
                themeMode === 'dark' ? 'text-muted-foreground' : 'text-gray-600'
              )}
            >
              {error}
            </p>
            <div
              className={cn(
                'p-3 rounded-lg text-xs',
                themeMode === 'dark' ? 'bg-secondary border border-border' : 'bg-gray-50 border border-gray-200'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">💡</span>
                <span
                  className={cn(
                    'font-semibold',
                    themeMode === 'dark' ? 'text-foreground' : 'text-gray-900'
                  )}
                >
                  해결 방법
                </span>
              </div>
              <ul className="text-left space-y-1">
                <li className={cn(themeMode === 'dark' ? 'text-muted-foreground' : 'text-gray-600')}>
                  • 리스트 보기로 전환하여 병원 목록 확인
                </li>
                <li className={cn(themeMode === 'dark' ? 'text-muted-foreground' : 'text-gray-600')}>
                  • 페이지를 새로고침해보세요
                </li>
                <li className={cn(themeMode === 'dark' ? 'text-muted-foreground' : 'text-gray-600')}>
                  • 네트워크 연결을 확인하세요
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 로딩 오버레이 */}
      {!isMapLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-95">
          <div className="text-center p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm">지도 로딩 중...</p>
          </div>
        </div>
      )}
    </div>
  );
}
