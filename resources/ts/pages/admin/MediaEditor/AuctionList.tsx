import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
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
import { mediaEditorApi, MediaEditorAuction } from '@/api/admin/mediaEditorApi';

export default function MediaEditorAuctionListPage() {
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState<MediaEditorAuction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await mediaEditorApi.listAuctions({
          page,
          per_page: 20,
          search: search || undefined,
        });
        if (cancelled) return;
        setAuctions(data.auctions);
        setLastPage(data.pagination.last_page);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.response?.data?.message ?? '読み込みに失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [page, search]);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        メディア編集対象のオークション
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        開催前（準備中・予定）のオークションのみ表示しています。アイテムを選んで画像・動画を編集してください。
      </Typography>

      <TextField
        size="small"
        fullWidth
        placeholder="タイトルで検索"
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
      ) : auctions.length === 0 ? (
        <Alert severity="info">対象となるオークションはありません。</Alert>
      ) : (
        <Stack spacing={2}>
          {auctions.map((a) => (
            <Card key={a.id} variant="outlined">
              <CardActionArea
                onClick={() => navigate(`/admin/media-editor/auctions/${a.id}/items`)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {a.title}
                    </Typography>
                    <Chip
                      size="small"
                      label={a.status === 'preparing' ? '準備中' : '予定'}
                      color={a.status === 'preparing' ? 'default' : 'primary'}
                    />
                    {a.is_test && <Chip size="small" label="テスト" color="warning" />}
                  </Box>
                  <Stack direction="row" spacing={2} sx={{ color: 'text.secondary' }}>
                    <Typography variant="body2">開催日: {a.event_date ?? '-'}</Typography>
                    <Typography variant="body2">登録商品数: {a.items_count}</Typography>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}

      {lastPage > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            page={page}
            count={lastPage}
            onChange={(_, p) => setPage(p)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
}
