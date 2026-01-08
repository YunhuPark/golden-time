import React from 'react';
import { useAppStore } from '../../../infrastructure/state/store';
import { cn } from '../../../lib/utils';
import { GeolocationError } from '../../hooks/useGeolocation';

interface LocationPermissionPromptProps {
  error: GeolocationError;
  onRetry: () => void;
}

/**
 * LocationPermissionPrompt Component
 * 위치 정보 권한 거부 시 표시되는 안내 및 유도 UI
 */
export const LocationPermissionPrompt: React.FC<LocationPermissionPromptProps> = ({
  error,
  onRetry,
}) => {
  const { themeMode } = useAppStore();
  const isDark = themeMode === 'dark';

  // 에러 타입별 메시지 및 액션 가이드
  const getErrorContent = () => {
    switch (error.type) {
      case 'PERMISSION_DENIED':
        return {
          icon: '🔒',
          title: '위치 권한이 필요합니다',
          message: '가장 가까운 응급실을 찾기 위해 위치 정보가 필요합니다.',
          actionText: '권한 설정 방법 보기',
          showRetry: true,
          instructions: [
            '브라우저 주소창 왼쪽의 자물쇠 아이콘을 클릭하세요',
            '위치 권한을 "허용"으로 변경하세요',
            '페이지를 새로고침하세요',
          ],
        };
      case 'TIMEOUT':
        return {
          icon: '⏱️',
          title: '위치 확인 시간 초과',
          message: 'GPS 신호를 찾는데 시간이 오래 걸리고 있습니다.',
          actionText: '다시 시도',
          showRetry: true,
          instructions: [
            'Wi-Fi를 켜면 위치 정확도가 향상됩니다',
            '실외에서 시도하면 GPS 신호가 더 잘 잡힙니다',
            '기기의 위치 서비스가 켜져 있는지 확인하세요',
          ],
        };
      case 'POSITION_UNAVAILABLE':
        return {
          icon: '📍',
          title: '위치를 확인할 수 없습니다',
          message: '현재 위치 정보를 가져올 수 없어 기본 위치를 사용 중입니다.',
          actionText: '다시 시도',
          showRetry: true,
          instructions: [
            '기기의 위치 서비스가 켜져 있는지 확인하세요',
            '네트워크 연결 상태를 확인하세요',
            '브라우저를 새로고침해보세요',
          ],
        };
      case 'STALE_DATA':
        return {
          icon: '⚠️',
          title: '위치 정확도 낮음',
          message: error.message,
          actionText: '정확도 개선하기',
          showRetry: true,
          instructions: [
            'Wi-Fi를 활성화하면 위치 정확도가 크게 향상됩니다',
            '실외로 이동하면 GPS 신호가 더 정확해집니다',
          ],
        };
      case 'NOT_SUPPORTED':
        return {
          icon: '❌',
          title: '브라우저가 위치 서비스를 지원하지 않습니다',
          message: '최신 브라우저를 사용하거나 수동으로 위치를 입력하세요.',
          actionText: '수동 입력',
          showRetry: false,
          instructions: [
            'Chrome, Safari, Edge 등 최신 브라우저 사용을 권장합니다',
          ],
        };
      default:
        return {
          icon: '⚠️',
          title: '알 수 없는 오류',
          message: '위치 정보를 가져올 수 없습니다.',
          actionText: '다시 시도',
          showRetry: true,
          instructions: [],
        };
    }
  };

  const content = getErrorContent();
  const [showInstructions, setShowInstructions] = React.useState(false);

  return (
    <div
      className={cn(
        'mb-4 p-4 rounded-lg border-2',
        isDark
          ? 'bg-destructive/10 border-destructive/30'
          : 'bg-red-50 border-red-200'
      )}
    >
      {/* 헤더 */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl flex-shrink-0">{content.icon}</span>
        <div className="flex-1">
          <h3
            className={cn(
              'text-base font-bold mb-1',
              isDark ? 'text-destructive' : 'text-red-700'
            )}
          >
            {content.title}
          </h3>
          <p
            className={cn(
              'text-sm',
              isDark ? 'text-muted-foreground' : 'text-red-600'
            )}
          >
            {content.message}
          </p>
        </div>
      </div>

      {/* 현재 사용 중인 위치 안내 */}
      <div
        className={cn(
          'mb-3 p-3 rounded-md text-sm',
          isDark ? 'bg-secondary' : 'bg-white'
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🏢</span>
          <span
            className={cn(
              'font-semibold',
              isDark ? 'text-foreground' : 'text-gray-900'
            )}
          >
            현재 기본 위치 사용 중
          </span>
        </div>
        <p className={cn('text-xs', isDark ? 'text-muted-foreground' : 'text-gray-600')}>
          창원시청 기준으로 병원을 검색하고 있습니다. 정확한 위치를 위해 위치 권한을 허용해주세요.
        </p>
      </div>

      {/* 액션 버튼들 */}
      <div className="flex gap-2">
        {content.showRetry && (
          <button
            onClick={onRetry}
            className={cn(
              'flex-1 py-2 px-4 rounded-md font-semibold text-sm transition-colors',
              isDark
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-red-600 text-white hover:bg-red-700'
            )}
          >
            {content.actionText}
          </button>
        )}
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className={cn(
            'py-2 px-4 rounded-md font-semibold text-sm transition-colors border',
            isDark
              ? 'bg-secondary text-foreground border-border hover:bg-secondary/80'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          )}
        >
          {showInstructions ? '숨기기' : '도움말'}
        </button>
      </div>

      {/* 상세 안내 (펼치기/접기) */}
      {showInstructions && content.instructions.length > 0 && (
        <div
          className={cn(
            'mt-3 p-3 rounded-md text-sm',
            isDark ? 'bg-secondary' : 'bg-white'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">💡</span>
            <span
              className={cn(
                'font-semibold text-sm',
                isDark ? 'text-foreground' : 'text-gray-900'
              )}
            >
              해결 방법
            </span>
          </div>
          <ol className="list-decimal list-inside space-y-1">
            {content.instructions.map((instruction, index) => (
              <li
                key={index}
                className={cn(
                  'text-xs',
                  isDark ? 'text-muted-foreground' : 'text-gray-600'
                )}
              >
                {instruction}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};
