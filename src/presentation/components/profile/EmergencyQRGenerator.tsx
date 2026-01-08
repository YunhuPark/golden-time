import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAppStore } from '../../../infrastructure/state/store';
import { EmergencyShareService, EmergencyShareData } from '../../../domain/services/EmergencyShareService';
import { MedicalProfileService } from '../../../domain/services/MedicalProfileService';

interface EmergencyQRGeneratorProps {
  onClose: () => void;
}

/**
 * EmergencyQRGenerator Component
 * 응급 QR 코드 생성 및 공유
 */
export const EmergencyQRGenerator: React.FC<EmergencyQRGeneratorProps> = ({ onClose }) => {
  const { user } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // QR 코드 생성
  const handleGenerateQR = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // 1. 의료 정보 로드
      const { profile, error: loadError } = await MedicalProfileService.getProfile(user.id);

      if (loadError || !profile) {
        setError('의료 정보를 불러올 수 없습니다. 먼저 의료 정보를 입력해주세요.');
        setLoading(false);
        return;
      }

      // 2. 응급 공유 데이터 생성 (MedicalProfile 그대로 사용)
      const emergencyData: EmergencyShareData = profile;

      // 3. 공유 토큰 생성
      const { success, shareToken: token, error: createError } = await EmergencyShareService.createShare(
        user.id,
        emergencyData
      );

      if (!success || !token) {
        setError(createError || '응급 QR 생성에 실패했습니다.');
        setLoading(false);
        return;
      }

      setShareToken(token);
    } catch (err) {
      console.error('Failed to generate emergency QR:', err);
      setError('응급 QR 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // QR 코드 다운로드
  const handleDownloadQR = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    // SVG를 Canvas로 변환
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `emergency-qr-${Date.now()}.png`;
        link.click();
        URL.revokeObjectURL(downloadUrl);
      });

      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  // 카카오톡 공유
  const handleShareKakao = () => {
    if (!shareToken) return;

    const shareUrl = `${window.location.origin}/emergency/${shareToken}`;

    // 카카오톡 공유 (Web Share API 사용)
    if (navigator.share) {
      navigator.share({
        title: '응급 의료 정보',
        text: '응급 상황을 위한 나의 의료 정보입니다. QR 코드를 스캔하거나 링크를 열어주세요.',
        url: shareUrl,
      }).catch((err) => console.error('Share failed:', err));
    } else {
      // Fallback: URL 복사
      navigator.clipboard.writeText(shareUrl);
      alert('📋 링크가 복사되었습니다!\n카카오톡에 붙여넣기 하세요.');
    }
  };

  // URL 복사
  const handleCopyUrl = () => {
    if (!shareToken) return;
    const shareUrl = `${window.location.origin}/emergency/${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    alert('📋 링크가 복사되었습니다!');
  };

  const shareUrl = shareToken ? `${window.location.origin}/emergency/${shareToken}` : '';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '24px',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <h2
          style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#FF3B30',
            margin: '0 0 8px',
          }}
        >
          🚨 응급 QR 코드
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: '#6B7280',
            marginBottom: '24px',
          }}
        >
          의료진에게 빠르게 정보를 전달하세요
        </p>

        {/* 에러 메시지 */}
        {error && (
          <div
            style={{
              backgroundColor: '#FEE2E2',
              border: '2px solid #EF4444',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
            }}
          >
            <p style={{ margin: 0, color: '#991B1B', fontSize: '14px' }}>
              ⚠️ {error}
            </p>
          </div>
        )}

        {/* QR 코드 미생성 상태 */}
        {!shareToken && (
          <>
            <div
              style={{
                backgroundColor: '#FEF3C7',
                border: '2px solid #F59E0B',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '24px',
              }}
            >
              <p style={{ fontSize: '15px', color: '#92400E', margin: '0 0 16px', lineHeight: '1.6' }}>
                <strong>주의사항:</strong><br />
                • QR 코드는 24시간 후 자동으로 만료됩니다<br />
                • 응급 상황 종료 후 즉시 삭제하세요<br />
                • 소셜미디어에 공유하지 마세요
              </p>
            </div>

            <button
              onClick={handleGenerateQR}
              disabled={loading}
              style={{
                width: '100%',
                padding: '18px',
                fontSize: '18px',
                fontWeight: '700',
                backgroundColor: loading ? '#ccc' : '#FF3B30',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(255, 59, 48, 0.3)',
                marginBottom: '16px',
              }}
            >
              {loading ? '생성 중...' : '🚨 응급 QR 생성'}
            </button>
          </>
        )}

        {/* QR 코드 생성 완료 */}
        {shareToken && (
          <>
            {/* QR 코드 표시 */}
            <div
              ref={qrRef}
              style={{
                backgroundColor: '#F9FAFB',
                padding: '24px',
                borderRadius: '16px',
                marginBottom: '24px',
                display: 'inline-block',
              }}
            >
              <QRCodeSVG
                value={shareUrl}
                size={256}
                level="H"
                includeMargin={true}
                fgColor="#000000"
                bgColor="#FFFFFF"
              />
            </div>

            <p
              style={{
                fontSize: '12px',
                color: '#9CA3AF',
                marginBottom: '24px',
              }}
            >
              의료진이 위 QR 코드를 스캔하면<br />
              나의 의료 정보를 즉시 확인할 수 있습니다
            </p>

            {/* 공유 버튼들 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <button
                onClick={handleDownloadQR}
                style={{
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: '600',
                  backgroundColor: '#007AFF',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                }}
              >
                📥 QR 코드 다운로드
              </button>

              <button
                onClick={handleShareKakao}
                style={{
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: '600',
                  backgroundColor: '#FEE500',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                }}
              >
                💬 카카오톡으로 공유
              </button>

              <button
                onClick={handleCopyUrl}
                style={{
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: '600',
                  backgroundColor: '#F3F4F6',
                  color: '#374151',
                  border: '2px solid #E5E7EB',
                  borderRadius: '10px',
                  cursor: 'pointer',
                }}
              >
                📋 링크 복사
              </button>
            </div>

            <p
              style={{
                fontSize: '12px',
                color: '#EF4444',
                fontWeight: '600',
                marginBottom: '16px',
              }}
            >
              ⏱️ 24시간 후 자동 만료됩니다
            </p>
          </>
        )}

        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '16px',
            fontWeight: '600',
            backgroundColor: '#F3F4F6',
            color: '#374151',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
};
