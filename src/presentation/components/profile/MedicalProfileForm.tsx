import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../../infrastructure/state/store';
import { MedicalProfile, MedicalProfileService } from '../../../domain/services/MedicalProfileService';
import { EmergencyQRGenerator } from './EmergencyQRGenerator';

/**
 * MedicalProfileForm Component
 * 사용자의 의료 정보를 입력/수정하는 폼
 */
export const MedicalProfileForm: React.FC = () => {
  const { user, openLoginModal } = useAppStore();

  // 폼 상태
  const [bloodType, setBloodType] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [allergies, setAllergies] = useState('');
  const [chronicDiseases, setChronicDiseases] = useState('');
  const [medications, setMedications] = useState('');
  const [surgeries, setSurgeries] = useState('');
  const [emergencyContact1Name, setEmergencyContact1Name] = useState('');
  const [emergencyContact1Relationship, setEmergencyContact1Relationship] = useState('');
  const [emergencyContact1Phone, setEmergencyContact1Phone] = useState('');
  const [notes, setNotes] = useState('');

  // UI 상태
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showQRGenerator, setShowQRGenerator] = useState(false);

  // 컴포넌트 마운트 시 기존 프로필 로드
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);

      const { profile, error: loadError } = await MedicalProfileService.getMedicalProfile(user.id);

      if (loadError) {
        setError(`프로필 로드 실패: ${loadError}`);
      } else if (profile) {
        // 기존 데이터 폼에 채우기
        setBloodType(profile.bloodType || '');
        setHeight(profile.height?.toString() || '');
        setWeight(profile.weight?.toString() || '');
        setAllergies(profile.allergies?.join(', ') || '');
        setChronicDiseases(profile.chronicDiseases?.join(', ') || '');
        setMedications(profile.medications?.join(', ') || '');
        setSurgeries(profile.surgeries?.join(', ') || '');
        setNotes(profile.notes || '');

        if (profile.emergencyContacts && profile.emergencyContacts.length > 0) {
          const contact = profile.emergencyContacts[0];
          setEmergencyContact1Name(contact!.name);
          setEmergencyContact1Relationship(contact!.relationship);
          setEmergencyContact1Phone(contact!.phone);
        }
      }

      setLoading(false);
    };

    loadProfile();
  }, [user]);

  // 저장 핸들러
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      openLoginModal('의료 정보 저장');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    // 폼 데이터 → MedicalProfile 객체 변환
    const profile: MedicalProfile = {};

    if (bloodType) profile.bloodType = bloodType;
    if (height) profile.height = parseFloat(height);
    if (weight) profile.weight = parseFloat(weight);
    if (allergies) profile.allergies = allergies.split(',').map((s) => s.trim()).filter(Boolean);
    if (chronicDiseases) profile.chronicDiseases = chronicDiseases.split(',').map((s) => s.trim()).filter(Boolean);
    if (medications) profile.medications = medications.split(',').map((s) => s.trim()).filter(Boolean);
    if (surgeries) profile.surgeries = surgeries.split(',').map((s) => s.trim()).filter(Boolean);
    if (notes) profile.notes = notes;

    // 응급 연락처
    if (emergencyContact1Name && emergencyContact1Phone) {
      profile.emergencyContacts = [
        {
          name: emergencyContact1Name,
          relationship: emergencyContact1Relationship || '가족',
          phone: emergencyContact1Phone,
        },
      ];
    }

    // 저장
    const { success, error: saveError } = await MedicalProfileService.saveMedicalProfile(user.id, profile);

    if (success) {
      setSuccessMessage('✅ 의료 정보가 안전하게 저장되었습니다.');
    } else {
      setError(`저장 실패: ${saveError}`);
    }

    setSaving(false);
  };

  // 비로그인 상태
  if (!user) {
    return (
      <div style={{
        backgroundColor: '#FEF3C7',
        border: '2px solid #F59E0B',
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#92400E', margin: '0 0 8px' }}>
          🔒 로그인이 필요합니다
        </h3>
        <p style={{ fontSize: '14px', color: '#78350F', marginBottom: '16px' }}>
          의료 정보는 로그인한 본인만 저장·열람할 수 있습니다. 로그인해주세요.
        </p>
        <button
          onClick={() => openLoginModal('의료 정보')}
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
        <p style={{ fontSize: '16px', color: '#6B7280' }}>의료 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    }}>
      {/* 헤더 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 6px' }}>
            💊 의료 정보
          </h2>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, lineHeight: '1.4' }}>
            응급 상황 시 의료진에게 전달될 정보입니다.
          </p>
        </div>
        <button
          onClick={() => setShowQRGenerator(true)}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: '700',
            backgroundColor: '#FF3B30',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '100%',
            boxShadow: '0 2px 8px rgba(255, 59, 48, 0.3)',
          }}
        >
          🚨 응급 QR 생성
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div style={{
          backgroundColor: '#FEE2E2',
          color: '#991B1B',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '14px',
          marginBottom: '16px',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* 성공 메시지 */}
      {successMessage && (
        <div style={{
          backgroundColor: '#D1FAE5',
          color: '#065F46',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '14px',
          marginBottom: '16px',
        }}>
          {successMessage}
        </div>
      )}

      {/* 폼 */}
      <form onSubmit={handleSave}>
        {/* 기본 정보 */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>
            📋 기본 정보
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#6B7280', marginBottom: '4px' }}>
                혈액형
              </label>
              <select
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '2px solid #E5E7EB',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">선택</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#6B7280', marginBottom: '4px' }}>
                키 (cm)
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="170"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '2px solid #E5E7EB',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#6B7280', marginBottom: '4px' }}>
                몸무게 (kg)
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="70"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '2px solid #E5E7EB',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>

        {/* 알레르기 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#6B7280', marginBottom: '4px' }}>
            ⚠️ 알레르기 (쉼표로 구분)
          </label>
          <input
            type="text"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="예: 페니실린, 땅콩, 새우"
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '14px',
              border: '2px solid #E5E7EB',
              borderRadius: '6px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* 기저 질환 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#6B7280', marginBottom: '4px' }}>
            💊 기저 질환 (쉼표로 구분)
          </label>
          <input
            type="text"
            value={chronicDiseases}
            onChange={(e) => setChronicDiseases(e.target.value)}
            placeholder="예: 고혈압, 당뇨병"
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '14px',
              border: '2px solid #E5E7EB',
              borderRadius: '6px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* 복용 약물 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#6B7280', marginBottom: '4px' }}>
            💉 복용 중인 약물 (쉼표로 구분)
          </label>
          <input
            type="text"
            value={medications}
            onChange={(e) => setMedications(e.target.value)}
            placeholder="예: 아스피린 100mg, 메트포르민"
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '14px',
              border: '2px solid #E5E7EB',
              borderRadius: '6px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* 수술 이력 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#6B7280', marginBottom: '4px' }}>
            🏥 과거 수술 이력 (쉼표로 구분)
          </label>
          <input
            type="text"
            value={surgeries}
            onChange={(e) => setSurgeries(e.target.value)}
            placeholder="예: 2022-03-15 맹장 절제술"
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '14px',
              border: '2px solid #E5E7EB',
              borderRadius: '6px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* 응급 연락처 */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>
            📞 응급 연락처
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#6B7280', marginBottom: '4px' }}>
                이름
              </label>
              <input
                type="text"
                value={emergencyContact1Name}
                onChange={(e) => setEmergencyContact1Name(e.target.value)}
                placeholder="홍길동"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '2px solid #E5E7EB',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#6B7280', marginBottom: '4px' }}>
                관계
              </label>
              <input
                type="text"
                value={emergencyContact1Relationship}
                onChange={(e) => setEmergencyContact1Relationship(e.target.value)}
                placeholder="부모"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '2px solid #E5E7EB',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#6B7280', marginBottom: '4px' }}>
                전화번호
              </label>
              <input
                type="tel"
                value={emergencyContact1Phone}
                onChange={(e) => setEmergencyContact1Phone(e.target.value)}
                placeholder="010-1234-5678"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '2px solid #E5E7EB',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>

        {/* 추가 메모 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#6B7280', marginBottom: '4px' }}>
            📝 특이사항 (의료진에게 전달할 사항)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="예: 임신 중, 휠체어 사용, 의사소통 어려움 등"
            rows={3}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '14px',
              border: '2px solid #E5E7EB',
              borderRadius: '6px',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        {/* 저장 버튼 */}
        <button
          type="submit"
          disabled={saving}
          style={{
            width: '100%',
            padding: '13px',
            fontSize: '15px',
            fontWeight: '700',
            color: '#fff',
            backgroundColor: saving ? '#D1D5DB' : '#FF3B30',
            border: 'none',
            borderRadius: '8px',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? '저장 중...' : '💾 의료 정보 저장'}
        </button>
      </form>

      {/* 안내 */}
      <p style={{
        fontSize: '11px',
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: '12px',
        marginBottom: 0,
        lineHeight: '1.4',
      }}>
        🔐 의료 정보는 로그인한 본인만 열람할 수 있습니다
      </p>

      {/* 응급 QR 생성 모달 */}
      {showQRGenerator && <EmergencyQRGenerator onClose={() => setShowQRGenerator(false)} />}
    </div>
  );
};
