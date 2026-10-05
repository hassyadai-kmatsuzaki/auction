import { useEffect, useState } from 'react';
import {
  Box, Chip, CircularProgress, Container, Pagination, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import axios from '../../lib/axios';
import { formatYen } from '../../lib/formatPrice';
import { optimizedImageUrl } from '../../lib/optimizedMedia';

type Result = 'won' | 'lost' | 'unsold' | 'in_progress';

interface HistoryRow {
  item_id: number;
  last_bid_at: string;
  species_name: string | null;
  item_number: number | null;
  exhibit_code: string | null;
  thumbnail_path: string | null;
  auction: { id: number; title: string; event_date: string } | null;
  result: Result;
  final_price: number | null;
}

const RESULT_CHIP: Record<Result, { label: string; bgcolor: string; color: string }> = {
  won: { label: '落札', bgcolor: '#DCFCE7', color: '#15803D' },
  lost: { label: '落札できず', bgcolor: '#F1F5F9', color: '#475569' },
  unsold: { label: '不成立', bgcolor: '#F1F5F9', color: '#64748B' },
  in_progress: { label: '開催中・開催前', bgcolor: '#DBEAFE', color: '#1D4ED8' },
};

/**
 * 入札履歴（F-022）。入札に参加した生体と結果を新しい順に表示する
 */
export default function BidHistory() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get('/api/participant/bid-history', { params: { page } })
      .then((res) => {
        setRows(res.data.data.history);
        setLastPage(res.data.data.pagination.last_page);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>入札履歴</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        入札に参加した生体と、その結果を確認できます
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">まだ入札に参加した生体はありません</Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>生体</TableCell>
                  <TableCell>オークション</TableCell>
                  <TableCell align="right">価格</TableCell>
                  <TableCell align="center">結果</TableCell>
                  <TableCell>入札日時</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.item_id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          component="img"
                          src={optimizedImageUrl(r.thumbnail_path ?? undefined, 'small')}
                          alt=""
                          loading="lazy"
                          sx={{ width: 64, height: 43, objectFit: 'cover', borderRadius: 1, bgcolor: 'grey.100' }}
                        />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {r.exhibit_code ?? (r.item_number ? `No.${r.item_number}` : '')}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.species_name ?? '（削除された商品）'}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.auction?.title ?? '-'}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.auction?.event_date ?? ''}</Typography>
                    </TableCell>
                    <TableCell align="right">{r.final_price != null ? `¥${formatYen(r.final_price)}` : '-'}</TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={RESULT_CHIP[r.result].label}
                        sx={{ bgcolor: RESULT_CHIP[r.result].bgcolor, color: RESULT_CHIP[r.result].color, fontWeight: 600 }} />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(r.last_bid_at).toLocaleString('ja-JP')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {lastPage > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination count={lastPage} page={page} onChange={(_, p) => setPage(p)} />
            </Box>
          )}
        </>
      )}
    </Container>
  );
}
