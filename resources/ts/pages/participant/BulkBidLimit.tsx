import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Box, Typography, Paper, Button, IconButton, Chip, Checkbox, TextField,
  InputAdornment, Accordion, AccordionSummary, AccordionDetails, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Divider,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatYen } from '../../lib/formatPrice';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { bulkBidLimitApi, type BulkBidLimitItem, type BulkBidLimitError } from '../../api/participant/bulkBidLimitApi';

/**
 * スタート価格別の一括事前入札（A案）。
 * 出品をスタート価格でまとめ、品種名ごとの行に「×点数」を出す。グループの金額は下書きで、
 * 「適用」で各生体の金額へ展開する。保存されるのは生体ごとの指値（確認シートを経て一括確定）。
 */

type Row = { key: string; speciesName: string; items: BulkBidLimitItem[] };
type Group = { startPrice: number; unit: number; rows: Row[]; itemCount: number };

const normalizeName = (name: string) => name.trim();

const buildGroups = (items: BulkBidLimitItem[]): Group[] => {
  const byPrice = new Map<number, Map<string, BulkBidLimitItem[]>>();
  for (const item of items) {
    const rows = byPrice.get(item.start_price) ?? new Map<string, BulkBidLimitItem[]>();
    const name = normalizeName(item.species_name);
    rows.set(name, [...(rows.get(name) ?? []), item]);
    byPrice.set(item.start_price, rows);
  }
  return [...byPrice.entries()]
    .sort(([a], [b]) => a - b)
    .map(([startPrice, rows]) => ({
      startPrice,
      unit: [...rows.values()][0][0].unit,
      rows: [...rows.entries()].map(([name, rowItems]) => ({ key: `${startPrice}:${name}`, speciesName: name, items: rowItems })),
      itemCount: [...rows.values()].reduce((n, r) => n + r.length, 0),
    }));
};

/** 金額の検証。問題なければ null */
const validatePrice = (price: number, item: Pick<BulkBidLimitItem, 'start_price' | 'unit'>): string | null => {
  if (!Number.isFinite(price) || price < item.start_price) return `スタート価格（¥${formatYen(item.start_price)}）以上で入力してください`;
  if (price !== item.start_price && item.unit > 0 && price % item.unit !== 0) return `¥${formatYen(item.unit)}単位で入力してください`;
  return null;
};

/** 複数の金額を「¥1,000」または「¥1,000〜¥2,000」で表す */
const formatRange = (prices: number[]): string => {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `¥${formatYen(min)}` : `¥${formatYen(min)}〜¥${formatYen(max)}`;
};

