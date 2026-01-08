import React, { useEffect } from 'react';
import { cn } from '../../../lib/utils';
import { useAppStore } from '../../../infrastructure/state/store';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * BottomSheet Component
 * 화면 하단에서 부드럽게 올라오는 시트
 *
 * Features:
 * - Slide-up animation
 * - Backdrop with blur
 * - Swipe to close (touch friendly)
 * - Emergency Control Center 디자인
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
}) => {
  const { themeMode } = useAppStore();
  const isDark = themeMode === 'dark';

  // ESC 키로 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[9998]',
          'transition-opacity duration-300',
          isDark
            ? 'bg-black/80 backdrop-blur-sm'
            : 'bg-black/40 backdrop-blur-sm'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[9999]',
          'max-h-[85vh] rounded-t-2xl',
          'transform transition-transform duration-300 ease-out',
          'animate-slide-up',
          isDark
            ? 'bg-card border-t-2 border-border glass'
            : 'bg-white border-t border-gray-200 shadow-2xl'
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div
            className={cn(
              'w-12 h-1 rounded-full',
              isDark ? 'bg-border' : 'bg-gray-300'
            )}
          />
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-2rem)] px-4 pb-6">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
};
