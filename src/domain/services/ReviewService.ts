import {
  supabase,
  supabaseOptionalFeaturesEnabled,
} from '../../infrastructure/supabase/supabaseClient';

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

const unavailableError = 'Supabase optional features are temporarily unavailable';

/**
 * ReviewService
 * 병원 리뷰 CRUD 및 통계 조회
 */
export class ReviewService {
  static async getHospitalReviews(hospitalId: string): Promise<{
    success: boolean;
    reviews: Review[];
    error?: string;
  }> {
    if (!supabaseOptionalFeaturesEnabled) {
      return { success: false, reviews: [], error: unavailableError };
    }

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false });

      if (error) return { success: false, reviews: [], error: error.message };
      return { success: true, reviews: data || [] };
    } catch {
      return { success: false, reviews: [], error: 'Failed to load reviews' };
    }
  }

  static async getUserReviews(userId: string): Promise<{
    success: boolean;
    reviews: Review[];
    error?: string;
  }> {
    if (!supabaseOptionalFeaturesEnabled) {
      return { success: false, reviews: [], error: unavailableError };
    }

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) return { success: false, reviews: [], error: error.message };
      return { success: true, reviews: data || [] };
    } catch {
      return { success: false, reviews: [], error: 'Failed to load your reviews' };
    }
  }

  static async createReview(
    request: CreateReviewRequest
  ): Promise<{ success: boolean; error?: string; review?: Review }> {
    const { userId, hospitalId, hospitalName, hospitalAddress, rating, comment } = request;

    if (rating < 1 || rating > 5) {
      return { success: false, error: 'Rating must be between 1 and 5' };
    }
    if (comment.trim().length < 10) {
      return { success: false, error: 'Review comment must be at least 10 characters' };
    }
    if (comment.length > 500) {
      return { success: false, error: 'Review comment must be less than 500 characters' };
    }
    if (!supabaseOptionalFeaturesEnabled) {
      return { success: false, error: unavailableError };
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
        if (error.code === '23505') {
          return { success: false, error: 'You have already reviewed this hospital' };
        }
        return { success: false, error: error.message };
      }

      return { success: true, review: data };
    } catch {
      return { success: false, error: 'Failed to create review' };
    }
  }

  static async updateReview(
    request: UpdateReviewRequest
  ): Promise<{ success: boolean; error?: string; review?: Review }> {
    const { reviewId, rating, comment } = request;

    if (rating < 1 || rating > 5) {
      return { success: false, error: 'Rating must be between 1 and 5' };
    }
    if (comment.trim().length < 10) {
      return { success: false, error: 'Review comment must be at least 10 characters' };
    }
    if (comment.length > 500) {
      return { success: false, error: 'Review comment must be less than 500 characters' };
    }
    if (!supabaseOptionalFeaturesEnabled) {
      return { success: false, error: unavailableError };
    }

    try {
      const { data, error } = await supabase
        .from('reviews')
        .update({ rating, comment: comment.trim() })
        .eq('id', reviewId)
        .select()
        .single();

      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: 'Review not found or you do not have permission' };
      return { success: true, review: data };
    } catch {
      return { success: false, error: 'Failed to update review' };
    }
  }

  static async deleteReview(reviewId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabaseOptionalFeaturesEnabled) {
      return { success: false, error: unavailableError };
    }

    try {
      const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to delete review' };
    }
  }

  static async getHospitalRatingStats(
    hospitalId: string
  ): Promise<{
    success: boolean;
    stats: HospitalRatingStats;
    error?: string;
  }> {
    if (!supabaseOptionalFeaturesEnabled) {
      return {
        success: true,
        stats: { hospitalId, averageRating: 0, totalReviews: 0 },
      };
    }

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('rating')
        .eq('hospital_id', hospitalId);

      if (error) {
        return {
          success: false,
          stats: { hospitalId, averageRating: 0, totalReviews: 0 },
          error: error.message,
        };
      }

      if (!data || data.length === 0) {
        return {
          success: true,
          stats: { hospitalId, averageRating: 0, totalReviews: 0 },
        };
      }

      const totalReviews = data.length;
      const sumRating = data.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = Math.round((sumRating / totalReviews) * 10) / 10;

      return {
        success: true,
        stats: { hospitalId, averageRating, totalReviews },
      };
    } catch {
      return {
        success: false,
        stats: { hospitalId, averageRating: 0, totalReviews: 0 },
        error: 'Failed to load rating statistics',
      };
    }
  }

  static async hasUserReviewedHospital(
    userId: string,
    hospitalId: string
  ): Promise<{ success: boolean; hasReviewed: boolean; review?: Review }> {
    if (!supabaseOptionalFeaturesEnabled) {
      return { success: false, hasReviewed: false };
    }

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('hospital_id', hospitalId)
        .maybeSingle();

      if (error) return { success: false, hasReviewed: false };
      return { success: true, hasReviewed: !!data, review: data || undefined };
    } catch {
      return { success: false, hasReviewed: false };
    }
  }
}