export default function BulkBidLimit() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showWarning } = useSnackbar();

  const { data, isLoading, error } = useQuery({
    queryKey: ['bulk-bid-limits', auctionId],
    queryFn: () => bulkBidLimitApi.get(auctionId!),
    enabled: !!auctionId,
  });

  const groups = useMemo(() => buildGroups(data?.items ?? []), [data]);
  const isOpen = data?.is_open ?? false;

  // 生体ごとの下書き金額（適用したものだけ入る）
  const [drafts, setDrafts] = useState<Record<number, number>>({});
  // グループの一括金額欄（未入力はスタート価格が初期値）
  const [groupInputs, setGroupInputs] = useState<Record<number, string>>({});
  // チェックした行
  const [checked, setChecked] = useState<Set<string>>(new Set());
  // 展開中のグループ（初期は最安グループのみ）
  const [expanded, setExpanded] = useState<Set<number> | null>(null);
  const expandedSet = expanded ?? new Set(groups.length > 0 ? [groups[0].startPrice] : []);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<BulkBidLimitError[]>([]);

  const allItems = data?.items ?? [];

  // 確定対象: 下書きが現在の指値と異なる生体
  const changes = useMemo(
    () => allItems
      .filter((i) => drafts[i.id] !== undefined && drafts[i.id] !== i.limit_price)
      .map((i) => ({ item: i, price: drafts[i.id], error: validatePrice(drafts[i.id], i) })),
    [allItems, drafts],
  );
  const hasInvalid = changes.some((c) => c.error);

  const toggleExpanded = (startPrice: number) => {
    const next = new Set(expandedSet);
    next.has(startPrice) ? next.delete(startPrice) : next.add(startPrice);
    setExpanded(next);
  };

  const toggleRow = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAllRows = (group: Group) => {
    const allChecked = group.rows.every((r) => checked.has(r.key));
    setChecked((prev) => {
      const next = new Set(prev);
      group.rows.forEach((r) => (allChecked ? next.delete(r.key) : next.add(r.key)));
      return next;
    });
  };

  const groupInputValue = (group: Group) => groupInputs[group.startPrice] ?? String(group.startPrice);

  // 適用: チェック済みの行（無ければグループ全行）の全生体に同じ金額を入れる
  const applyGroup = (group: Group) => {
    const price = Number(groupInputValue(group));
    const targetRows = group.rows.some((r) => checked.has(r.key))
      ? group.rows.filter((r) => checked.has(r.key))
      : group.rows;
    setDrafts((prev) => {
      const next = { ...prev };
      targetRows.forEach((r) => r.items.forEach((i) => { next[i.id] = price; }));
      return next;
    });
    setServerErrors([]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setServerErrors([]);
    try {
      const res = await bulkBidLimitApi.store(auctionId!, changes.map((c) => ({ item_id: c.item.id, limit_price: c.price })));
      (res.success ? showSuccess : showWarning)(res.message);
      setServerErrors(res.data?.errors ?? []);
      setDrafts({});
      setChecked(new Set());
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['bulk-bid-limits', auctionId] });
      queryClient.invalidateQueries({ queryKey: ['bid-limits-batch'] });
    } catch (err: any) {
      setServerErrors(err?.response?.data?.data?.errors ?? []);
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress />
    </Box>
  );

  if (error || !data) return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Alert severity="error" sx={{ mb: 2 }}>データの取得に失敗しました。</Alert>
      <Button variant="contained" onClick={() => navigate(`/participant/auction/${auctionId}/items`)}>出品一覧に戻る</Button>
    </Container>
  );

  const itemName = (id: number) => {
    const i = allItems.find((x) => x.id === id);
    return i ? `${i.exhibit_code ?? i.item_number} ${i.species_name}` : `#${id}`;
  };
  const newChanges = changes.filter((c) => c.item.limit_price === null);
  const updateChanges = changes.filter((c) => c.item.limit_price !== null);

  return (
    <Container maxWidth="md" sx={{ py: 3, pb: 12 }}>
      {/* ヘッダー */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(`/participant/auction/${auctionId}/items`)}><ArrowBackIcon /></IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight="bold">まとめて事前入札</Typography>
            <Typography variant="body2" color="text.secondary">
              {data.auction.title}・{groups.reduce((n, g) => n + g.rows.length, 0)}品種 / {allItems.length}点
            </Typography>
          </Box>
          {!isOpen && <Chip label="締切済" color="default" />}
        </Box>
      </Paper>

      {!isOpen && (
        <Alert severity="info" sx={{ mb: 2 }}>事前入札の受付は終了しました。金額は変更できません。</Alert>
      )}
      {serverErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {serverErrors.map((e) => <div key={e.item_id}>{itemName(e.item_id)}：{e.message}</div>)}
        </Alert>
      )}

      {groups.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">事前入札できる出品がありません</Typography>
        </Paper>
      ) : groups.map((group) => {
        const inputValue = groupInputValue(group);
        const isDefault = inputValue === String(group.startPrice);
        const inputError = validatePrice(Number(inputValue), { start_price: group.startPrice, unit: group.unit });
        const allChecked = group.rows.every((r) => checked.has(r.key));
        return (
          <Accordion
            key={group.startPrice}
            expanded={expandedSet.has(group.startPrice)}
            onChange={() => toggleExpanded(group.startPrice)}
            disableGutters
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography fontWeight="bold">スタート ¥{formatYen(group.startPrice)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {group.rows.length}品種 / {group.itemCount}点・¥{formatYen(group.unit)}単位
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              {/* 一括金額 */}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1.5, flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  type="number"
                  label="一括金額"
                  value={inputValue}
                  disabled={!isOpen}
                  onChange={(e) => setGroupInputs((prev) => ({ ...prev, [group.startPrice]: e.target.value }))}
                  error={!!inputError}
                  helperText={inputError ?? ' '}
                  InputProps={{ startAdornment: <InputAdornment position="start">¥</InputAdornment> }}
                  inputProps={{ min: group.startPrice, step: group.unit }}
                  sx={{
                    width: 200,
                    '& input': { fontWeight: isDefault ? 'normal' : 'bold', color: isDefault ? 'text.secondary' : 'text.primary' },
                    '& .MuiOutlinedInput-notchedOutline': isDefault ? {} : { borderColor: 'primary.main', borderWidth: 2 },
                  }}
                />
                <Button variant="contained" disabled={!isOpen || !!inputError} onClick={() => applyGroup(group)} sx={{ mt: 0.25 }}>
                  適用
                </Button>
                <Button size="small" disabled={!isOpen} onClick={() => toggleAllRows(group)} sx={{ mt: 0.5 }}>
                  {allChecked ? '選択を解除' : 'すべて選択'}
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                チェックした品種に同じ金額を入れます（何も選ばないとこのグループ全体）。手入力した金額も上書きします。
              </Typography>

              <Divider />
              {group.rows.map((row) => {
                const existing = row.items.map((i) => i.limit_price).filter((p): p is number => p !== null);
                const drafted = row.items.map((i) => drafts[i.id]).filter((p): p is number => p !== undefined);
                const rowErrors = row.items
                  .filter((i) => drafts[i.id] !== undefined)
                  .map((i) => validatePrice(drafts[i.id], i))
                  .filter((e): e is string => !!e);
                return (
                  <Box key={row.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Checkbox size="small" checked={checked.has(row.key)} disabled={!isOpen} onChange={() => toggleRow(row.key)} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight="bold" sx={{ wordBreak: 'break-all' }}>
                        {row.speciesName} <Typography component="span" variant="body2" color="text.secondary">×{row.items.length}点</Typography>
                      </Typography>
                      {existing.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          入札済 {formatRange(existing)}{existing.length < row.items.length ? `（${existing.length}点）` : ''}
                        </Typography>
                      )}
                      {rowErrors.length > 0 && (
                        <Typography variant="caption" color="error" sx={{ display: 'block' }}>{rowErrors[0]}</Typography>
                      )}
                    </Box>
                    <Typography variant="body2" fontWeight="bold" color={rowErrors.length > 0 ? 'error' : 'primary'} sx={{ whiteSpace: 'nowrap' }}>
                      {drafted.length > 0 ? formatRange(drafted) : ''}
                    </Typography>
                  </Box>
                );
              })}
            </AccordionDetails>
          </Accordion>
        );
      })}

      {/* 下部の確定バー */}
      {isOpen && (
        <Paper elevation={6} sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, p: 1.5, zIndex: 10 }}>
          <Container maxWidth="md" sx={{ display: 'flex', alignItems: 'center', gap: 2, px: { xs: 0 } }}>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {changes.length > 0 ? `${changes.length}点を確定待ち` : '一括金額を入れて「適用」してください'}
            </Typography>
            {changes.length > 0 && (
              <Button onClick={() => { setDrafts({}); setServerErrors([]); }}>取り消す</Button>
            )}
            <Button variant="contained" color="success" disabled={changes.length === 0 || hasInvalid} onClick={() => setConfirmOpen(true)}>
              内容を確認
            </Button>
          </Container>
        </Paper>
      )}

      {/* 確認シート */}
      <Dialog open={confirmOpen} onClose={() => !submitting && setConfirmOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>事前入札の確定</DialogTitle>
        <DialogContent dividers>
          {newChanges.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>新規（{newChanges.length}点）</Typography>
              {newChanges.map((c) => (
                <Box key={c.item.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
                  <Typography variant="body2">{itemName(c.item.id)}</Typography>
                  <Typography variant="body2" fontWeight="bold">¥{formatYen(c.price)}</Typography>
                </Box>
              ))}
            </>
          )}
          {updateChanges.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: newChanges.length > 0 ? 2 : 0, mb: 0.5 }}>変更（{updateChanges.length}点）</Typography>
              {updateChanges.map((c) => {
                const isDecrease = c.price < (c.item.limit_price ?? 0);
                return (
                  <Box key={c.item.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
                    <Typography variant="body2">{itemName(c.item.id)}</Typography>
                    <Typography variant="body2" fontWeight="bold" color={isDecrease ? 'error' : 'text.primary'}>
                      ¥{formatYen(c.item.limit_price)} → ¥{formatYen(c.price)}{isDecrease ? '（減額）' : ''}
                    </Typography>
                  </Box>
                );
              })}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={submitting}>戻る</Button>
          <Button variant="contained" color="success" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : `${changes.length}点を確定する`}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
