import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../../infrastructure/state/store';
import { supabase } from '../../../infrastructure/supabase/supabaseClient';
import { useAuthSession } from '../../hooks/useAuthSession';
import { SessionExpiredModal } from '../common/SessionExpiredModal';
import { logError } from '../../../infrastructure/monitoring/sentry';

interface Favorite {
  id: string;
  hospital_id: string;
  hospital_name: string;
  hospital_address: string;
  created_at: string;
}

/**
 * FavoritesList Component
 * 즐겨찾기한 병원 목록
 *
 * Enhanced with session expiry detection
 */
export const FavoritesList: React.FC = () => {
  const { user, openLoginModal } = useAppStore();
  const { handleSessionError } = useAuthSession();

  // 상태
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>('');

  // 컴포넌트 마운트 시 즐겨찾기 로드
  useEffect(() => {
    if (!user) return;

    const loadFavorites = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('favorites')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) {
          // 세션 만료 감지
          if (handleSessionError(fetchError)) {
            setPendingAction('즐겨찾기 목록 보기');
            setShowSessionModal(true);
            logError(fetchError, {
              area: 'auth',
              severity: 'medium',
              extra: { operation: 'loadFavorites', context: 'session_expired' },
            });
          } else {
            setError(`즐겨찾기 로드 실패: ${fetchError.message}`);
            logError(fetchError, {
              area: 'api',
              severity: 'medium',
              extra: { operation: 'loadFavorites' },
            });
          }
        } else {
          setFavorites(data || []);
        }
      } catch (err) {
        console.error('Failed to load favorites:', err);
        setError('즐겨찾기를 불러오는 중 오류가 발생했습니다.');
        const normalizedError = err instanceof Error ? err : new Error(String(err));
        logError(normalizedError, {
          area: 'api',
          severity: 'medium',
          extra: { operation: 'loadFavorites' },
        });
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, [user, handleSessionError]);

  // 즐겨찾기 제거 핸들러
  const handleRemoveFavorite = async (favoriteId: string, hospitalName: string) => {
    if (!user) return;

    const confirmed = window.confirm(`${hospitalName}을(를) 즐겨찾기에서 제거하시겠습니까?`);
    if (!confirmed) return;

    setDeletingId(favoriteId);

    try {
      const { error: deleteError } = await supabase
        .from('favorites')
        .delete()
        .eq('id', favoriteId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // 로컬 상태 업데이트
      setFavorites(favorites.filter((fav) => fav.id !== favoriteId));
      alert('☆ 즐겨찾기에서 제거되었습니다.');
    } catch (err: unknown) {
      const normalizedError = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to remove favorite:', normalizedError);

      // 세션 만료 감지
      if (handleSessionError(err)) {
        setPendingAction('즐겨찾기 제거');
        setShowSessionModal(true);
        logError(normalizedError, {
          area: 'auth',
          severity: 'medium',
          extra: { operation: 'removeFavorite', context: 'session_expired', hospital: hospitalName },
        });
      } else {
        alert('즐겨찾기 제거 중 오류가 발생했습니다.');
        logError(normalizedError, {
          area: 'api',
          severity: 'low',
          extra: { operation: 'removeFavorite', hospital: hospitalName },
        });
      }
    } finally {
      setDeletingId(null);
    }
  };

  // 세션 만료 모달 - 재로그인 핸들러
  const handleRelogin = () => {
    setShowSessionModal(false);
    openLoginModal(pendingAction || '즐겨찾기');
  };

  // 비로그인 상태
  if (!user) {
    return (
      <div
        style={{
          backgroundColor: '#FEF3C7',
          border: '2px solid #F59E0B',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <h3
          style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#92400E',
            margin: '0 0 8px',
          }}
        >
          🔒 로그인이 필요합니다
        </h3>
        <p
          style={{
            fontSize: '14px',
            color: '#78350F',
            marginBottom: '16px',
          }}
        >
          즐겨찾기 목록을 보려면 로그인해주세요.
        </p>
        <button
          onClick={() => openLoginModal('즐겨찾기')}
          style={{
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: '700',
            color: '#fff',
            backgroundColor: '#FF3B30',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          로그인하기
        </button>
      </div>
    );
  }

  // 로딩 중
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ fontSize: '16px', color: '#6B7280' }}>
          즐겨찾기 목록을 불러오는 중...
        </p>
      </div>
    );
  }

  // 에러
  if (error) {
    return (
      <div
        style={{
          backgroundColor: '#FEE2E2',
          color: '#991B1B',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '14px',
        }}
      >
        ⚠️ {error}
      </div>
    );
  }

  // 즐겨찾기 없음
  if (favorites.length === 0) {
    return (
      <div
        style={{
          backgroundColor: '#F3F4F6',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
        }}
      >
        <h3
          style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#6B7280',
            margin: '0 0 8px',
          }}
        >
          ⭐ 즐겨찾기한 병원이 없습니다
        </h3>
        <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>
          병원 카드에서 별 아이콘을 눌러 즐겨찾기에 추가할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* 헤더 */}
      <div style={{ marginBottom: '24px' }}>
        <h2
          style={{
            fontSize: '22px',
            fontWeight: '700',
            color: '#111827',
            margin: '0 0 8px',
          }}
        >
          ⭐ 즐겨찾기 병원
        </h2>
        <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
          총 {favorites.length}개의 병원을 즐겨찾기했습니다.
        </p>
      </div>

      {/* 즐겨찾기 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {favorites.map((favorite) => (
          <div
            key={favorite.id}
            style={{
              border: '2px solid #E5E7EB',
              borderRadius: '8px',
              padding: '16px',
              backgroundColor: '#FAFAFA',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div style={{ flex: 1 }}>
                <h4
                  style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#111827',
                    margin: '0 0 8px',
                  }}
                >
                  ⭐ {favorite.hospital_name}
                </h4>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    margin: '0 0 8px',
                  }}
                >
                  📍 {favorite.hospital_address}
                </p>
                <p
                  style={{
                    fontSize: '12px',
                    color: '#9CA3AF',
                    margin: 0,
                  }}
                >
                  추가일: {new Date(favorite.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <button
                onClick={() => handleRemoveFavorite(favorite.id, favorite.hospital_name)}
                disabled={deletingId === favorite.id}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: deletingId === favorite.id ? '#ccc' : '#FEE2E2',
                  color: deletingId === favorite.id ? '#666' : '#991B1B',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: deletingId === favorite.id ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {deletingId === favorite.id ? '제거 중...' : '제거'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 안내 */}
      <p
        style={{
          fontSize: '12px',
          color: '#9CA3AF',
          textAlign: 'center',
          marginTop: '16px',
          marginBottom: 0,
        }}
      >
        💡 병원 카드에서 별 아이콘(⭐/☆)을 눌러 즐겨찾기를 추가하거나 제거할 수 있습니다
      </p>

      {/* 세션 만료 모달 */}
      <SessionExpiredModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        intendedAction={pendingAction}
        onRelogin={handleRelogin}
      />
    </div>
  );
};
