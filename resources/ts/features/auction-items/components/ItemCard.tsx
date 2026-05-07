import React from 'react';
import {
  Card, CardMedia, CardContent, Box, Typography, Chip, IconButton, Avatar,
} from '@mui/material';
import {
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { optimizedImageUrl } from '@/lib/optimizedMedia';
import { formatYen } from '@/lib/formatPrice';

interface ItemData {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  start_price: number;
  current_price: number;
  inspection_info?: string;
  is_premium: boolean;
  is_anonymous?: boolean;
  thumbnail_path?: string;
  status: string;
  media?: any[];
  seller_name?: string;
  seller_profile_image_url?: string | null;
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

      <CardMedia component="img" image={optimizedImageUrl(item.thumbnail_path, 'small')}
        alt={item.species_name} loading="lazy" sx={{ aspectRatio: '3/2', objectFit: 'cover' }} />

      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">No.{item.item_number}</Typography>
          {!hideStatus && <Chip label={status.label} color={status.color} size="small" />}
        </Box>
        <Typography variant="subtitle1" fontWeight="bold" noWrap>{item.species_name}</Typography>
        {item.is_anonymous ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
            <Avatar sx={{ width: 20, height: 20, bgcolor: 'grey.300' }} />
            <Typography variant="caption" color="text.secondary" noWrap>
              -
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
            <Avatar
              src={item.seller_profile_image_url || undefined}
              sx={{ width: 20, height: 20, fontSize: '0.7rem', bgcolor: 'grey.300' }}
            >
              {!item.seller_profile_image_url && (item.seller_name?.charAt(0) ?? '-')}
            </Avatar>
            <Typography variant="caption" color="text.secondary" noWrap>
              {item.seller_name || '-'}
            </Typography>
          </Box>
        )}
        {item.inspection_info && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }} noWrap>
            {item.inspection_info}
          </Typography>
        )}
        <Box sx={{ mt: 1 }}>
          <Typography variant="h6" color="primary.main" fontWeight="bold">
            ¥{formatYen(item.start_price)}〜
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5, fontWeight: 400 }}>
              /匹
            </Typography>
          </Typography>
          <Typography variant="caption" color="text.secondary">{item.quantity}匹セット</Typography>
        </Box>
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
