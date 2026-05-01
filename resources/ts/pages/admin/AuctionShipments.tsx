import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import axios from '../../lib/axios';

interface ShipmentRow {
  id: number;
  carrier: 'yu_pack' | 'sagawa' | 'yamato' | string;
  carrier_label: string;
  tracking_number: string;
  created_at: string | null;
}

interface SellerShipments {
  seller: { id: number; seller_code: string; seller_name: string } | null;
  shipments: ShipmentRow[];
}

const CARRIER_COLOR: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'info' | 'error'> = {
  yu_pack: 'success',
  sagawa: 'warning',
  yamato: 'info',
};

export default function AuctionShipments() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellers, setSellers] = useState<SellerShipments[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!auctionId) return;
    let cancelled = false;
    setLoading(true);
    axios.get(`/api/admin/auctions/${auctionId}/shipments`)
      .then((res) => {
        if (cancelled) return;
        setSellers(res.data?.data?.sellers ?? []);
        setTotal(res.data?.data?.total ?? 0);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError('伝票番号の取得に失敗しました。');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [auctionId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>出品者別 伝票番号</Typography>
        <Typography variant="body2" color="text.secondary">
          {sellers.length}名 / {total}件
        </Typography>
      </Box>

      {sellers.length === 0 ? (
        <Alert severity="info">登録された伝票番号はありません。</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sellers.map((s, idx) => (
            <Card key={s.seller?.id ?? idx} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {s.seller?.seller_name ?? '不明'}
                  </Typography>
                  {s.seller?.seller_code && (
                    <Typography variant="caption" color="text.secondary">
                      {s.seller.seller_code}
                    </Typography>
                  )}
                  <Box sx={{ flexGrow: 1 }} />
                  <Chip size="small" label={`${s.shipments.length}件`} />
                </Box>
                <Divider sx={{ mb: 1.5 }} />
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell sx={{ fontWeight: 600, width: 140 }}>配送業者</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>伝票番号</TableCell>
                        <TableCell sx={{ fontWeight: 600, width: 180 }}>登録日時</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {s.shipments.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Chip
                              size="small"
                              label={row.carrier_label}
                              color={CARRIER_COLOR[row.carrier] ?? 'default'}
                            />
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {row.tracking_number}
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{row.created_at ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}
