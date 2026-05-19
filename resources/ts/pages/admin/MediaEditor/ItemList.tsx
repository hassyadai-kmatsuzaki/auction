import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ImageIcon from '@mui/icons-material/Image';
import { mediaEditorApi, MediaEditorItem } from '@/api/admin/mediaEditorApi';

interface ItemsResponse {
  auction: { id: number; title: string; event_date: string; status: string };
  items: MediaEditorItem[];
  pagination: { total: number; per_page: number; current_page: number; last_page: number };
}

export default function MediaEditorItemListPage() {
  const navigate = useNavigate();
  const { auctionId } = useParams<{ auctionId: string }>();
  const [data, setData] = useState<ItemsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!auctionId) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await mediaEditorApi.listItems(Number(auctionId), {
          page,
          per_page: 30,
          search: search || undefined,
        });
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.response?.data?.message ?? '読み込みに失敗しました');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [auctionId, page, search]);

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/admin/media-editor')}
        sx={{ mb: 2 }}
      >
        オークション一覧へ戻る
      </Button>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        {data?.auction?.title ?? '読み込み中…'}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        編集したい商品を選んでください。
      </Typography>

      <TextField
        size="small"
        fullWidth
        placeholder="商品名・出品番号で検索"
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.target.value);
        }}
        sx={{ mb: 3, maxWidth: 480 }}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !data || data.items.length === 0 ? (
        <Alert severity="info">登録された商品はありません。</Alert>
      ) : (
        <Stack spacing={1.5}>
          {data.items.map((item) => (
            <Card key={item.id} variant="outlined">
              <CardActionArea
                onClick={() =>
                  navigate(`/admin/media-editor/auctions/${auctionId}/items/${item.id}`)
                }
              >
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {item.thumbnail_path ? (
                    <Avatar
                      src={item.thumbnail_path}
                      alt=""
                      variant="rounded"
                      sx={{ width: 64, height: 64 }}
                    />
                  ) : (
                    <Avatar variant="rounded" sx={{ width: 64, height: 64, bgcolor: 'grey.200' }}>
                      <ImageIcon sx={{ color: 'grey.500' }} />
                    </Avatar>
                  )}

                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      #{item.id} {item.species_name}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Chip
                        size="small"
                        label={`メディア ${item.media_count} 件`}
                        color={item.media_count > 0 ? 'success' : 'default'}
                        variant="outlined"
                      />
                      <Chip size="small" label={item.status} variant="outlined" />
                    </Stack>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}

      {data && data.pagination.last_page > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            page={page}
            count={data.pagination.last_page}
            onChange={(_, p) => setPage(p)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
}
