import { Box, Typography, Paper, Chip } from '@mui/material';
import { Pets as PetsIcon } from '@mui/icons-material';
import type { LiveLane, UpcomingItem } from '@/types';

interface Props {
  lanes: LiveLane[];
}

export function UpcomingItems({ lanes }: Props) {
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
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
