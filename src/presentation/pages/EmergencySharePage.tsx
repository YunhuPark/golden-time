import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { EmergencyShareService, EmergencyShare } from '../../domain/services/EmergencyShareService';

/**
 * EmergencySharePage Component
 * QR 코드 스캔 후 의료 정보 표시
 */
export const EmergencySharePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState<EmergencyShare | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('유효하지 않은 링크입니다.');
      setLoading(false);
      return;
    }

    const loadShare = async () => {
      setLoading(true);
      setError(null);

      const { success, data, error: loadError } = await EmergencyShareService.getShareByToken(token);

      if (!success || !data) {
        setError(loadError || '의료 정보를 불러올 수 없습니다. 링크가 만료되었거나 유효하지 않습니다.');
      } else {
        setShare(data);
      }

      setLoading(false);
    };

    loadShare();
  }, [token]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F9FAFB',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏥</div>
          <p style={{ fontSize: '18px', color: '#6B7280' }}>의료 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !share) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F9FAFB',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '500px',
            backgroundColor: '#FEE2E2',
            border: '2px solid #EF4444',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚠️</div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#991B1B',
              margin: '0 0 12px',
            }}
          >
            정보를 불러올 수 없습니다
          </h2>
          <p style={{ fontSize: '16px', color: '#7F1D1D', margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  const { medicalData, expiresAt, viewCount } = share;
  const expiryDate = new Date(expiresAt);
  const isExpiringSoon = expiryDate.getTime() - Date.now() < 3600000; // 1시간 이내

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F9FAFB',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* 헤더 */}
        <div
          style={{
            backgroundColor: '#FF3B30',
            color: '#fff',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🚨</div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', margin: '0 0 8px' }}>응급 의료 정보</h1>
          <p style={{ fontSize: '16px', opacity: 0.9, margin: 0 }}>
            환자의 중요한 의료 정보입니다
          </p>
        </div>

        {/* 만료 경고 */}
        {isExpiringSoon && (
          <div
            style={{
              backgroundColor: '#FEF3C7',
              border: '2px solid #F59E0B',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '14px', color: '#92400E', margin: 0, fontWeight: '600' }}>
              ⏱️ 이 정보는 {expiryDate.toLocaleString()}에 만료됩니다
            </p>
          </div>
        )}

        {/* 기본 정보 */}
        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}
        >
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 20px' }}>
            📋 기본 정보
          </h2>

          {medicalData.bloodType && (
            <InfoRow label="혈액형" value={medicalData.bloodType} highlight />
          )}

          {medicalData.height && (
            <InfoRow label="키" value={`${medicalData.height} cm`} />
          )}

          {medicalData.weight && (
            <InfoRow label="몸무게" value={`${medicalData.weight} kg`} />
          )}
        </div>

        {/* 알레르기 */}
        {medicalData.allergies && medicalData.allergies.length > 0 && (
          <div
            style={{
              backgroundColor: '#FEE2E2',
              border: '3px solid #EF4444',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '16px',
            }}
          >
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#991B1B', margin: '0 0 16px' }}>
              ⚠️ 알레르기 (중요!)
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {medicalData.allergies.map((allergy, index) => (
                <span
                  key={index}
                  style={{
                    backgroundColor: '#DC2626',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '15px',
                    fontWeight: '600',
                  }}
                >
                  {allergy}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 기저 질환 */}
        {medicalData.chronicDiseases && medicalData.chronicDiseases.length > 0 && (
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 16px' }}>
              🏥 기저 질환
            </h2>
            <ul style={{ margin: 0, paddingLeft: '24px' }}>
              {medicalData.chronicDiseases.map((disease, index) => (
                <li
                  key={index}
                  style={{
                    fontSize: '16px',
                    color: '#374151',
                    marginBottom: '8px',
                    lineHeight: '1.6',
                  }}
                >
                  {disease}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 현재 복용 약물 */}
        {medicalData.medications && medicalData.medications.length > 0 && (
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 16px' }}>
              💊 복용 중인 약물
            </h2>
            <ul style={{ margin: 0, paddingLeft: '24px' }}>
              {medicalData.medications.map((med, index) => (
                <li
                  key={index}
                  style={{
                    fontSize: '16px',
                    color: '#374151',
                    marginBottom: '8px',
                    lineHeight: '1.6',
                  }}
                >
                  {med}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 수술 이력 */}
        {medicalData.surgeries && medicalData.surgeries.length > 0 && (
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 16px' }}>
              🔪 과거 수술 이력
            </h2>
            <ul style={{ margin: 0, paddingLeft: '24px' }}>
              {medicalData.surgeries.map((surgery, index) => (
                <li
                  key={index}
                  style={{
                    fontSize: '16px',
                    color: '#374151',
                    marginBottom: '8px',
                    lineHeight: '1.6',
                  }}
                >
                  {surgery}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 응급 연락처 */}
        {medicalData.emergencyContacts && medicalData.emergencyContacts.length > 0 && (
          <div
            style={{
              backgroundColor: '#DBEAFE',
              border: '2px solid #3B82F6',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '16px',
            }}
          >
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1E40AF', margin: '0 0 16px' }}>
              📞 응급 연락처
            </h2>
            {medicalData.emergencyContacts.map((contact, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: index < medicalData.emergencyContacts!.length - 1 ? '12px' : 0,
                }}
              >
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                  {contact.name} ({contact.relationship})
                </div>
                <a
                  href={`tel:${contact.phone}`}
                  style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#3B82F6',
                    textDecoration: 'none',
                  }}
                >
                  📱 {contact.phone}
                </a>
              </div>
            ))}
          </div>
        )}

        {/* 추가 메모 */}
        {medicalData.notes && (
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 16px' }}>
              📝 특이사항
            </h2>
            <p style={{ fontSize: '16px', color: '#374151', margin: 0, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {medicalData.notes}
            </p>
          </div>
        )}

        {/* 푸터 */}
        <div
          style={{
            backgroundColor: '#F3F4F6',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 8px' }}>
            🔐 이 정보는 응급 상황을 위해 공유되었습니다
          </p>
          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
            조회 횟수: {viewCount + 1}회 | 만료: {expiryDate.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * InfoRow Component
 * 정보 행 표시
 */
interface InfoRowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, highlight }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 16px',
      backgroundColor: highlight ? '#FEF3C7' : '#F9FAFB',
      borderRadius: '8px',
      marginBottom: '8px',
    }}
  >
    <span style={{ fontSize: '15px', color: '#6B7280', fontWeight: '500' }}>{label}</span>
    <span
      style={{
        fontSize: '16px',
        color: highlight ? '#92400E' : '#111827',
        fontWeight: highlight ? '700' : '600',
      }}
    >
      {value}
    </span>
  </div>
);
