import { Box, Typography, Paper, Chip, IconButton, Tooltip } from '@mui/material';
import {
  Pets as PetsIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  PriceCheck as PriceCheckIcon,
} from '@mui/icons-material';
import type { LiveLane, UpcomingItem } from '@/types';

interface Props {
  lanes: LiveLane[];
  onFavoriteToggle?: (itemId: number) => void;
  onLimitEdit?: (itemId: number) => void;
}

export function UpcomingItems({ lanes, onFavoriteToggle, onLimitEdit }: Props) {
  const items: (UpcomingItem & { laneNumber: number })[] = [];

  for (const lane of lanes) {
    if (!lane.upcoming_items?.length) continue;
    for (const item of lane.upcoming_items) {
      items.push({ ...item, laneNumber: lane.lane_number });
    }
  }

  if (items.length === 0) return null;

  return (
    <Paper sx={{ mt: 3, p: 2 }}>
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>
        次の商品
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
        {items.map((item) => (
          <Box
            key={item.id}
            sx={{
              flexShrink: 0,
              width: 140,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              bgcolor: 'background.paper',
            }}
          >
            {item.thumbnail_path ? (
              <Box
                component="img"
                src={item.thumbnail_path}
                alt={item.species_name}
                sx={{ width: '100%', aspectRatio: '3/2', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  aspectRatio: '3/2',
                  bgcolor: 'grey.100',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PetsIcon sx={{ color: 'grey.400', fontSize: 28 }} />
              </Box>
            )}
            <Box sx={{ p: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                <Chip
                  label={`L${item.laneNumber}`}
                  size="small"
                  sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }}
                  color="primary"
                  variant="outlined"
                />
                {item.is_premium && (
                  <Chip label="P" size="small" color="warning" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} />
                )}
              </Box>
              <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600 }}>
                {item.species_name}
              </Typography>
              <Typography variant="caption" color="primary.main" fontWeight="bold">
                ¥{Number(item.start_price).toLocaleString()}〜
              </Typography>

              {/* お気に入り & 指値 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.5 }}>
                {onFavoriteToggle && (
                  <IconButton size="small" onClick={() => onFavoriteToggle(item.id)} sx={{ p: 0.25 }}>
                    {item.is_favorited
                      ? <FavoriteIcon sx={{ color: '#ef4444', fontSize: 16 }} />
                      : <FavoriteBorderIcon sx={{ color: 'grey.400', fontSize: 16 }} />}
                  </IconButton>
                )}
                {onLimitEdit && (
                  <Tooltip title={item.my_limit_price ? `上限: ¥${Math.floor(item.my_limit_price).toLocaleString()}` : '上限設定'} arrow>
                    <IconButton size="small" onClick={() => onLimitEdit(item.id)} sx={{ p: 0.25 }}>
                      <PriceCheckIcon sx={{
                        fontSize: 16,
                        color: item.my_limit_price
                          ? (item.my_limit_triggered ? 'grey.400' : 'primary.main')
                          : 'grey.400',
                      }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
