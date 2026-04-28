import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { PriceCheck as PriceCheckIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { formatYen } from '@/lib/formatPrice';

interface Props {
  limitPrice: number | null;
  isTriggered: boolean;
  onEdit: () => void;
  onRemove?: () => void;
  size?: 'small' | 'medium';
}

/**
 * 指値（上限価格）のバッジ表示コンポーネント
 *
 * 設定済みの場合: 「上限: ¥X,XXX」チップを表示
 * 未設定の場合:   「上限設定」ボタンを表示
 * 発動済みの場合: グレーのチップを表示
 */
export const BidLimitBadge = React.memo(({ limitPrice, isTriggered, onEdit, onRemove, size = 'small' }: Props) => {
  if (!limitPrice) {
    return (
      <Tooltip title="上限価格を設定すると、その価格に達したとき自動で入札オフになります">
        <Chip
          data-tour-target="bid-limit-chip"
          icon={<PriceCheckIcon sx={{ fontSize: size === 'small' ? 14 : 16 }} />}
          label="上限設定"
          size={size}
          variant="outlined"
          color="default"
          onClick={onEdit}
          sx={{ cursor: 'pointer', fontSize: size === 'small' ? '0.65rem' : '0.75rem' }}
        />
      </Tooltip>
    );
  }

  const showRemove = Boolean(onRemove) && !isTriggered;

  return (
    <Chip
      icon={<PriceCheckIcon sx={{ fontSize: size === 'small' ? 14 : 16 }} />}
      label={`上限: ¥${formatYen(limitPrice)}`}
      size={size}
      color={isTriggered ? 'default' : 'primary'}
      variant={isTriggered ? 'outlined' : 'filled'}
      onClick={onEdit}
      onDelete={showRemove ? onRemove : undefined}
      deleteIcon={
        showRemove ? (
          <CancelIcon
            sx={{
              fontSize: size === 'small' ? 14 : 16,
              color: 'rgba(255, 255, 255, 0.8)',
              '&:hover': { color: '#fff' },
            }}
          />
        ) : undefined
      }
      sx={{
        cursor: 'pointer',
        fontSize: size === 'small' ? '0.65rem' : '0.75rem',
        opacity: isTriggered ? 0.6 : 1,
        textDecoration: isTriggered ? 'line-through' : 'none',
      }}
    />
  );
});

BidLimitBadge.displayName = 'BidLimitBadge';
