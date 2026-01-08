import React from 'react';
import { Hospital } from '../../../domain/entities/Hospital';
import { ReviewList } from '../review/ReviewList';
import { useAppStore } from '../../../infrastructure/state/store';
import { lightTheme, darkTheme } from '../../styles/theme';

interface HospitalDetailModalProps {
  hospital: Hospital;
  onClose: () => void;
}

/**
 * HospitalDetailModal Component
 * 병원 상세 정보 및 리뷰 모달
 *
 * Features:
 * - 병원 기본 정보 표시
 * - 리뷰 목록 및 작성 기능
 * - 모달 닫기
 */
export const HospitalDetailModal: React.FC<HospitalDetailModalProps> = ({
  hospital,
  onClose,
}) => {
  const { themeMode } = useAppStore();
  const theme = themeMode === 'light' ? lightTheme : darkTheme;
  const isDark = themeMode === 'dark';

  // 배경 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.background.overlay,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: theme.background.primary,
          borderRadius: '16px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: theme.card.shadow,
          transition: 'all 0.3s ease',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.border.primary}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transition: 'border-color 0.3s ease',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '24px',
                fontWeight: '700',
                color: theme.text.primary,
                margin: '0 0 4px',
                transition: 'color 0.3s ease',
              }}
            >
              {hospital.name}
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: theme.text.secondary,
                margin: 0,
                transition: 'color 0.3s ease',
              }}
            >
              📍 {hospital.address}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              fontSize: '24px',
              backgroundColor: isDark ? theme.background.secondary : '#F3F4F6',
              color: theme.text.secondary,
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.3s ease',
            }}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* 리뷰 목록 (스크롤 가능) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
          }}
        >
          <ReviewList
            hospitalId={hospital.id}
            hospitalName={hospital.name}
            hospitalAddress={hospital.address}
          />
        </div>
      </div>
    </div>
  );
};
