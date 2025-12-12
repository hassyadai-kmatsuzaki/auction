import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  SkipNext as SkipNextIcon,
  Stop as StopIcon,
  People as PeopleIcon,
} from '@mui/icons-material';

// Mock: 6レーンのデータ
const lanes = [
  { lane_number: 1, item: { item_number: 1, species_name: '幹之メダカ', current_price: 850, quantity: 5, active_bidders: 3 } },
  { lane_number: 2, item: { item_number: 2, species_name: '楊貴妃メダカ', current_price: 450, quantity: 3, active_bidders: 2 } },
  { lane_number: 3, item: { item_number: 3, species_name: 'オロチメダカ', current_price: 800, quantity: 4, active_bidders: 1 } },
  { lane_number: 4, item: { item_number: 4, species_name: '三色錦メダカ', current_price: 750, quantity: 6, active_bidders: 4 } },
  { lane_number: 5, item: { item_number: 5, species_name: '青幹之メダカ', current_price: 700, quantity: 5, active_bidders: 0 } },
  { lane_number: 6, item: { item_number: 6, species_name: '紅白メダカ', current_price: 550, quantity: 4, active_bidders: 2 } },
];

export default function LiveControl() {
  const navigate = useNavigate();
  const { auctionId } = useParams();
  const [isPaused, setIsPaused] = useState(false);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/auctions')}
          sx={{ mr: 2 }}
        >
          戻る
        </Button>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          ライブオークション管理
        </Typography>
        <Chip label="開催中" color="success" icon={<PlayArrowIcon />} />
      </Box>

      {/* コントロールパネル */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant={isPaused ? 'contained' : 'outlined'}
            color={isPaused ? 'success' : 'warning'}
            startIcon={isPaused ? <PlayArrowIcon /> : <PauseIcon />}
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? '再開' : '一時停止'}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<StopIcon />}
          >
            緊急停止
          </Button>
        </Box>
      </Paper>

      {/* 6レーン表示 */}
      <Grid container spacing={2}>
        {lanes.map((lane) => (
          <Grid item xs={12} sm={6} md={4} key={lane.lane_number}>
            <Card>
              <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 1 }}>
                <Typography variant="h6" align="center">
                  レーン {lane.lane_number}
                </Typography>
              </Box>
              
              <CardMedia
                component="div"
                sx={{
                  height: 150,
                  bgcolor: 'grey.300',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  動画プレビュー
                </Typography>
              </CardMedia>

              <CardContent>
                <Typography variant="caption" color="text.secondary">
                  No.{lane.item.item_number}
                </Typography>
                <Typography variant="h6" gutterBottom>
                  {lane.item.species_name}
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="h4" color="primary.main" fontWeight="bold">
                    ¥{lane.item.current_price.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    × {lane.item.quantity}匹
                  </Typography>
                </Box>

                <Chip
                  icon={<PeopleIcon />}
                  label={`${lane.item.active_bidders}人入札中`}
                  color={lane.item.active_bidders > 0 ? 'primary' : 'default'}
                  size="small"
                />

                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<SkipNextIcon />}
                  >
                    次へ
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

