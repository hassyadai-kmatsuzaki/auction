import { useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { AutoAwesome as AutoAwesomeIcon, Close as CloseIcon } from '@mui/icons-material';
import { adminDataApi, aiCategoryApi, CategorizedItem, CategoryResult } from '../../api/admin/aiApi';

const CATEGORY_STYLE: Record<CategoryResult['category'], { bg: string; fg: string }> = {
  premium: { bg: '#F59E0B', fg: '#fff' },
  improved: { bg: '#3B82F6', fg: '#fff' },
  standard: { bg: '#E2E8F0', fg: '#334155' },
};

const SOURCE_LABEL: Record<CategoryResult['source'], string> = {
  ai: 'AI判定',
  rule: 'キーワード判定',
};

function CategoryChip({ category, label }: { category: CategoryResult['category'] | null; label: string | null }) {
  if (!category || !label) return <Typography variant="body2" color="text.secondary">-</Typography>;
  const style = CATEGORY_STYLE[category];
  return <Chip label={label} size="small" sx={{ bgcolor: style.bg, color: style.fg, fontWeight: 700 }} />;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * 自動カテゴリ分類（F-055・ベータ）
 * AI分析センターの「自動カテゴリ分類」カードから開く。
 */
export default function AICategoryDialog({ open, onClose }: Props) {
  // 1件判定
  const [speciesName, setSpeciesName] = useState('');
  const [description, setDescription] = useState('');
  const [single, setSingle] = useState<CategoryResult | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);

  // オークション一括判定
  const [auctions, setAuctions] = useState<any[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [rows, setRows] = useState<CategorizedItem[] | null>(null);
  const [summary, setSummary] = useState<{ category: CategoryResult['category']; label: string; count: number }[]>([]);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || auctions.length) return;
    adminDataApi.getAuctions().then(setAuctions).catch(() => setAuctions([]));
  }, [open]);

  const handleClassify = async () => {
    setSingleLoading(true);
    setError('');
    setSingle(null);
    try {
      setSingle(await aiCategoryApi.classify(speciesName.trim(), description.trim() || undefined));
    } catch (err: any) {
      setError(err.response?.data?.message || 'カテゴリ判定に失敗しました');
    } finally {
      setSingleLoading(false);
    }
  };

  const handleClassifyAuction = async () => {
    if (!selectedAuction) return;
    setBulkLoading(true);
    setError('');
    setRows(null);
    try {
      const data = await aiCategoryApi.classifyAuction(selectedAuction.id);
      setRows(data.items);
      setSummary(data.summary);
      setAiEnabled(data.ai_enabled);
    } catch (err: any) {
      setError(err.response?.data?.message || '一括判定に失敗しました');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon sx={{ color: '#F59E0B' }} />
        <Typography variant="h6" component="span" fontWeight={700}>自動カテゴリ分類</Typography>
        <Chip label="ベータ" size="small" color="warning" sx={{ height: 20, fontSize: '0.65rem' }} />
        <IconButton onClick={onClose} sx={{ ml: 'auto' }} aria-label="閉じる">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          品種名・説明文から「高級品種／改良品種／普通種」を判定します。AIが使えない場合はキーワードで判定します。
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* 1件判定 */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>品種名・説明文から判定</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <TextField
            label="品種名"
            size="small"
            value={speciesName}
            onChange={(e) => { setSpeciesName(e.target.value); setSingle(null); }}
            sx={{ flex: '1 1 200px' }}
          />
          <TextField
            label="説明文（任意）"
            size="small"
            value={description}
            onChange={(e) => { setDescription(e.target.value); setSingle(null); }}
            sx={{ flex: '2 1 280px' }}
          />
          <Button
            variant="contained"
            onClick={handleClassify}
            disabled={!speciesName.trim() || singleLoading}
            startIcon={singleLoading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
            sx={{ bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' } }}
          >
            判定
          </Button>
        </Box>
        {single && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
            <Typography variant="body2">判定結果：</Typography>
            <CategoryChip category={single.category} label={single.label} />
            <Typography variant="caption" color="text.secondary">（{SOURCE_LABEL[single.source]}）</Typography>
          </Box>
        )}

        <Divider sx={{ my: 3 }} />

        {/* オークション一括判定 */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>オークションの生体を一括判定</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Autocomplete
            options={auctions}
            getOptionLabel={(o) => `${o.title}（${String(o.event_date ?? '').slice(0, 10)}）`}
            value={selectedAuction}
            onChange={(_, v) => { setSelectedAuction(v); setRows(null); }}
            renderInput={(params) => <TextField {...params} label="オークション" size="small" />}
            sx={{ flex: '1 1 320px' }}
          />
          <Button
            variant="contained"
            onClick={handleClassifyAuction}
            disabled={!selectedAuction || bulkLoading}
            startIcon={bulkLoading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
            sx={{ bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' } }}
          >
            一括判定
          </Button>
        </Box>

        {rows && (
          <Box sx={{ mt: 2 }}>
            {!aiEnabled && (
              <Alert severity="info" sx={{ mb: 1.5 }}>AIが未設定のため、キーワードで判定しています。</Alert>
            )}
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
              {summary.map((s) => (
                <Chip
                  key={s.category}
                  label={`${s.label} ${s.count}件`}
                  size="small"
                  sx={{ bgcolor: CATEGORY_STYLE[s.category].bg, color: CATEGORY_STYLE[s.category].fg, fontWeight: 700 }}
                />
              ))}
            </Box>
            {rows.length === 0 ? (
              <Typography variant="body2" color="text.secondary">このオークションには生体が登録されていません。</Typography>
            ) : (
              <TableContainer sx={{ maxHeight: 360 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>No.</TableCell>
                      <TableCell>品種名</TableCell>
                      <TableCell>カテゴリ</TableCell>
                      <TableCell>判定方法</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.item_id}>
                        <TableCell>{r.item_number ?? '-'}</TableCell>
                        <TableCell>{r.species_name}</TableCell>
                        <TableCell><CategoryChip category={r.category} label={r.label} /></TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {r.source ? SOURCE_LABEL[r.source] : '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
