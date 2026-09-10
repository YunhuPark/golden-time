import React, { useState, useEffect, useCallback } from 'react';
import { ReviewService, Review } from '../../../domain/services/ReviewService';
import { useAppStore } from '../../../infrastructure/state/store';

/**
 * MyReviewsList Component
 * 사용자가 작성한 모든 리뷰 목록 표시
 *
 * Features:
 * - 내가 작성한 모든 리뷰 조회
 * - 병원별로 그룹화하여 표시
 * - 리뷰 삭제 기능
 * - 빈 상태 메시지
 */
export const MyReviewsList: React.FC = () => {
  const { user } = useAppStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  // 내 리뷰 로드
  const loadMyReviews = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await ReviewService.getUserReviews(user.id);
      if (result.success) {
        setReviews(result.reviews);
      }
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadMyReviews();
  }, [loadMyReviews]);

  // 리뷰 삭제
  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('리뷰를 삭제하시겠습니까?')) {
      return;
    }

    const result = await ReviewService.deleteReview(reviewId);
    if (result.success) {
      alert('✅ 리뷰가 삭제되었습니다.');
      loadMyReviews(); // 목록 새로고침
    } else {
      alert(`삭제 실패: ${result.error}`);
    }
  };

  // 별점 렌더링
  const renderStars = (rating: number) => {
    return (
      <div style={{ display: 'flex', gap: '2px' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            style={{
              fontSize: '16px',
              color: star <= rating ? '#FFD60A' : '#D1D5DB',
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
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#fff',
          borderRadius: '16px',
        }}
      >
        <p style={{ fontSize: '16px', color: '#6B7280', margin: 0 }}>
          리뷰를 불러오는 중...
        </p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div
        style={{
          padding: '60px 40px',
          textAlign: 'center',
          backgroundColor: '#fff',
          borderRadius: '16px',
          border: '2px dashed #E5E7EB',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
        <h3
          style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#374151',
            marginBottom: '8px',
          }}
        >
          작성한 리뷰가 없습니다
        </h3>
        <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>
          병원을 방문한 후 리뷰를 남겨보세요!
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2
          style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#111827',
            margin: 0,
          }}
        >
          내가 작성한 리뷰
        </h2>
        <span
          style={{
            fontSize: '14px',
            color: '#6B7280',
            backgroundColor: '#F3F4F6',
            padding: '6px 12px',
            borderRadius: '20px',
            fontWeight: '600',
          }}
        >
          총 {reviews.length}개
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {reviews.map((review) => (
          <div
            key={review.id}
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #E5E7EB',
            }}
          >
            {/* 병원 정보 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px',
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#1F2937',
                    margin: '0 0 4px',
                  }}
                >
                  🏥 {review.hospital_name}
                </h3>
                <p
                  style={{
                    fontSize: '13px',
                    color: '#6B7280',
                    margin: '0 0 8px',
                  }}
                >
                  📍 {review.hospital_address}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {renderStars(review.rating)}
                  <span
                    style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#374151',
                    }}
                  >
                    {review.rating}.0
                  </span>
                </div>
              </div>
              <span style={{ fontSize: '13px', color: '#9CA3AF' }}>
                {formatDate(review.created_at)}
              </span>
            </div>

            {/* 리뷰 내용 */}
            <p
              style={{
                fontSize: '15px',
                color: '#4B5563',
                lineHeight: '1.6',
                marginBottom: '16px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {review.comment}
            </p>

            {/* 삭제 버튼 */}
            <button
              onClick={() => handleDeleteReview(review.id)}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600',
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                border: '1px solid #FCA5A5',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              🗑️ 삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
