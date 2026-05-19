import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  Divider,
  IconButton,
  LinearProgress,
  Snackbar,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import UploadIcon from '@mui/icons-material/Upload';
import ImageIcon from '@mui/icons-material/Image';
import VideocamIcon from '@mui/icons-material/Videocam';
import StarIcon from '@mui/icons-material/Star';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { mediaEditorApi, MediaEditorMedia } from '@/api/admin/mediaEditorApi';

type UploadStatus = 'uploading' | 'processing' | 'success' | 'error';

interface UploadingFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
  status: UploadStatus;
  error?: string;
}

const MAX_IMAGES = 10;

export default function MediaEditorItemMediaEditPage() {
  const navigate = useNavigate();
  const { auctionId, id } = useParams<{ auctionId: string; id: string }>();

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<{ id: number; item_number: number; species_name: string } | null>(null);
  const [existingMedia, setExistingMedia] = useState<MediaEditorMedia[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!auctionId || !id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const fetched = await mediaEditorApi.getItem(Number(auctionId), Number(id));
        if (cancelled) return;
        setItem({
          id: fetched.id,
          item_number: fetched.item_number,
          species_name: fetched.species_name,
        });
        setExistingMedia(fetched.media ?? []);
      } catch (e: any) {
        if (!cancelled) {
          setLoadError(e?.response?.data?.message ?? '読み込みに失敗しました');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auctionId, id]);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mediaType: 'image' | 'video'
  ) => {
    const files = e.target.files;
    if (!files || !auctionId || !id) return;

    const newUploadingFiles: UploadingFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newUploadingFiles.push({
        id: `${Date.now()}-${i}-${file.name}`,
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
        progress: 0,
        status: 'uploading',
      });
    }
    setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);

    for (let i = 0; i < newUploadingFiles.length; i++) {
      const uf = newUploadingFiles[i];
      const isThumbnailNow = existingMedia.length === 0 && i === 0;
      try {
        const response = await mediaEditorApi.uploadMedia(
          Number(auctionId),
          Number(id),
          uf.file,
          mediaType,
          isThumbnailNow,
          (progress) => {
            setUploadingFiles((prev) =>
              prev.map((f) =>
                f.id === uf.id
                  ? { ...f, progress, status: progress >= 100 ? 'processing' : 'uploading' }
                  : f
              )
            );
          }
        );

        if (response.success) {
          setExistingMedia((prev) => [...prev, response.data.media]);
          setUploadingFiles((prev) =>
            prev.map((f) => (f.id === uf.id ? { ...f, status: 'success', progress: 100 } : f))
          );
        } else {
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uf.id
                ? { ...f, status: 'error', error: response.message || 'アップロードに失敗しました' }
                : f
            )
          );
        }
      } catch (err: any) {
        const message =
          err.response?.data?.message ||
          (err.code === 'ECONNABORTED' ? 'タイムアウトしました' : 'アップロードに失敗しました');
        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === uf.id ? { ...f, status: 'error', error: message } : f))
        );
      }
    }

    const successIds = newUploadingFiles.map((f) => f.id);
    setTimeout(() => {
      setUploadingFiles((prev) =>
        prev.filter((f) => !(successIds.includes(f.id) && f.status === 'success'))
      );
    }, 2500);

    e.target.value = '';
  };

  const dismissUploadingFile = (fileId: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleDeleteMedia = async (mediaId: number) => {
    if (!auctionId || !id) return;
    try {
      await mediaEditorApi.deleteMedia(Number(auctionId), Number(id), mediaId);
      setExistingMedia((prev) => prev.filter((m) => m.id !== mediaId));
      setSnackbar({ open: true, message: 'メディアを削除しました。', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'メディアの削除に失敗しました。', severity: 'error' });
    }
  };

  const handleSetThumbnail = async (mediaId: number) => {
    if (!auctionId || !id) return;
    try {
      await mediaEditorApi.setThumbnail(Number(auctionId), Number(id), mediaId);
      setExistingMedia((prev) => prev.map((m) => ({ ...m, is_thumbnail: m.id === mediaId })));
      setSnackbar({ open: true, message: 'サムネイルを設定しました。', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'サムネイルの設定に失敗しました。', severity: 'error' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError || !item) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/admin/media-editor/auctions/${auctionId}/items`)}
          sx={{ mb: 2 }}
        >
          商品一覧へ戻る
        </Button>
        <Alert severity="error">{loadError ?? '商品情報を取得できませんでした。'}</Alert>
      </Box>
    );
  }

  const imageCount = existingMedia.filter((m) => m.media_type.startsWith('photo')).length;

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(`/admin/media-editor/auctions/${auctionId}/items`)}
        sx={{ mb: 2 }}
      >
        商品一覧へ戻る
      </Button>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        #{item.id} {item.species_name}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        画像・動画のアップロード、サムネイル設定、削除のみ行えます。
      </Typography>

      <Card variant="outlined">
        <CardContent>
          {/* 動画アップロード */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <VideocamIcon sx={{ fontSize: 20, color: '#059669' }} />
              <Typography variant="subtitle2">動画</Typography>
            </Box>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<UploadIcon />}
              component="label"
              sx={{ py: 1.5, borderStyle: 'dashed' }}
            >
              動画をアップロード
              <input
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => handleFileUpload(e, 'video')}
              />
            </Button>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* 画像アップロード */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ImageIcon sx={{ fontSize: 20, color: '#059669' }} />
                <Typography variant="subtitle2">画像</Typography>
              </Box>
              <Chip label={`${imageCount} / ${MAX_IMAGES}`} size="small" />
            </Box>

            <Button
              variant="outlined"
              fullWidth
              startIcon={<UploadIcon />}
              component="label"
              sx={{ py: 1.5, borderStyle: 'dashed', mb: 2 }}
            >
              画像をアップロード
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => handleFileUpload(e, 'image')}
              />
            </Button>

            {uploadingFiles.map((file) => {
              const isError = file.status === 'error';
              const isSuccess = file.status === 'success';
              const isProcessing = file.status === 'processing';
              const statusLabel = isError
                ? file.error || 'アップロード失敗'
                : isSuccess
                ? 'アップロード完了'
                : isProcessing
                ? 'サーバーで処理中...'
                : `アップロード中 ${file.progress}%`;
              return (
                <Box
                  key={file.id}
                  sx={{
                    mb: 1,
                    p: 1,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: isError ? 'error.light' : isSuccess ? 'success.light' : 'grey.200',
                    bgcolor: isError ? 'error.lighter' : isSuccess ? 'success.lighter' : 'transparent',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    {isSuccess && <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />}
                    {isError && <ErrorOutlineIcon sx={{ fontSize: 16, color: 'error.main' }} />}
                    {(file.status === 'uploading' || isProcessing) && <CircularProgress size={14} />}
                    <Typography
                      variant="caption"
                      sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {file.file.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: isError ? 'error.main' : isSuccess ? 'success.main' : 'text.secondary',
                        fontWeight: isError || isSuccess ? 600 : 400,
                      }}
                    >
                      {statusLabel}
                    </Typography>
                    {isError && (
                      <IconButton size="small" onClick={() => dismissUploadingFile(file.id)}>
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                  </Box>
                  {!isSuccess && !isError && (
                    <LinearProgress
                      variant={isProcessing ? 'indeterminate' : 'determinate'}
                      value={file.progress}
                      color={isProcessing ? 'warning' : 'primary'}
                    />
                  )}
                </Box>
              );
            })}

            {existingMedia.length > 0 && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 1,
                  maxHeight: 480,
                  overflowY: 'auto',
                  p: 1,
                  bgcolor: 'grey.50',
                  borderRadius: 2,
                }}
              >
                {existingMedia.map((media) => (
                  <Box
                    key={media.id}
                    sx={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: 1,
                      overflow: 'hidden',
                      border: media.is_thumbnail ? '2px solid' : '1px solid',
                      borderColor: media.is_thumbnail ? 'warning.main' : 'grey.200',
                    }}
                  >
                    {media.file_url && media.media_type.startsWith('photo') ? (
                      <Box
                        component="img"
                        src={media.file_url}
                        alt=""
                        onClick={() => setMediaPreviewUrl(media.file_url)}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          cursor: 'pointer',
                        }}
                      />
                    ) : (
                      <Box
                        onClick={() => media.file_url && setVideoPreviewUrl(media.file_url)}
                        sx={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'grey.800',
                          cursor: media.file_url ? 'pointer' : 'default',
                        }}
                      >
                        <PlayCircleOutlineIcon sx={{ color: 'white', fontSize: 32, mb: 0.5 }} />
                        <Typography variant="caption" sx={{ color: 'white' }}>
                          動画
                        </Typography>
                      </Box>
                    )}

                    {media.is_thumbnail && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 2,
                          left: 2,
                          bgcolor: 'warning.main',
                          color: 'white',
                          borderRadius: 0.5,
                          px: 0.5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.25,
                        }}
                      >
                        <StarIcon sx={{ fontSize: 12 }} />
                        <Typography sx={{ fontSize: '0.6rem' }}>サムネ</Typography>
                      </Box>
                    )}

                    <Box
                      sx={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        display: 'flex',
                        gap: 0.5,
                      }}
                    >
                      {!media.is_thumbnail && media.media_type.startsWith('photo') && (
                        <Box
                          onClick={() => handleSetThumbnail(media.id)}
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            bgcolor: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <StarIcon sx={{ fontSize: 12 }} />
                        </Box>
                      )}
                      <Box
                        onClick={() => handleDeleteMedia(media.id)}
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          bgcolor: 'rgba(0,0,0,0.6)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            動画は100MB以下、画像は10MB以下でアップロードしてください。
          </Typography>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={!!videoPreviewUrl}
        onClose={() => setVideoPreviewUrl(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'black' } }}
      >
        <Box sx={{ position: 'relative' }}>
          <IconButton
            onClick={() => setVideoPreviewUrl(null)}
            sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 2, bgcolor: 'rgba(0,0,0,0.5)' }}
          >
            <CloseIcon />
          </IconButton>
          {videoPreviewUrl && (
            <video
              src={videoPreviewUrl}
              controls
              autoPlay
              style={{ width: '100%', maxHeight: '80vh', display: 'block' }}
            />
          )}
        </Box>
      </Dialog>

      <Dialog
        open={!!mediaPreviewUrl}
        onClose={() => setMediaPreviewUrl(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.95)', boxShadow: 'none' } }}
      >
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <IconButton
            onClick={() => setMediaPreviewUrl(null)}
            sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 2 }}
          >
            <CloseIcon />
          </IconButton>
          {mediaPreviewUrl && (
            <img
              src={mediaPreviewUrl}
              alt=""
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }}
            />
          )}
        </Box>
      </Dialog>
    </Box>
  );
}
