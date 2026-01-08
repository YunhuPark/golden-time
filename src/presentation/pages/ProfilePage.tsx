import React, { useState } from 'react';
import { MedicalProfileForm } from '../components/profile/MedicalProfileForm';
import { VisitHistoryList } from '../components/profile/VisitHistoryList';
import { FavoritesList } from '../components/profile/FavoritesList';
import { MyReviewsList } from '../components/profile/MyReviewsList';
import { useAppStore } from '../../infrastructure/state/store';
import { lightTheme, darkTheme } from '../styles/theme';

interface ProfilePageProps {
  onBack?: () => void;
}

/**
 * ProfilePage Component
 * 사용자 프로필 페이지: 의료 정보 + 방문 기록
 */
export const ProfilePage: React.FC<ProfilePageProps> = ({ onBack }) => {
  const { user, openLoginModal, themeMode } = useAppStore();
  const theme = themeMode === 'light' ? lightTheme : darkTheme;
  const [activeTab, setActiveTab] = useState<'favorites' | 'medical' | 'visits' | 'reviews'>('favorites');

  // 비로그인 상태
  if (!user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: theme.background.primary,
          padding: '24px',
          transition: 'background-color 0.3s ease',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              backgroundColor: themeMode === 'dark' ? theme.background.secondary : '#FEF3C7',
              border: `2px solid ${themeMode === 'dark' ? theme.border.primary : '#F59E0B'}`,
              borderRadius: '16px',
              padding: '40px',
              textAlign: 'center',
              transition: 'background-color 0.3s ease, border-color 0.3s ease',
            }}
          >
            <h2
              style={{
                fontSize: '28px',
                fontWeight: '700',
                color: theme.status.warning,
                margin: '0 0 12px',
                transition: 'color 0.3s ease',
              }}
            >
              🔒 로그인이 필요합니다
            </h2>
            <p
              style={{
                fontSize: '16px',
                color: theme.text.primary,
                marginBottom: '24px',
                transition: 'color 0.3s ease',
              }}
            >
              의료 정보와 방문 기록을 관리하려면 로그인해주세요.
            </p>
            <button
              onClick={() => openLoginModal('프로필')}
              style={{
                padding: '16px 32px',
                fontSize: '16px',
                fontWeight: '700',
                color: '#fff',
                backgroundColor: theme.status.critical,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              로그인하기
            </button>
            <p
              style={{
                fontSize: '14px',
                color: theme.text.dim,
                marginTop: '24px',
                marginBottom: 0,
                transition: 'color 0.3s ease',
              }}
            >
              💡 로그인 없이도 병원 검색 기능은 사용할 수 있습니다
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: theme.background.primary,
        padding: '24px',
        transition: 'background-color 0.3s ease',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* 헤더 */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1
              style={{
                fontSize: '32px',
                fontWeight: '700',
                color: theme.text.primary,
                margin: '0 0 8px',
                transition: 'color 0.3s ease',
              }}
            >
              👤 내 프로필
            </h1>
            <p
              style={{
                fontSize: '16px',
                color: theme.text.secondary,
                margin: 0,
                transition: 'color 0.3s ease',
              }}
            >
              {user.email}
            </p>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '600',
                backgroundColor: theme.background.secondary,
                color: theme.text.primary,
                border: `2px solid ${theme.border.primary}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            >
              ← 뒤로가기
            </button>
          )}
        </div>

        {/* 탭 */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '24px',
            borderBottom: `2px solid ${theme.border.primary}`,
            transition: 'border-color 0.3s ease',
          }}
        >
          <button
            onClick={() => setActiveTab('favorites')}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: activeTab === 'favorites' ? '700' : '500',
              color: activeTab === 'favorites' ? theme.status.critical : theme.text.secondary,
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom:
                activeTab === 'favorites'
                  ? `3px solid ${theme.status.critical}`
                  : '3px solid transparent',
              cursor: 'pointer',
              marginBottom: '-2px',
              transition: 'all 0.3s ease',
            }}
          >
            ⭐ 즐겨찾기
          </button>
          <button
            onClick={() => setActiveTab('medical')}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: activeTab === 'medical' ? '700' : '500',
              color: activeTab === 'medical' ? theme.status.critical : theme.text.secondary,
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom:
                activeTab === 'medical'
                  ? `3px solid ${theme.status.critical}`
                  : '3px solid transparent',
              cursor: 'pointer',
              marginBottom: '-2px',
              transition: 'all 0.3s ease',
            }}
          >
            💊 의료 정보
          </button>
          <button
            onClick={() => setActiveTab('visits')}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: activeTab === 'visits' ? '700' : '500',
              color: activeTab === 'visits' ? theme.status.critical : theme.text.secondary,
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom:
                activeTab === 'visits'
                  ? `3px solid ${theme.status.critical}`
                  : '3px solid transparent',
              cursor: 'pointer',
              marginBottom: '-2px',
              transition: 'all 0.3s ease',
            }}
          >
            📚 방문 기록
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: activeTab === 'reviews' ? '700' : '500',
              color: activeTab === 'reviews' ? theme.status.critical : theme.text.secondary,
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom:
                activeTab === 'reviews'
                  ? `3px solid ${theme.status.critical}`
                  : '3px solid transparent',
              cursor: 'pointer',
              marginBottom: '-2px',
              transition: 'all 0.3s ease',
            }}
          >
            ⭐ 내 리뷰
          </button>
        </div>

        {/* 컨텐츠 */}
        {activeTab === 'favorites' && <FavoritesList />}
        {activeTab === 'medical' && <MedicalProfileForm />}
        {activeTab === 'visits' && <VisitHistoryList />}
        {activeTab === 'reviews' && <MyReviewsList />}
      </div>
    </div>
  );
};
