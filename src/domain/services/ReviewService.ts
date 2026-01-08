import { supabase } from '../../infrastructure/supabase/supabaseClient';

/**
 * Review 데이터 타입
 */
export interface Review {
  id: string;
  user_id: string;
  hospital_id: string;
  hospital_name: string;
  hospital_address: string;
  rating: number; // 1-5
  comment: string;
  created_at: string;
}

/**
 * Review 생성 요청
 */
export interface CreateReviewRequest {
  userId: string;
  hospitalId: string;
  hospitalName: string;
  hospitalAddress: string;
  rating: number;
  comment: string;
}

/**
 * Review 수정 요청
 */
export interface UpdateReviewRequest {
  reviewId: string;
  rating: number;
  comment: string;
}

/**
 * 병원 평균 별점 정보
 */
export interface HospitalRatingStats {
  hospitalId: string;
  averageRating: number; // 평균 별점 (소수점 1자리)
  totalReviews: number; // 총 리뷰 개수
}

/**
 * ReviewService
 * 병원 리뷰 CRUD 및 통계 조회
 *
 * Ironclad Law #3: Edge Case Obsession
 * - 사용자 인증 상태 확인
 * - 중복 리뷰 방지 (한 사용자당 병원 하나당 리뷰 1개)
 * - 별점 범위 검증 (1-5)
 */
export class ReviewService {
  /**
   * 특정 병원의 모든 리뷰 조회 (최신순)
   */
  static async getHospitalReviews(hospitalId: string): Promise<{
    success: boolean;
    reviews: Review[];
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch reviews:', error);
        return { success: false, reviews: [], error: error.message };
      }

