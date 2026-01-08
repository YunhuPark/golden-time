import React from 'react';

/**
 * SkeletonCard Component
 * 병원 카드 로딩 시 표시되는 스켈레톤 UI
 */
export const SkeletonCard: React.FC = () => {
  return (
    <div
      style={{
        border: '4px solid #E0E0E0',
        backgroundColor: '#F5F5F5',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    >
      {/* 헤더: 병원명 + 거리 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div
          style={{
            width: '60%',
            height: '24px',
            backgroundColor: '#E0E0E0',
            borderRadius: '4px',
          }}
        />
        <div
          style={{
            width: '20%',
            height: '24px',
            backgroundColor: '#E0E0E0',
            borderRadius: '4px',
          }}
        />
      </div>

      {/* 병상 정보 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div
          style={{
            width: '100px',
            height: '32px',
            backgroundColor: '#E0E0E0',
            borderRadius: '4px',
          }}
        />
        <div
          style={{
            width: '80px',
            height: '24px',
            backgroundColor: '#E0E0E0',
            borderRadius: '4px',
          }}
        />
      </div>

      {/* 주소 */}
      <div
        style={{
          width: '90%',
          height: '16px',
          backgroundColor: '#E0E0E0',
          borderRadius: '4px',
          marginBottom: '8px',
        }}
      />

      {/* 전문과 */}
      <div
        style={{
          width: '70%',
          height: '16px',
          backgroundColor: '#E0E0E0',
          borderRadius: '4px',
          marginBottom: '12px',
        }}
      />

      {/* 버튼 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div
          style={{
            flex: 1,
            height: '48px',
            backgroundColor: '#E0E0E0',
            borderRadius: '8px',
          }}
        />
        <div
          style={{
            flex: 1,
            height: '48px',
            backgroundColor: '#E0E0E0',
            borderRadius: '8px',
          }}
        />
      </div>

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}
      </style>
    </div>
  );
};
