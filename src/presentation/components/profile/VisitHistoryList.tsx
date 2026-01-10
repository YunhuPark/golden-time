import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../../infrastructure/state/store';
import {
  VisitHistory,
  VisitStatistics,
  VisitHistoryService,
} from '../../../domain/services/VisitHistoryService';

/**
 * VisitHistoryList Component
 * 병원 방문 기록 목록 및 통계
 */
export const VisitHistoryList: React.FC = () => {
  const { user, openLoginModal } = useAppStore();

  // 상태
  const [visits, setVisits] = useState<VisitHistory[]>([]);
  const [statistics, setStatistics] = useState<VisitStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 모달 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [visitReason, setVisitReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      // 방문 기록 조회
      const { visits: fetchedVisits, error: visitsError } =
        await VisitHistoryService.getVisitHistory(user.id);

      if (visitsError) {
        setError(`방문 기록 로드 실패: ${visitsError}`);
      } else {
        setVisits(fetchedVisits);
      }

      // 통계 조회
      const { statistics: fetchedStats, error: statsError } =
        await VisitHistoryService.getVisitStatistics(user.id);

      if (statsError) {
        setError(`통계 로드 실패: ${statsError}`);
      } else {
        setStatistics(fetchedStats);
      }

      setLoading(false);
    };

    loadData();
  }, [user]);

  // 수동 방문 기록 추가 핸들러
  const handleManualAdd = async () => {
    if (!user) return;
    if (!hospitalName.trim() || !hospitalAddress.trim()) {
      alert('병원 이름과 주소를 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const { success, error: addError } = await VisitHistoryService.addVisit({
        userId: user.id,
        hospitalId: `manual_${Date.now()}`, // 수동 입력이므로 임시 ID
        hospitalName: hospitalName.trim(),
        hospitalAddress: hospitalAddress.trim(),
        visitDate: visitDate ? new Date(visitDate) : new Date(),
        visitReason: visitReason.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (success) {
        alert('✅ 방문 기록이 추가되었습니다!');
        setShowAddModal(false);
        // 폼 초기화
        setHospitalName('');
        setHospitalAddress('');
        setVisitDate('');
        setVisitReason('');
        setNotes('');
        // 데이터 새로고침
        window.location.reload();
      } else {
        throw new Error(addError);
      }
    } catch (err) {
      console.error('Failed to add visit:', err);
      alert('방문 기록 추가 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
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
          병원 방문 기록을 보려면 로그인해주세요.
        </p>
        <button
          onClick={() => openLoginModal('방문 기록')}
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
          방문 기록을 불러오는 중...
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

  // 방문 기록 없음
  if (visits.length === 0) {
    return (
      <>
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
            📚 방문 기록이 없습니다
          </h3>
          <p style={{ fontSize: '14px', color: '#9CA3AF', marginBottom: '16px' }}>
            병원 전화 후 방문 기록이 자동으로 제안되거나, 직접 추가할 수 있습니다.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: '600',
              backgroundColor: '#007AFF',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            + 방문 기록 추가
          </button>
        </div>

        {/* 수동 추가 모달 (방문 기록 없을 때도 표시) */}
        {showAddModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              padding: '16px',
            }}
            onClick={() => setShowAddModal(false)}
          >
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '16px',
                padding: '24px',
                maxWidth: '500px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#111827',
                  margin: '0 0 16px',
                }}
              >
                📝 방문 기록 수동 추가
              </h3>

              {/* 병원 이름 */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '8px',
                  }}
                >
                  병원 이름 <span style={{ color: '#FF3B30' }}>*</span>
                </label>
                <input
                  type="text"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="예: 서울대학교병원"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '15px',
                    border: '2px solid #E5E7EB',
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* 병원 주소 */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '8px',
                  }}
                >
                  병원 주소 <span style={{ color: '#FF3B30' }}>*</span>
                </label>
                <input
                  type="text"
                  value={hospitalAddress}
                  onChange={(e) => setHospitalAddress(e.target.value)}
                  placeholder="예: 서울시 종로구 대학로 101"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '15px',
                    border: '2px solid #E5E7EB',
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* 방문 날짜 */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '8px',
                  }}
                >
                  방문 날짜 (선택사항)
                </label>
                <input
                  type="datetime-local"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '15px',
                    border: '2px solid #E5E7EB',
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* 방문 사유 */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '8px',
                  }}
                >
                  방문 사유 (선택사항)
                </label>
                <input
                  type="text"
                  value={visitReason}
                  onChange={(e) => setVisitReason(e.target.value)}
                  placeholder="예: 급성 복통"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '15px',
                    border: '2px solid #E5E7EB',
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* 메모 */}
              <div style={{ marginBottom: '24px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '8px',
                  }}
                >
                  메모 (선택사항)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="예: 충수염 의심, 약 처방받음"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '15px',
                    border: '2px solid #E5E7EB',
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* 버튼 */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '14px',
                    fontSize: '16px',
                    fontWeight: '600',
                    backgroundColor: '#F3F4F6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleManualAdd}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '14px',
                    fontSize: '16px',
                    fontWeight: '600',
                    backgroundColor: saving ? '#ccc' : '#007AFF',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
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
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2
            style={{
              fontSize: '22px',
              fontWeight: '700',
              color: '#111827',
              margin: '0 0 8px',
            }}
          >
            📚 병원 방문 기록
          </h2>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
            과거에 방문했던 병원들의 기록입니다.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '12px 20px',
            fontSize: '15px',
            fontWeight: '600',
            backgroundColor: '#007AFF',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          + 수동 추가
        </button>
      </div>

      {/* 통계 */}
      {statistics && (
        <div
          style={{
            backgroundColor: '#EFF6FF',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <h3
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1E40AF',
              margin: '0 0 12px',
            }}
          >
            📊 통계
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '12px',
            }}
          >
            <div>
              <p
                style={{
                  fontSize: '12px',
                  color: '#6B7280',
                  margin: '0 0 4px',
                }}
              >
                총 방문 횟수
              </p>
              <p
                style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1E40AF',
                  margin: 0,
                }}
              >
                {statistics.totalVisits}회
              </p>
            </div>
            <div>
              <p
                style={{
                  fontSize: '12px',
                  color: '#6B7280',
                  margin: '0 0 4px',
                }}
              >
                방문한 병원
              </p>
              <p
                style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1E40AF',
                  margin: 0,
                }}
              >
                {statistics.uniqueHospitals}곳
              </p>
            </div>
            <div>
              <p
                style={{
                  fontSize: '12px',
                  color: '#6B7280',
                  margin: '0 0 4px',
                }}
              >
                가장 많이 방문
              </p>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#1E40AF',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {statistics.mostVisitedHospital
                  ? `${statistics.mostVisitedHospital.hospitalName} (${statistics.mostVisitedHospital.visitCount}회)`
                  : '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 방문 기록 목록 */}
      <div>
        <h3
          style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#374151',
            margin: '0 0 12px',
          }}
        >
          최근 방문 기록
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {visits.map((visit) => (
            <div
              key={visit.id}
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
                  marginBottom: '8px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <h4
                    style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#111827',
                      margin: '0 0 4px',
                    }}
                  >
                    {visit.hospitalName}
                  </h4>
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#6B7280',
                      margin: '0 0 8px',
                    }}
                  >
                    📍 {visit.hospitalAddress}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                      margin: '0 0 2px',
                    }}
                  >
                    {visit.visitDate.toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#9CA3AF',
                      margin: 0,
                    }}
                  >
                    {visit.visitDate.toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {/* 방문 사유 */}
              {visit.visitReason && (
                <div
                  style={{
                    backgroundColor: '#FEF3C7',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    marginBottom: '8px',
                  }}
                >
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#78350F',
                      margin: 0,
                    }}
                  >
                    💬 사유: {visit.visitReason}
                  </p>
                </div>
              )}

              {/* 메모 */}
              {visit.notes && (
                <div
                  style={{
                    backgroundColor: '#E0F2FE',
                    borderRadius: '6px',
                    padding: '8px 12px',
                  }}
                >
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#075985',
                      margin: 0,
                    }}
                  >
                    📝 메모: {visit.notes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
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
        💡 길찾기 후 병원 근처(100m)에 도착하면 자동으로 방문 기록 제안이 나타나거나, 직접 "+ 수동 추가" 버튼으로 기록할 수 있습니다
      </p>

      {/* 수동 추가 모달 */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#111827',
                margin: '0 0 16px',
              }}
            >
              📝 방문 기록 수동 추가
            </h3>

            {/* 병원 이름 */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px',
                }}
              >
                병원 이름 <span style={{ color: '#FF3B30' }}>*</span>
              </label>
              <input
                type="text"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                placeholder="예: 서울대학교병원"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '15px',
                  border: '2px solid #E5E7EB',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 병원 주소 */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px',
                }}
              >
                병원 주소 <span style={{ color: '#FF3B30' }}>*</span>
              </label>
              <input
                type="text"
                value={hospitalAddress}
                onChange={(e) => setHospitalAddress(e.target.value)}
                placeholder="예: 서울시 종로구 대학로 101"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '15px',
                  border: '2px solid #E5E7EB',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 방문 날짜 */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px',
                }}
              >
                방문 날짜 (선택사항)
              </label>
              <input
                type="datetime-local"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '15px',
                  border: '2px solid #E5E7EB',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 방문 사유 */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px',
                }}
              >
                방문 사유 (선택사항)
              </label>
              <input
                type="text"
                value={visitReason}
                onChange={(e) => setVisitReason(e.target.value)}
                placeholder="예: 급성 복통"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '15px',
                  border: '2px solid #E5E7EB',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 메모 */}
            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px',
                }}
              >
                메모 (선택사항)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="예: 충수염 의심, 약 처방받음"
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '15px',
                  border: '2px solid #E5E7EB',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* 버튼 */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowAddModal(false)}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: '600',
                  backgroundColor: '#F3F4F6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                취소
              </button>
              <button
                onClick={handleManualAdd}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: '600',
                  backgroundColor: saving ? '#ccc' : '#007AFF',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