      return { success: true, reviews: data || [] };
    } catch (error) {
      console.error('Get hospital reviews error:', error);
      return {
        success: false,
        reviews: [],
        error: 'Failed to load reviews',
      };
    }
  }

  /**
   * 특정 사용자의 모든 리뷰 조회 (최신순)
   */
  static async getUserReviews(userId: string): Promise<{
    success: boolean;
    reviews: Review[];
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch user reviews:', error);
        return { success: false, reviews: [], error: error.message };
      }

      return { success: true, reviews: data || [] };
    } catch (error) {
      console.error('Get user reviews error:', error);
      return {
        success: false,
        reviews: [],
        error: 'Failed to load your reviews',
      };
    }
  }

  /**
   * 리뷰 작성
   *
   * Edge Cases:
   * - 별점 범위 검증 (1-5)
   * - 댓글 길이 검증
   * - 중복 리뷰 방지 (DB UNIQUE 제약조건)
   */
  static async createReview(
    request: CreateReviewRequest
  ): Promise<{ success: boolean; error?: string; review?: Review }> {
    const { userId, hospitalId, hospitalName, hospitalAddress, rating, comment } = request;

    // Edge Case 1: 별점 범위 검증
    if (rating < 1 || rating > 5) {
      return { success: false, error: 'Rating must be between 1 and 5' };
    }

    // Edge Case 2: 댓글 최소 길이 검증
    if (comment.trim().length < 10) {
      return {
        success: false,
        error: 'Review comment must be at least 10 characters',
      };
    }

    // Edge Case 3: 댓글 최대 길이 검증
    if (comment.length > 500) {
      return {
        success: false,
        error: 'Review comment must be less than 500 characters',
      };
    }

    try {
      const { data, error } = await supabase
        .from('reviews')
        .insert({
          user_id: userId,
          hospital_id: hospitalId,
          hospital_name: hospitalName,
          hospital_address: hospitalAddress,
          rating,
          comment: comment.trim(),
        })
        .select()
        .single();

      if (error) {
        // Edge Case 4: 중복 리뷰 (UNIQUE 제약조건 위반)
        if (error.code === '23505') {
          return {
            success: false,
            error: 'You have already reviewed this hospital',
          };
        }

        console.error('Failed to create review:', error);
        return { success: false, error: error.message };
      }

      return { success: true, review: data };
    } catch (error) {
      console.error('Create review error:', error);
      return { success: false, error: 'Failed to create review' };
    }
  }

  /**
   * 리뷰 수정
   *
   * Edge Cases:
   * - 본인 리뷰만 수정 가능 (RLS로 보장)
   * - 별점 범위 검증
   * - 댓글 길이 검증
   */
  static async updateReview(
    request: UpdateReviewRequest
  ): Promise<{ success: boolean; error?: string; review?: Review }> {
    const { reviewId, rating, comment } = request;

    // Edge Case 1: 별점 범위 검증
    if (rating < 1 || rating > 5) {
      return { success: false, error: 'Rating must be between 1 and 5' };
    }

    // Edge Case 2: 댓글 최소 길이 검증
    if (comment.trim().length < 10) {
      return {
        success: false,
        error: 'Review comment must be at least 10 characters',
      };
    }

    // Edge Case 3: 댓글 최대 길이 검증
    if (comment.length > 500) {
      return {
        success: false,
        error: 'Review comment must be less than 500 characters',
      };
    }

    try {
      const { data, error } = await supabase
        .from('reviews')
        .update({
          rating,
          comment: comment.trim(),
        })
        .eq('id', reviewId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update review:', error);
        return { success: false, error: error.message };
      }

      // Edge Case 4: 리뷰가 없거나 권한 없음 (RLS)
      if (!data) {
        return {
          success: false,
          error: 'Review not found or you do not have permission',
        };
      }

      return { success: true, review: data };
    } catch (error) {
      console.error('Update review error:', error);
      return { success: false, error: 'Failed to update review' };
    }
  }

  /**
   * 리뷰 삭제
   *
   * Edge Cases:
   * - 본인 리뷰만 삭제 가능 (RLS로 보장)
   */
  static async deleteReview(
    reviewId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (error) {
        console.error('Failed to delete review:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Delete review error:', error);
      return { success: false, error: 'Failed to delete review' };
    }
  }

  /**
   * 병원 평균 별점 및 리뷰 개수 조회
   *
   * Edge Cases:
   * - 리뷰가 없는 경우 (averageRating: 0, totalReviews: 0)
   */
  static async getHospitalRatingStats(
    hospitalId: string
  ): Promise<{
    success: boolean;
    stats: HospitalRatingStats;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('rating')
        .eq('hospital_id', hospitalId);

      if (error) {
        console.error('Failed to fetch rating stats:', error);
        return {
          success: false,
          stats: { hospitalId, averageRating: 0, totalReviews: 0 },
          error: error.message,
        };
      }

      // Edge Case: 리뷰가 없는 경우
      if (!data || data.length === 0) {
        return {
          success: true,
          stats: { hospitalId, averageRating: 0, totalReviews: 0 },
        };
      }

      const totalReviews = data.length;
      const sumRating = data.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = Math.round((sumRating / totalReviews) * 10) / 10; // 소수점 1자리

      return {
        success: true,
        stats: { hospitalId, averageRating, totalReviews },
      };
    } catch (error) {
      console.error('Get rating stats error:', error);
      return {
        success: false,
        stats: { hospitalId, averageRating: 0, totalReviews: 0 },
        error: 'Failed to load rating statistics',
      };
    }
  }

  /**
   * 사용자가 특정 병원에 리뷰를 작성했는지 확인
   */
  static async hasUserReviewedHospital(
    userId: string,
    hospitalId: string
  ): Promise<{ success: boolean; hasReviewed: boolean; review?: Review }> {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('hospital_id', hospitalId)
        .maybeSingle();

      if (error) {
        console.error('Failed to check user review:', error);
        return { success: false, hasReviewed: false };
      }

      return {
        success: true,
        hasReviewed: !!data,
        review: data || undefined,
      };
    } catch (error) {
      console.error('Check user review error:', error);
      return { success: false, hasReviewed: false };
    }
  }
}
