import React from 'react';
import {
  Card, CardMedia, CardContent, Box, Typography, Chip, IconButton,
} from '@mui/material';
import {
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface ItemData {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  start_price: number;
  current_price: number;
  inspection_info?: string;
  is_premium: boolean;
  thumbnail_path?: string;
  status: string;
  media?: any[];
}

const STATUS_CONFIG: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' }> = {
  registered: { label: '出品中',   color: 'primary' },
  live:       { label: '入札中',   color: 'error'   },
  sold:       { label: '落札済',   color: 'success' },
  unsold:     { label: '不成立',   color: 'default' },
};

interface Props {
  item: ItemData;
  isFavorited: boolean;
  onClick?: () => void;
  onFavoriteToggle: (e: React.MouseEvent) => void;
  /** 詳細ボタン（infoアイコン）クリック時のコールバック */
  onInfoClick?: (e: React.MouseEvent) => void;
  /** ツアー用: ハートアイコンに data-tour-target を付与 */
  favoriteButtonTourTarget?: string;
  /** お気に入りボタンを無効化（見た目は維持、タップ・カーソル無効） */
  disableFavorite?: boolean;
  /** 詳細ボタンを無効化（見た目は維持、タップ・カーソル無効） */
  disableInfo?: boolean;
  /** ステータスチップ（出品中等）を非表示にする */
  hideStatus?: boolean;
}

export const ItemCard = React.memo(({ item, isFavorited, onClick, onFavoriteToggle, onInfoClick, favoriteButtonTourTarget, disableFavorite, disableInfo, hideStatus }: Props) => {
  const status = STATUS_CONFIG[item.status] ?? { label: item.status, color: 'default' as const };

  return (
    <Card
      sx={{
        height: '100%', position: 'relative',
        transition: 'transform 0.2s, box-shadow 0.2s',
        ...(onClick && { cursor: 'pointer', '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 } }),
      }}
      onClick={onClick}
    >
      <IconButton
        onClick={onFavoriteToggle}
        data-tour-target={favoriteButtonTourTarget}
        sx={{
          position: 'absolute', top: 4, left: 4, zIndex: 2, bgcolor: 'rgba(255,255,255,0.85)', width: 32, height: 32,
          ...(disableFavorite && { pointerEvents: 'none', cursor: 'default' }),
        }}
        size="small"
      >
        {isFavorited
          ? <FavoriteIcon sx={{ color: '#ef4444', fontSize: 20 }} />
          : <FavoriteBorderIcon sx={{ color: 'grey.500', fontSize: 20 }} />}
      </IconButton>

      {item.is_premium && (
        <Chip label="プレミアム" color="warning" size="small"
          sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }} />
      )}

      <CardMedia component="img" image={item.thumbnail_path || '/img/noimage.png'}
        alt={item.species_name} sx={{ aspectRatio: '3/2', objectFit: 'cover' }} />

      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">No.{item.item_number}</Typography>
          {!hideStatus && <Chip label={status.label} color={status.color} size="small" />}
        </Box>
        <Typography variant="subtitle1" fontWeight="bold" noWrap>{item.species_name}</Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="h6" color="primary.main" fontWeight="bold">
            ¥{Number(item.start_price).toLocaleString()}〜
          </Typography>
          <Typography variant="caption" color="text.secondary">{item.quantity}匹セット</Typography>
        </Box>
        {item.inspection_info && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }} noWrap>
            {item.inspection_info}
          </Typography>
        )}
        {onInfoClick && (
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <Chip
              data-tour-target="item-detail-chip"
              icon={<InfoIcon sx={{ fontSize: 16 }} />}
              label="詳細"
              size="small"
              color="primary"
              variant="outlined"
              onClick={onInfoClick}
              sx={{
                cursor: disableInfo ? 'default' : 'pointer',
                ...(disableInfo && { pointerEvents: 'none' }),
              }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
});

ItemCard.displayName = 'ItemCard';
export type { ItemData };
