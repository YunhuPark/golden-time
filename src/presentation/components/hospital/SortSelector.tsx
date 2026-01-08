import React from 'react';
import { SortOption, SORT_OPTIONS } from '../../../domain/types/SortOption';

interface SortSelectorProps {
  selectedOption: SortOption;
  onOptionChange: (option: SortOption) => void;
}

/**
 * SortSelector Component
 * 병원 정렬 옵션을 선택하는 버튼 그룹
 */
export const SortSelector: React.FC<SortSelectorProps> = ({
  selectedOption,
  onOptionChange,
}) => {
  return (
    <div
      style={{
        marginBottom: '16px',
      }}
    >
      {/* 정렬 라벨 */}
      <div
        style={{
          fontSize: '13px',
          color: '#666',
          marginBottom: '8px',
          fontWeight: '600',
        }}
      >
        정렬 기준
      </div>

      {/* 정렬 옵션 버튼 그룹 */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        {SORT_OPTIONS.map((option) => {
          const isSelected = selectedOption === option.value;

          return (
            <button
              key={option.value}
              onClick={() => onOptionChange(option.value)}
              style={{
                flex: '1 1 calc(50% - 4px)',
                minWidth: '140px',
                padding: '12px 8px',
                fontSize: '14px',
                fontWeight: isSelected ? '700' : '500',
                backgroundColor: isSelected ? '#FF3B30' : '#F3F4F6',
                color: isSelected ? '#fff' : '#374151',
                border: isSelected ? '2px solid #FF3B30' : '2px solid #E5E7EB',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
              aria-label={`${option.label}로 정렬`}
              aria-pressed={isSelected}
            >
              <div style={{ fontSize: '18px' }}>{option.icon}</div>
              <div style={{ fontSize: '14px', fontWeight: '700' }}>
                {option.label}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  opacity: 0.8,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {option.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
