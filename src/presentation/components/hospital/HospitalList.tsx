import React, { useMemo } from 'react';
import { Hospital } from '../../../domain/entities/Hospital';
import { Coordinates } from '../../../domain/valueObjects/Coordinates';
import { HospitalSearchWarning } from '../../../domain/usecases/GetNearbyHospitals';
import { SortOption } from '../../../domain/types/SortOption';
import { HospitalSortService } from '../../../domain/services/HospitalSortService';
import { HospitalCard } from './HospitalCard';
import { SkeletonCard } from '../common/SkeletonCard';
import { SortSelector } from './SortSelector';
import { useAppStore } from '../../../infrastructure/state/store';
import { lightTheme, darkTheme } from '../../styles/theme';

interface HospitalListProps {
  hospitals: Hospital[];
  userLocation: Coordinates | null;
  warning: HospitalSearchWarning | null;
  isLoading: boolean;
  sortOption: SortOption;
  targetDisease?: string | null;
  onSortChange: (option: SortOption) => void;
  onHospitalClick?: (hospital: Hospital) => void;
}

/**
 * HospitalList Component
 * 병원 목록을 표시하고 경고 메시지를 처리
 */
export const HospitalList: React.FC<HospitalListProps> = ({
  hospitals,
  userLocation,
  warning,
  isLoading,
  sortOption,
  targetDisease,
  onSortChange,
  onHospitalClick,
}) => {
  // 테마 모드
  const { themeMode } = useAppStore();
  const theme = themeMode === 'light' ? lightTheme : darkTheme;

  // 표시할 병원 수 상태 (10개씩 증가)
  const [displayCount, setDisplayCount] = React.useState(10);

  // 정렬된 병원 목록 (useMemo로 최적화)
  const sortedHospitals = useMemo(() => {
    return HospitalSortService.sortHospitals(hospitals, sortOption, userLocation, targetDisease);
  }, [hospitals, sortOption, userLocation, targetDisease]);

  // 정렬 옵션이나 병원 목록이 변경되면 displayCount 초기화
  React.useEffect(() => {
    setDisplayCount(10);
  }, [sortOption, hospitals]);

  // 표시할 병원 목록 (displayCount까지만)
  const displayedHospitals = useMemo(() => {
    return sortedHospitals.slice(0, displayCount);
  }, [sortedHospitals, displayCount]);

  // 더 보기 핸들러
  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + 10);
  };
  // 로딩 상태 - 스켈레톤 UI 표시
  if (isLoading) {
    return (
      <div>
        {/* 로딩 헤더 */}
        <div
          style={{
            backgroundColor: '#E3F2FD',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid #BBDEFB',
              borderTop: '3px solid #007AFF',
              borderRadius: '50%',
              margin: '0 auto 8px',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p style={{ fontSize: '14px', color: '#1976D2', margin: 0, fontWeight: '600' }}>
            🚗 주변 응급실 검색 중...
          </p>
          <p style={{ fontSize: '12px', color: '#64B5F6', margin: '4px 0 0' }}>
            실시간 경로 정보를 계산하고 있습니다
          </p>
        </div>

        {/* 스켈레톤 카드 (3개) */}
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />

        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  // 경고 메시지 렌더링
  const renderWarning = () => {
    if (!warning) return null;

    const getWarningStyle = () => {
      switch (warning.type) {
        case 'NO_HOSPITALS_FOUND':
        case 'NO_BEDS_AVAILABLE':
          return { bgColor: '#FF3B30', textColor: '#fff' };
        case 'DATA_STALE':
          return { bgColor: '#FF9500', textColor: '#fff' };
        case 'LOW_ACCURACY':
          return { bgColor: '#FFD60A', textColor: '#000' };
        default:
          return { bgColor: '#9E9E9E', textColor: '#fff' };
      }
    };

    const style = getWarningStyle();

    return (
      <div
        style={{
          backgroundColor: style.bgColor,
          color: style.textColor,
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
        role="alert"
      >
        <p style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '600' }}>
          ⚠️ {warning.message}
        </p>
        {warning.action && (
          <button
            onClick={warning.action.onClick}
            style={{
              width: '100%',
              height: '44px',
              fontSize: '16px',
              fontWeight: '700',
              backgroundColor: '#fff',
              color: style.bgColor,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {warning.action.label}
          </button>
        )}
      </div>
    );
  };

  // 병원 없음
  if (hospitals.length === 0 && !isLoading) {
    return (
      <div>
        {renderWarning()}
        <div style={{ textAlign: 'center', padding: '40px', color: theme.text.dim, transition: 'color 0.3s ease' }}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>🏥</p>
          <p style={{ fontSize: '16px' }}>검색 결과가 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {renderWarning()}

      {/* 정렬 옵션 */}
      <SortSelector selectedOption={sortOption} onOptionChange={onSortChange} />

      {/* 결과 요약 */}
      <div style={{ marginBottom: '16px', color: theme.text.secondary, fontSize: '14px', transition: 'color 0.3s ease' }}>
        총 <strong style={{ color: theme.text.primary, transition: 'color 0.3s ease' }}>{hospitals.length}개</strong> 병원 검색됨
        {displayCount < sortedHospitals.length && (
          <span style={{ marginLeft: '8px', color: theme.text.dim, transition: 'color 0.3s ease' }}>
            (현재 {displayCount}개 표시)
          </span>
        )}
      </div>

      {/* 병원 카드 목록 (10개씩 표시) */}
      <div role="list">
        {displayedHospitals.map((hospital) => (
          <HospitalCard
            key={hospital.id}
            hospital={hospital}
            userLocation={userLocation}
            targetDisease={targetDisease}
            onClick={() => onHospitalClick?.(hospital)}
          />
        ))}
      </div>

      {/* 더 보기 버튼 (10개씩 추가 로드) */}
      {displayCount < sortedHospitals.length && (
        <button
          onClick={handleLoadMore}
          style={{
            width: '100%',
            padding: '16px',
            marginTop: '16px',
            marginBottom: '16px',
            fontSize: '16px',
            fontWeight: '600',
            backgroundColor: '#F3F4F6',
            color: '#374151',
            border: '2px solid #E5E7EB',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#E5E7EB';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#F3F4F6';
            e.currentTarget.style.borderColor = '#E5E7EB';
          }}
        >
          📋 다음 10개 병원 보기 ({displayCount}/{sortedHospitals.length})
        </button>
      )}

      {/* 하단 안내 메시지 */}
      <div
        style={{
          textAlign: 'center',
          padding: '20px',
          color: '#999',
          fontSize: '13px',
          borderTop: '1px solid #eee',
          marginTop: '20px',
        }}
      >
        <p style={{ margin: 0 }}>
          실제 병상 가용 현황은 병원에 직접 문의하시기 바랍니다.
        </p>
        <p style={{ margin: '8px 0 0' }}>
          응급 상황 시 <strong style={{ color: '#FF3B30' }}>119</strong>에 먼저 연락하세요.
        </p>
      </div>
    </div>
  );
};
