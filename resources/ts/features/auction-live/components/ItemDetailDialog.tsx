import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Grid, Typography, Divider, Button, IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
} from '@mui/icons-material';
import type { LaneItem } from '@/types';

interface Props {
  open: boolean;
  item: LaneItem | null;
  onClose: () => void;
}

type MediaEntry = { type: 'image' | 'video'; url: string };

const resolveUrl = (url: string, item?: LaneItem | null): string => {
  if (!url || url.startsWith('http') || url.startsWith('/')) return url;
  const thumb = item?.thumbnail_path;
  if (thumb?.startsWith('http')) {
    const idx = thumb.indexOf('items/');
    if (idx > 0) return thumb.substring(0, idx) + url;
  }
  return url;
};

const buildMediaList = (item: LaneItem | null): MediaEntry[] => {
  if (!item) return [];
  const list: MediaEntry[] = [];
  if (item.thumbnail_path) list.push({ type: 'image', url: item.thumbnail_path });
  item.media?.forEach((m: any) => {
    const rawUrl = m.file_url || m.file_path || m.url;
    if (!rawUrl) return;
    if (m.is_thumbnail && item.thumbnail_path) return;
    const url = resolveUrl(rawUrl, item);
    if (url === item.thumbnail_path) return;
    const isVideo = m.media_type?.includes('video') || m.mime_type?.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(url);
    list.push({ type: isVideo ? 'video' : 'image', url });
  });
  if (list.length === 0) list.push({ type: 'image', url: '/img/noimage.png' });
  return list;
};

export const ItemDetailDialog = React.memo(({ open, item, onClose }: Props) => {
  const [mediaIndex, setMediaIndex] = useState(0);
  const [videoDialogUrl, setVideoDialogUrl] = useState('');
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const mediaList = buildMediaList(item);
  const current = mediaList[mediaIndex] ?? mediaList[0];
  const unit = item?.quantity_unit === 'kg' ? 'kg' : item?.quantity_unit === 'bag' ? '袋' : '匹';

  const handleClose = () => {
    setMediaIndex(0);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              No.{item?.item_number} {item?.species_name}
            </Typography>
            <IconButton onClick={handleClose}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            {/* 左: メディア */}
            <Grid item xs={12} md={6}>
              <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.100' }}>
                {current?.type === 'video' ? (
                  <video src={current.url} controls style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'contain' }} />
                ) : (
                  <img
                    src={current?.url || '/img/noimage.png'}
                    alt={item?.species_name}
                    style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'contain', cursor: 'pointer' }}
                    onClick={() => { setLightboxIndex(mediaIndex); setLightboxOpen(true); }}
                  />
                )}
              </Box>
              {mediaList.length > 1 && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5, overflowX: 'auto', pb: 0.5 }}>
                  {mediaList.map((m, i) => (
                    <Box
                      key={i}
                      onClick={() => {
                        if (m.type === 'video') { setVideoDialogUrl(m.url); setVideoDialogOpen(true); }
                        else setMediaIndex(i);
                      }}
                      sx={{
                        width: 64, height: 64, flexShrink: 0, borderRadius: 1, overflow: 'hidden', cursor: 'pointer',
                        border: i === mediaIndex ? '2px solid' : '2px solid transparent',
                        borderColor: i === mediaIndex ? 'primary.main' : 'transparent',
                        bgcolor: 'grey.200', position: 'relative',
                      }}
                    >
                      {m.type === 'video' ? (
                        <Box sx={{ width: '100%', height: '100%', bgcolor: 'black', position: 'relative' }}>
                          <video src={m.url} preload="metadata" muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.3)' }}>
                            <PlayCircleOutlineIcon sx={{ color: 'white', fontSize: 28 }} />
                          </Box>
                        </Box>
                      ) : (
                        <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Grid>

            {/* 右: 詳細 */}
            <Grid item xs={12} md={6}>
              <Typography variant="h4" color="primary.main" fontWeight="bold" gutterBottom>
                ¥{item?.current_price ? Math.floor(item.current_price).toLocaleString() : '0'}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>数量</Typography>
              <Typography variant="body1" gutterBottom>{item?.quantity}{unit}</Typography>
              {item?.inspection_info && (
                <>
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, color: 'primary.main' }}>個体情報</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{item.inspection_info}</Typography>
                </>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 画像拡大ライトボックス */}
      <Dialog open={lightboxOpen} onClose={() => setLightboxOpen(false)} maxWidth="xl" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.95)', boxShadow: 'none', m: 1, maxHeight: '98vh' } }}
      >
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <IconButton onClick={() => setLightboxOpen(false)} sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 2 }}>
            <CloseIcon />
          </IconButton>
          {mediaList.length > 1 && (
            <>
              <IconButton onClick={() => setLightboxIndex(p => (p - 1 + mediaList.length) % mediaList.length)} sx={{ position: 'absolute', left: 8, color: 'white', zIndex: 2 }}>
                <ChevronLeftIcon sx={{ fontSize: 40 }} />
              </IconButton>
              <IconButton onClick={() => setLightboxIndex(p => (p + 1) % mediaList.length)} sx={{ position: 'absolute', right: 8, color: 'white', zIndex: 2 }}>
                <ChevronRightIcon sx={{ fontSize: 40 }} />
              </IconButton>
            </>
          )}
          {(() => {
            const m = mediaList[lightboxIndex];
            if (!m) return null;
            if (m.type === 'video') return <video src={m.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh' }} />;
            return <img src={m.url} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }} />;
          })()}
        </Box>
        <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 1 }}>
          {lightboxIndex + 1} / {mediaList.length}
        </Typography>
      </Dialog>

      {/* 動画全画面 */}
      <Dialog open={videoDialogOpen} onClose={() => setVideoDialogOpen(false)} maxWidth="xl" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.95)', m: 1, maxHeight: '98vh' } }}
      >
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <IconButton onClick={() => setVideoDialogOpen(false)} sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 2 }}>
            <CloseIcon />
          </IconButton>
          {videoDialogUrl && <video src={videoDialogUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh' }} />}
        </Box>
      </Dialog>
    </>
  );
});

ItemDetailDialog.displayName = 'ItemDetailDialog';
