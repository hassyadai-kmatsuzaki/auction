import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { BoltOutlined as BoltIcon } from '@mui/icons-material';
import { formatYen } from '@/lib/formatPrice';

/**
 * 指値の業務上限（バックエンド SetBidLimitAction::MAX_LIMIT_PRICE と同値）。
 * これを超える値は入力させない / クイックボタンを disabled にする。
 */
export const MAX_BID_LIMIT_PRICE = 2_000_000;

interface QuickOptions {
  base_price: number;
  x1_5: number;
  x2: number;
  x2_5: number;
  x3: number;
}

interface Props {
  quickOptions: QuickOptions;
  currentValue: number | null;
  onSelect: (value: number) => void;
  isLive?: boolean;
  /** 指定した価格のみ選択可能にする（デモ用） */
  allowedPrice?: number;
}

const MULTIPLIERS = [
  { key: 'x1_5' as const, label: '×1.5' },
  { key: 'x2'   as const, label: '×2'   },
  { key: 'x2_5' as const, label: '×2.5' },
  { key: 'x3'   as const, label: '×3'   },
];

export const QuickLimitButtons = React.memo(({ quickOptions, currentValue, onSelect, isLive, allowedPrice }: Props) => (
  <Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
      <BoltIcon sx={{ fontSize: 16, color: 'warning.main' }} />
      <Typography variant="caption" color="text.secondary">
        クイック入力（{isLive ? '現在価格' : '開始価格'} ¥{formatYen(quickOptions.base_price)}/匹 基準）
      </Typography>
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
      {MULTIPLIERS.map(({ key, label }) => {
        const value = quickOptions[key];
        const isSelected = currentValue === value;
        const isOverCap = value > MAX_BID_LIMIT_PRICE;
        const isDisabled = (allowedPrice != null && value !== allowedPrice) || isOverCap;
        return (
          <Button
            key={key}
            variant={isSelected ? 'contained' : 'outlined'}
            color={isSelected ? 'primary' : 'inherit'}
            size="small"
            disabled={isDisabled}
            onClick={() => onSelect(value)}
            sx={{ flexDirection: 'column', py: 0.75, minWidth: 0 }}
          >
            <Typography variant="caption" sx={{ lineHeight: 1, fontWeight: 'bold', fontSize: '0.7rem' }}>
              {label}
            </Typography>
            <Typography variant="caption" sx={{ lineHeight: 1, fontSize: '0.65rem', color: isSelected ? 'inherit' : 'text.secondary' }}>
              ¥{formatYen(value)}
            </Typography>
          </Button>
        );
      })}
    </Box>
  </Box>
));

QuickLimitButtons.displayName = 'QuickLimitButtons';
