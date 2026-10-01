import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, Groups as GroupsIcon } from '@mui/icons-material';
import { aiMatchingApi, MatchedBuyer } from '../../api/admin/aiApi';
import { formatYen } from '../../lib/formatPrice';

interface Props {
  itemId: number | null;
  onClose: () => void;
}

/**
 * マッチング（F-059・基本版）: 出品物の見込み買受者
 * 購買履歴（落札・指値・入札・お気に入り）と出品パターン（品種・出品者・価格帯）の相性で上位10人を表示する。
 */
export default function AIMatchingDialog({ itemId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<Awaited<ReturnType<typeof aiMatchingApi.buyersForItem>> | null>(null);

  useEffect(() => {
    if (itemId === null) return;
    setLoading(true);
    setError('');
    setData(null);
    aiMatchingApi.buyersForItem(itemId)
      .then(setData)
      .catch((err) => setError(err.response?.data?.message || '見込み買受者の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [itemId]);

  return (
    <Dialog open={itemId !== null} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <GroupsIcon sx={{ color: '#8B5CF6' }} />
        <Typography variant="h6" component="span" fontWeight={700}>見込み買受者（マッチング）</Typography>
        <IconButton onClick={onClose} sx={{ ml: 'auto' }} aria-label="閉じる">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}

        {data && (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                {data.item.item_number ? `No.${data.item.item_number} ` : ''}{data.item.species_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                開始 ¥{formatYen(data.item.start_price)} ／ 想定落札単価 ¥{formatYen(data.item.expected_price)}
                {data.item.expected_price_source !== 'start_price' && `（${data.item.expected_price_source}）`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                過去の落札・指値・入札・お気に入りから、品種・出品者・価格帯の相性が高い買受者を表示しています。
              </Typography>
            </Box>

            {data.buyers.length === 0 ? (
              <Alert severity="info">この品種・出品者に関心を示した買受者の履歴がまだありません。</Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>順位</TableCell>
                      <TableCell sx={{ minWidth: 160 }}>買受者</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>相性</TableCell>
                      <TableCell>理由</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.buyers.map((b: MatchedBuyer, i) => (
                      <TableRow key={b.user_id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell sx={{ minWidth: 160 }}>
                          <Typography variant="body2" fontWeight={600}>{b.name}</Typography>
                          <Typography variant="caption" color="text.secondary">ID: {b.user_id}</Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 60, height: 6, bgcolor: 'grey.200', borderRadius: 3, overflow: 'hidden' }}>
                              <Box sx={{ width: `${Math.min(100, b.score)}%`, height: '100%', bgcolor: '#8B5CF6' }} />
                            </Box>
                            <Typography variant="body2">{b.score.toFixed(0)}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {b.reasons.map((r) => (
                              <Chip key={r} label={r} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
