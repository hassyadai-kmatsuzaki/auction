import { useEffect, useState } from 'react';
import {
  Box, Card, Chip, CircularProgress, Pagination, Tab, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tabs, Typography,
} from '@mui/material';
import axios from '../../lib/axios';
import { formatYen } from '../../lib/formatPrice';

type EscrowStatusKey = 'awaiting_payment' | 'payment_held' | 'released_to_seller' | 'refunded' | 'disputed';

interface EscrowRow {
  id: number;
  amount: number;
  status: EscrowStatusKey;
  paid_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  buyer: { id: number; name: string } | null;
  seller: { id: number; name: string } | null;
  won_item: { item: { species_name: string; item_number: number; auction?: { title: string } | null } | null } | null;
}

const STATUS: Record<EscrowStatusKey, { label: string; bgcolor: string; color: string }> = {
  awaiting_payment: { label: '入金待ち', bgcolor: '#F1F5F9', color: '#475569' },
  payment_held: { label: '保全中', bgcolor: '#DBEAFE', color: '#1D4ED8' },
  released_to_seller: { label: '出品者へリリース済み', bgcolor: '#DCFCE7', color: '#15803D' },
  refunded: { label: '返金済み', bgcolor: '#FEF3C7', color: '#B45309' },
  disputed: { label: '紛争中', bgcolor: '#FEE2E2', color: '#B91C1C' },
};

const TABS: { key: '' | EscrowStatusKey; label: string }[] = [
  { key: '', label: 'すべて' },
  { key: 'awaiting_payment', label: '入金待ち' },
  { key: 'payment_held', label: '保全中' },
  { key: 'released_to_seller', label: 'リリース済み' },
  { key: 'refunded', label: '返金済み' },
  { key: 'disputed', label: '紛争中' },
];

const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString('ja-JP') : '-');

/**
 * エスクローの状態一覧（F-032・見るだけ）。状態は落札商品の入金・配送状況から自動同期される（escrow:sync）
 */
export default function EscrowStatus() {
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<EscrowRow[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get('/api/admin/escrow', { params: { status: TABS[tab].key || undefined, page } })
      .then((res) => {
        setRows(res.data.data.data);
        setLastPage(res.data.data.last_page);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab, page]);

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>エスクロー状況</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        落札商品ごとの入金保全の状態です。入金確認・配送完了に合わせて自動で更新されます（閲覧のみ）
      </Typography>

      <Card>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(1); }} variant="scrollable" sx={{ borderBottom: 1, borderColor: 'divider' }}>
          {TABS.map((t) => <Tab key={t.key || 'all'} label={t.label} />)}
        </Tabs>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : rows.length === 0 ? (
          <Typography sx={{ py: 6, textAlign: 'center' }} color="text.secondary">データがありません</Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>生体</TableCell>
                  <TableCell>落札者</TableCell>
                  <TableCell>出品者</TableCell>
                  <TableCell align="right">金額（税抜）</TableCell>
                  <TableCell align="center">状態</TableCell>
                  <TableCell>入金</TableCell>
                  <TableCell>リリース</TableCell>
                  <TableCell>返金</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {r.won_item?.item?.auction?.title ?? ''} No.{r.won_item?.item?.item_number ?? '-'}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.won_item?.item?.species_name ?? '-'}</Typography>
                    </TableCell>
                    <TableCell>{r.buyer?.name ?? '-'}</TableCell>
                    <TableCell>{r.seller?.name ?? '-'}</TableCell>
                    <TableCell align="right">¥{formatYen(r.amount)}</TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={STATUS[r.status]?.label ?? r.status}
                        sx={{ bgcolor: STATUS[r.status]?.bgcolor, color: STATUS[r.status]?.color, fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>{fmt(r.paid_at)}</TableCell>
                    <TableCell>{fmt(r.released_at)}</TableCell>
                    <TableCell>{fmt(r.refunded_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {lastPage > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <Pagination count={lastPage} page={page} onChange={(_, p) => setPage(p)} />
          </Box>
        )}
      </Card>
    </Box>
  );
}
