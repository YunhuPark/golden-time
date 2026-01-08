import React from 'react';

interface LoadMoreRoutesButtonProps {
  currentCount: number;
  totalCount: number;
  isLoading: boolean;
  onClick: () => void;
}

/**
 * LoadMoreRoutesButton Component
 * 추가 병원의 경로 정보를 로드하는 버튼
 */
export const LoadMoreRoutesButton: React.FC<LoadMoreRoutesButtonProps> = ({
  currentCount,
  totalCount,
  isLoading,
  onClick,
}) => {
  // 모든 병원의 경로 정보가 로드되었으면 버튼 숨김
  if (currentCount >= totalCount) {
    return null;
  }

  const remainingCount = totalCount - currentCount;
  const nextBatchCount = Math.min(10, remainingCount);

  return (
    <div
      style={{
        marginTop: '16px',
        marginBottom: '16px',
        textAlign: 'center',
      }}
    >
      <button
        onClick={onClick}
        disabled={isLoading}
        style={{
          width: '100%',
          height: '56px',
          fontSize: '16px',
          fontWeight: '600',
          backgroundColor: isLoading ? '#E5E7EB' : '#F3F4F6',
          color: isLoading ? '#9CA3AF' : '#374151',
          border: '2px solid',
          borderColor: isLoading ? '#D1D5DB' : '#E5E7EB',
          borderRadius: '12px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s ease',
        }}
        aria-label="추가 병원 경로 정보 로드"
      >
        {isLoading ? (
          <>
            <div
              style={{
                width: '20px',
                height: '20px',
                border: '3px solid #D1D5DB',
                borderTop: '3px solid #6B7280',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <span>경로 정보 계산 중...</span>
          </>
        ) : (
          <>
            <span>🚗</span>
            <span>
              다음 {nextBatchCount}개 병원 경로 보기 ({currentCount}/{totalCount})
            </span>
          </>
        )}
      </button>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* 설명 텍스트 */}
      <p
        style={{
          fontSize: '13px',
          color: '#6B7280',
          marginTop: '8px',
          marginBottom: 0,
        }}
      >
        추가 병원의 소요시간과 예상 도착 시간을 확인할 수 있습니다
      </p>
    </div>
  );
};
