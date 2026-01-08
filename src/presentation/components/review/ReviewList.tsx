import React, { useState, useEffect } from 'react';
import { ReviewService, Review } from '../../../domain/services/ReviewService';
import { ReviewForm } from './ReviewForm';
import { useAppStore } from '../../../infrastructure/state/store';
import { lightTheme, darkTheme } from '../../styles/theme';

interface ReviewListProps {
  hospitalId: string;
  hospitalName: string;
  hospitalAddress: string;
}

/**
 * ReviewList Component
 * 병원 리뷰 목록 표시 및 관리
 *
 * Features:
 * - 리뷰 목록 조회 (최신순)
 * - 평균 별점 표시
 * - 내 리뷰 수정/삭제
 * - 리뷰 작성 폼 토글
 */
export const ReviewList: React.FC<ReviewListProps> = ({
  hospitalId,
  hospitalName,
  hospitalAddress,
}) => {
  const { user, openLoginModal, themeMode } = useAppStore();
  const theme = themeMode === 'light' ? lightTheme : darkTheme;
  const isDark = themeMode === 'dark';
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showWriteForm, setShowWriteForm] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [myReview, setMyReview] = useState<Review | null>(null);

  // 리뷰 데이터 로드
  const loadReviews = async () => {
    setLoading(true);

    try {
      // 병원 리뷰 조회
      const reviewsResult = await ReviewService.getHospitalReviews(hospitalId);
      if (reviewsResult.success) {
        setReviews(reviewsResult.reviews);
      }

      // 평균 별점 조회
      const statsResult =
        await ReviewService.getHospitalRatingStats(hospitalId);
      if (statsResult.success) {
        setAverageRating(statsResult.stats.averageRating);
        setTotalReviews(statsResult.stats.totalReviews);
      }

      // 내 리뷰 확인
      if (user) {
        const myReviewResult =
          await ReviewService.hasUserReviewedHospital(user.id, hospitalId);
        if (myReviewResult.success && myReviewResult.review) {
          setMyReview(myReviewResult.review);
        }
      }
    } catch (error) {
      console.error('Load reviews error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [hospitalId, user]);

  // 리뷰 작성 버튼 클릭
  const handleWriteReview = () => {
    if (!user) {
      openLoginModal('리뷰 작성');
      return;
    }

    if (myReview) {
      alert('이미 이 병원에 리뷰를 작성하셨습니다. 수정하시려면 리뷰를 클릭하세요.');
      return;
    }

    setShowWriteForm(true);
  };

  // 리뷰 수정 버튼 클릭
  const handleEditReview = (review: Review) => {
    setEditingReview(review);
    setShowWriteForm(true);
  };

  // 리뷰 삭제
  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('리뷰를 삭제하시겠습니까?')) {
      return;
    }

    const result = await ReviewService.deleteReview(reviewId);
    if (result.success) {
      alert('✅ 리뷰가 삭제되었습니다.');
      setMyReview(null);
      loadReviews();
    } else {
      alert(`삭제 실패: ${result.error}`);
    }
  };

  // 리뷰 작성/수정 성공
  const handleReviewSuccess = () => {
    setShowWriteForm(false);
    setEditingReview(null);
    loadReviews();
  };

  // 리뷰 작성/수정 취소
  const handleReviewCancel = () => {
    setShowWriteForm(false);
    setEditingReview(null);
  };

  // 별점 렌더링
  const renderStars = (rating: number, size: 'small' | 'large' = 'small') => {
    const fontSize = size === 'large' ? '24px' : '14px';
    return (
      <div style={{ display: 'flex', gap: '2px' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            style={{
              fontSize,
              color: star <= rating ? theme.status.warning : (isDark ? theme.text.dim : '#D1D5DB'),
            }}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p style={{ color: theme.text.secondary, transition: 'color 0.3s ease' }}>리뷰를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      {/* 평균 별점 요약 */}
      <div
        style={{
          backgroundColor: isDark ? theme.background.secondary : '#F9FAFB',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          textAlign: 'center',
          transition: 'background-color 0.3s ease',
        }}
      >
        <div
          style={{
            fontSize: '48px',
            fontWeight: '700',
            color: theme.text.primary,
            marginBottom: '8px',
            transition: 'color 0.3s ease',
          }}
        >
          {totalReviews > 0 ? averageRating.toFixed(1) : '-'}
        </div>
        {renderStars(Math.round(averageRating), 'large')}
        <p
          style={{
            fontSize: '14px',
            color: theme.text.secondary,
            marginTop: '8px',
            marginBottom: 0,
            transition: 'color 0.3s ease',
          }}
        >
          {totalReviews}개의 리뷰
        </p>
      </div>

      {/* 리뷰 작성 버튼 */}
      {!showWriteForm && (
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={handleWriteReview}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: '600',
              backgroundColor: myReview ? (isDark ? theme.background.secondary : '#F3F4F6') : theme.status.info,
              color: myReview ? theme.text.secondary : '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: myReview ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
            }}
            disabled={!!myReview}
          >
            {myReview ? '✅ 리뷰 작성 완료' : '📝 리뷰 작성하기'}
          </button>
        </div>
      )}

      {/* 리뷰 작성/수정 폼 */}
      {showWriteForm && user && (
        <div style={{ marginBottom: '24px' }}>
          <ReviewForm
            hospitalId={hospitalId}
            hospitalName={hospitalName}
            hospitalAddress={hospitalAddress}
            userId={user.id}
            existingReview={editingReview || undefined}
            onSuccess={handleReviewSuccess}
            onCancel={handleReviewCancel}
          />
        </div>
      )}

      {/* 리뷰 목록 */}
      <div>
        <h3
          style={{
            fontSize: '18px',
            fontWeight: '700',
            marginBottom: '16px',
            color: theme.text.primary,
            transition: 'color 0.3s ease',
          }}
        >
          리뷰 ({totalReviews})
        </h3>

        {reviews.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: isDark ? theme.background.secondary : '#F9FAFB',
              borderRadius: '8px',
              transition: 'background-color 0.3s ease',
            }}
          >
            <p style={{ fontSize: '14px', color: theme.text.secondary, margin: 0, transition: 'color 0.3s ease' }}>
              아직 작성된 리뷰가 없습니다.
              <br />첫 리뷰를 작성해보세요!
            </p>
          </div>
        ) : (
          reviews.map((review) => {
            const isMyReview = user && review.user_id === user.id;

            return (
              <div
                key={review.id}
                style={{
                  padding: '16px',
                  backgroundColor: isMyReview ? (isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF') : theme.background.primary,
                  border: isMyReview
                    ? `2px solid ${theme.status.info}`
                    : `1px solid ${theme.border.primary}`,
                  borderRadius: '8px',
                  marginBottom: '12px',
                  transition: 'all 0.3s ease',
                }}
              >
                {/* 헤더: 별점 + 날짜 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {renderStars(review.rating)}
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>
                      {review.rating}.0
                    </span>
                    {isMyReview && (
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: theme.status.info,
                          backgroundColor: isDark ? 'rgba(0, 217, 255, 0.2)' : '#DBEAFE',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          transition: 'all 0.3s ease',
                        }}
                      >
                        내 리뷰
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: theme.text.secondary, transition: 'color 0.3s ease' }}>
                    {formatDate(review.created_at)}
                  </span>
                </div>

                {/* 댓글 */}
                <p
                  style={{
                    fontSize: '14px',
                    color: theme.text.primary,
                    lineHeight: '1.6',
                    marginBottom: isMyReview ? '12px' : 0,
                    whiteSpace: 'pre-wrap',
                    transition: 'color 0.3s ease',
                  }}
                >
                  {review.comment}
                </p>

                {/* 수정/삭제 버튼 (내 리뷰만) */}
                {isMyReview && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleEditReview(review)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        backgroundColor: isDark ? theme.background.secondary : '#fff',
                        color: theme.status.info,
                        border: `1px solid ${theme.status.info}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDeleteReview(review.id)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        backgroundColor: isDark ? theme.background.secondary : '#fff',
                        color: isDark ? '#FF003D' : '#EF4444',
                        border: `1px solid ${isDark ? '#FF003D' : '#EF4444'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
