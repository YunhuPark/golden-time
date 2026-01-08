import React, { useState } from 'react';
import { ReviewService, Review } from '../../../domain/services/ReviewService';
import { useAppStore } from '../../../infrastructure/state/store';
import { lightTheme, darkTheme } from '../../styles/theme';

interface ReviewFormProps {
  hospitalId: string;
  hospitalName: string;
  hospitalAddress: string;
  userId: string;
  existingReview?: Review; // 수정 모드일 때 기존 리뷰
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * ReviewForm Component
 * 병원 리뷰 작성/수정 폼
 *
 * Features:
 * - 별점 선택 (1-5점)
 * - 댓글 작성 (10-500자)
 * - 실시간 유효성 검증
 * - 작성/수정 모드 지원
 */
export const ReviewForm: React.FC<ReviewFormProps> = ({
  hospitalId,
  hospitalName,
  hospitalAddress,
  userId,
  existingReview,
  onSuccess,
  onCancel,
}) => {
  const { themeMode } = useAppStore();
  const theme = themeMode === 'light' ? lightTheme : darkTheme;
  const isDark = themeMode === 'dark';

  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEditMode = !!existingReview;

  // 댓글 길이 검증
  const commentLength = comment.trim().length;
  const isCommentValid = commentLength >= 10 && commentLength <= 500;
  const isFormValid = rating > 0 && isCommentValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) {
      setError('별점을 선택하고 10자 이상 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      let result;

      if (isEditMode) {
        // 수정 모드
        result = await ReviewService.updateReview({
          reviewId: existingReview.id,
          rating,
          comment: comment.trim(),
        });
      } else {
        // 작성 모드
        result = await ReviewService.createReview({
          userId,
          hospitalId,
          hospitalName,
          hospitalAddress,
          rating,
          comment: comment.trim(),
        });
      }

      if (result.success) {
        alert(
          isEditMode
            ? '✅ 리뷰가 수정되었습니다.'
            : '✅ 리뷰가 작성되었습니다.'
        );
        onSuccess();
      } else {
        setError(result.error || '리뷰 저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('Review submit error:', err);
      setError('리뷰 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 별점 아이콘 렌더링
  const renderStars = () => {
    return (
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= (hoveredRating || rating);
          return (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              style={{
                fontSize: '40px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: isFilled ? theme.status.warning : (isDark ? theme.text.dim : '#D1D5DB'),
                transition: 'color 0.2s',
              }}
              aria-label={`${star}점`}
            >
              {isFilled ? '★' : '☆'}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        backgroundColor: theme.background.primary,
        borderRadius: '12px',
        padding: '24px',
        border: `1px solid ${theme.border.primary}`,
        transition: 'all 0.3s ease',
      }}
    >
      <h3
        style={{
          fontSize: '20px',
          fontWeight: '700',
          marginBottom: '8px',
          textAlign: 'center',
          color: theme.text.primary,
          transition: 'color 0.3s ease',
        }}
      >
        {isEditMode ? '리뷰 수정' : '리뷰 작성'}
      </h3>
      <p
        style={{
          fontSize: '14px',
          color: theme.text.secondary,
          marginBottom: '24px',
          textAlign: 'center',
          transition: 'color 0.3s ease',
        }}
      >
        {hospitalName}
      </p>

      <form onSubmit={handleSubmit}>
        {/* 별점 선택 */}
        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              fontSize: '14px',
              fontWeight: '600',
              display: 'block',
              marginBottom: '12px',
              textAlign: 'center',
            }}
          >
            별점을 선택하세요
          </label>
          {renderStars()}
          {rating > 0 && (
            <p
              style={{
                fontSize: '14px',
                color: theme.text.secondary,
                marginTop: '8px',
                textAlign: 'center',
                transition: 'color 0.3s ease',
              }}
            >
              {rating}점
            </p>
          )}
        </div>

        {/* 댓글 입력 */}
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="review-comment"
            style={{
              fontSize: '14px',
              fontWeight: '600',
              display: 'block',
              marginBottom: '8px',
              color: theme.text.primary,
              transition: 'color 0.3s ease',
            }}
          >
            리뷰 작성
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="병원 이용 경험을 자세히 작성해주세요. (최소 10자)"
            rows={6}
            maxLength={500}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              border: `1px solid ${theme.border.primary}`,
              backgroundColor: isDark ? theme.background.secondary : '#fff',
              color: theme.text.primary,
              borderRadius: '8px',
              resize: 'vertical',
              fontFamily: 'inherit',
              transition: 'all 0.3s ease',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '8px',
              fontSize: '12px',
            }}
          >
            <span
              style={{
                color:
                  commentLength < 10
                    ? '#EF4444'
                    : commentLength <= 500
                      ? '#10B981'
                      : '#EF4444',
              }}
            >
              {commentLength < 10
                ? `최소 10자 필요 (현재 ${commentLength}자)`
                : `${commentLength}/500자`}
            </span>
            {commentLength > 500 && (
              <span style={{ color: '#EF4444' }}>
                최대 500자까지 입력 가능합니다
              </span>
            )}
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: isDark ? 'rgba(255, 0, 61, 0.2)' : '#FEE2E2',
              borderRadius: '8px',
              marginBottom: '16px',
              transition: 'background-color 0.3s ease',
            }}
          >
            <p style={{ fontSize: '14px', color: isDark ? theme.status.critical : '#DC2626', margin: 0, transition: 'color 0.3s ease' }}>
              ⚠️ {error}
            </p>
          </div>
        )}

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: '14px',
              fontSize: '16px',
              fontWeight: '600',
              backgroundColor: isDark ? theme.background.secondary : '#F3F4F6',
              color: theme.text.primary,
              border: 'none',
              borderRadius: '8px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
              transition: 'all 0.3s ease',
            }}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            style={{
              flex: 1,
              padding: '14px',
              fontSize: '16px',
              fontWeight: '600',
              backgroundColor:
                !isFormValid || isSubmitting ? (isDark ? theme.border.primary : '#D1D5DB') : theme.status.info,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor:
                !isFormValid || isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            {isSubmitting
              ? '저장 중...'
              : isEditMode
                ? '수정 완료'
                : '리뷰 작성'}
          </button>
        </div>
      </form>
    </div>
  );
};
