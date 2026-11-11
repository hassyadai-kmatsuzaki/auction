import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, Drawer, Box, Typography, IconButton, Button, Checkbox, Divider, CircularProgress,
  useMediaQuery, useTheme, Chip, Avatar,
} from '@mui/material';
import {
  Close as CloseIcon, Add as AddIcon, Remove as RemoveIcon,
  ArrowRight as ArrowRightIcon, ArrowDropDown as ArrowDropDownIcon,
} from '@mui/icons-material';
import { formatYen } from '@/lib/formatPrice';
import { MAX_BID_LIMIT_PRICE } from './QuickLimitButtons';

export interface BulkBidPanelItem {
  id: number;
  /** 品種名 */
  name: string;
  /** 出品番号など（任意） */
  code?: string | null;
  /** 匹数（任意。行に「◯匹」と出す） */
  quantity?: number | null;
  /** 出品者（一覧のカードと同じ表示。匿名出品は「-」） */
  seller_name?: string | null;
  seller_profile_image_url?: string | null;
  is_anonymous?: boolean;
  start_price: number;
  /** 開始価格の価格帯の入札単位（参考値。パネルの上乗せは stepFor() の刻み） */
  unit: number;
  /** 既に入れている事前入札（未設定は null） */
  limit_price: number | null;
  /** 金魚・エビなど＝まとめて入札の対象外 */
  is_other: boolean;
}

export interface BulkBidSubmit {
  limits: { item_id: number; limit_price: number }[];
  /** 完了メッセージ用: 「開始価格＋¥11」など */
  priceLabel: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: BulkBidPanelItem[];
  /** チェック状態（親が持つ） */
  checkedIds: Set<number>;
  onCheckedChange: (next: Set<number>) => void;
  /** 事前入札の受付中（開催前）か */
  isOpen: boolean;
  submitting?: boolean;
  onSubmit: (payload: BulkBidSubmit) => void;
  /** 1点モードで、既存の事前入札を取り消す */
  onRemove?: (itemId: number) => void;
}

/** 上乗せの上限（円） */
export const MAX_EXTRA = 100_000;

/**
 * ボタン1回で上がる金額（開始価格ベース）: ¥0〜99=1円 / ¥100〜999=10円 / ¥1,000〜=50円
 * （¥500〜999 は 10円か 50円か検討中 → ひとまず 10円）
 */
export const stepFor = (startPrice: number) => (startPrice < 100 ? 1 : startPrice < 1000 ? 10 : 50);

const clampExtra = (extra: number, start: number) =>
  Math.max(0, Math.min(MAX_EXTRA, MAX_BID_LIMIT_PRICE - start, extra));

interface Group {
  key: string;
  start: number;
  step: number;
  items: BulkBidPanelItem[];
}

/**
 * 開始価格でまとめて事前入札（v7）: PC は中央のウィンドウ、スマホは下からのシート。
 *
 * 品は「開始価格ごとのグループ」にまとまり、グループの − ◯円 ＋ でそのグループのチェック中の品を
 * まとめて上げ下げ、グループを開くと品ごとにも上げ下げできる。金額 = 開始価格 ＋ 上乗せ額。
 * items が1点のときは「上限設定」から開いた1点モード（グループ見出しなし）。
 */
export function BulkBidPanel({ open, onClose, items, checkedIds, onCheckedChange, isOpen, submitting, onSubmit, onRemove }: Props) {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const single = items.length === 1;

  /** 品ごとの上乗せ額（円） */
  const [extras, setExtras] = useState<Record<number, number>>({});
  /** グループの − ＋ で足した額（見出しの「+¥◯」） */
  const [groupExtra, setGroupExtra] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // 開くたびに初期化: 上乗せなし（入札済みの品は今の金額から）・グループは閉じた状態
  useEffect(() => {
    if (!open) return;
    const init: Record<number, number> = {};
    items.forEach((it) => { init[it.id] = Math.max(0, (it.limit_price ?? it.start_price) - it.start_price); });
    setExtras(init);
    setGroupExtra({});
    setExpanded(single ? new Set(['single']) : new Set());
  }, [open, items, single]);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<number, BulkBidPanelItem[]>();
    items.filter((it) => !it.is_other).forEach((it) => {
      const list = map.get(it.start_price) ?? [];
      list.push(it);
      map.set(it.start_price, list);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0])
      .map(([start, list]) => ({ key: single ? 'single' : String(start), start, step: stepFor(start), items: list }));
  }, [items, single]);
  const others = items.filter((it) => it.is_other);

  const selectable = items.filter((it) => !it.is_other);
  const isOn = (it: BulkBidPanelItem) => !it.is_other && checkedIds.has(it.id);
  const extraOf = (it: BulkBidPanelItem) => extras[it.id] ?? 0;
  const priceOf = (it: BulkBidPanelItem) => (isOn(it) ? it.start_price + extraOf(it) : (it.limit_price ?? it.start_price));
  const checked = selectable.filter(isOn);
  const totalDelta = checked.reduce((sum, it) => sum + extraOf(it), 0);
  const total = checked.reduce((sum, it) => sum + priceOf(it), 0);
  const uniformExtra = checked.length > 0 && checked.every((it) => extraOf(it) === extraOf(checked[0])) ? extraOf(checked[0]) : null;
  const priceLabel = uniformExtra != null ? `開始価格${uniformExtra > 0 ? `＋¥${formatYen(uniformExtra)}` : ''}` : 'それぞれの金額';

  const toggle = (id: number, on: boolean) => {
    const next = new Set(checkedIds);
    on ? next.add(id) : next.delete(id);
    onCheckedChange(next);
  };
  const toggleGroup = (g: Group, on: boolean) => {
    const next = new Set(checkedIds);
    g.items.forEach((it) => (on ? next.add(it.id) : next.delete(it.id)));
    onCheckedChange(next);
  };
  const setAll = (on: boolean) => onCheckedChange(on ? new Set(selectable.map((it) => it.id)) : new Set());

  /** グループの − ＋: そのグループのチェック中の品を一度に上げ下げ */
  const bumpGroup = (g: Group, delta: number) => {
    setGroupExtra((prev) => ({ ...prev, [g.key]: Math.max(0, (prev[g.key] ?? 0) + delta) }));
    setExtras((prev) => {
      const next = { ...prev };
      g.items.filter(isOn).forEach((it) => { next[it.id] = clampExtra((prev[it.id] ?? 0) + delta, it.start_price); });
      return next;
    });
  };
  const bumpRow = (it: BulkBidPanelItem, delta: number) => {
    setExtras((prev) => ({ ...prev, [it.id]: clampExtra((prev[it.id] ?? 0) + delta, it.start_price) }));
  };
  const toggleExpand = (key: string) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const submit = () => {
    if (checked.length === 0) return;
    onSubmit({
      limits: checked.map((it) => ({ item_id: it.id, limit_price: priceOf(it) })),
      priceLabel,
    });
  };

  const title = single ? '事前入札' : `開始価格でまとめて事前入札（${checked.length}点）`;
  const buttonLabel = single
    ? (checked.length ? `¥${formatYen(priceOf(items[0]))} で事前入札する` : '入札する品がありません')
    : (checked.length ? `${checked.length}点をそれぞれの金額で入札する` : '入札する品がありません');

  /** − ◯円 ＋ のステッパー（真ん中＝1回で上がる金額） */
  const stepper = (step: number, onDelta: (d: number) => void, disabled: boolean, canDown: boolean, canUp: boolean, label: string, size: 'group' | 'row') => {
    const h = size === 'group' ? 36 : 30;
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', border: '1.5px solid', borderColor: disabled ? 'divider' : 'success.main',
        borderRadius: h / 2 + 'px', height: h, px: 0.25, bgcolor: 'background.paper', flex: 'none' }}>
        <IconButton size="small" disabled={disabled || !canDown} onClick={() => onDelta(-step)} aria-label={`${label}−${step}円`} sx={{ p: 0.4 }}>
          <RemoveIcon sx={{ fontSize: size === 'group' ? 18 : 16 }} />
        </IconButton>
        <Typography sx={{ fontWeight: 'bold', fontSize: size === 'group' ? '0.95rem' : '0.85rem', minWidth: size === 'group' ? 38 : 32, textAlign: 'center',
          color: disabled ? 'text.disabled' : 'text.primary' }}>
          {step}円
        </Typography>
        <IconButton size="small" disabled={disabled || !canUp} onClick={() => onDelta(step)} aria-label={`${label}＋${step}円`} sx={{ p: 0.4 }}>
          <AddIcon sx={{ fontSize: size === 'group' ? 18 : 16 }} />
        </IconButton>
      </Box>
    );
  };

  const row = (it: BulkBidPanelItem, step: number) => {
    const on = isOn(it);
    const extra = extraOf(it);
    const price = priceOf(it);
    return (
      <Box key={it.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, pl: single ? 0 : 1, borderTop: '1px solid', borderColor: 'divider', opacity: on || it.is_other ? 1 : 0.55 }}>
        <Checkbox
          checked={on}
          disabled={!isOpen || it.is_other}
          onChange={(e) => toggle(it.id, e.target.checked)}
          color="success"
          inputProps={{ 'aria-label': `${it.name} を選択` }}
          sx={{ p: 0.5, '& .MuiSvgIcon-root': { fontSize: 26 } }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            <Typography variant="body2" fontWeight="bold" noWrap>{it.name}</Typography>
            {it.quantity != null && <Chip label={`${it.quantity}匹`} size="small" sx={{ height: 18, fontSize: '0.68rem', flex: 'none' }} />}
          </Box>
          {/* 出品者（一覧のカードと同じ: アイコン＋名前。匿名は「-」） */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, mt: 0.25 }}>
            <Avatar
              src={!it.is_anonymous && it.seller_profile_image_url ? it.seller_profile_image_url : undefined}
              sx={{ width: 16, height: 16, fontSize: '0.6rem', bgcolor: 'grey.300', flex: 'none' }}
            >
              {!it.is_anonymous && !it.seller_profile_image_url && (it.seller_name?.charAt(0) ?? '-')}
            </Avatar>
            <Typography variant="caption" color="text.secondary" noWrap>
              {it.is_anonymous ? '-' : (it.seller_name || '-')}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            {it.is_other
              ? '対象外（金魚・エビなど）。上限設定から個別に入札できます'
              : !on
                ? (it.limit_price != null ? `入札済 ¥${formatYen(it.limit_price)}（このまま）` : '外した')
                : (
                  <>
                    {it.limit_price != null ? `入札済 ¥${formatYen(it.limit_price)} → ` : `開始¥${formatYen(it.start_price)} `}
                    <Box component="span" sx={{ color: 'success.dark', fontWeight: 'bold' }}>+¥{formatYen(extra)}</Box>
                    {(it.limit_price != null || single) && <> ＝ ¥{formatYen(price)}</>}
                  </>
                )}
          </Typography>
        </Box>
        {!it.is_other && on && stepper(step, (d) => bumpRow(it, d), !isOpen, extra > 0, price < MAX_BID_LIMIT_PRICE, `${it.name} `, 'row')}
      </Box>
    );
  };

  const groupHeader = (g: Group) => {
    const on = g.items.filter(isOn);
    const allOn = on.length === g.items.length, noneOn = on.length === 0;
    const isExp = expanded.has(g.key);
    const gx = groupExtra[g.key] ?? 0;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, py: 0.75, bgcolor: noneOn ? 'grey.50' : 'rgba(5,150,105,0.06)' }}>
        <IconButton size="small" onClick={() => toggleExpand(g.key)} aria-label={`${isExp ? '閉じる' : '開く'} 開始価格 ¥${formatYen(g.start)}`} sx={{ p: 0.25 }}>
          {isExp ? <ArrowDropDownIcon sx={{ color: 'success.dark' }} /> : <ArrowRightIcon sx={{ color: 'success.dark' }} />}
        </IconButton>
        <Checkbox
          checked={allOn && !noneOn}
          indeterminate={!allOn && !noneOn}
          disabled={!isOpen}
          onChange={(e) => toggleGroup(g, e.target.checked)}
          color="success"
          inputProps={{ 'aria-label': `開始価格 ¥${formatYen(g.start)} を全部選択` }}
          sx={{ p: 0.5, '& .MuiSvgIcon-root': { fontSize: 28 } }}
        />
        <Box sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => toggleExpand(g.key)}>
          <Typography variant="body2" fontWeight="bold" noWrap>
            開始価格 ¥{formatYen(g.start)}/匹{' '}
            <Box component="span" sx={{ color: 'success.dark' }}>+¥{formatYen(gx)}</Box>
          </Typography>
          <Typography variant="caption" color="text.secondary">{on.length}/{g.items.length}点</Typography>
        </Box>
        {stepper(g.step, (d) => bumpGroup(g, d), !isOpen || noneOn, gx > 0, gx < MAX_EXTRA, `開始価格 ¥${formatYen(g.start)} の全部に`, 'group')}
      </Box>
    );
  };

  const body = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: isPhone ? '88vh' : '86vh' }}>
      {isPhone && <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'grey.300', mx: 'auto', mt: 1 }} />}
      <Box sx={{ px: 2.5, pt: 2, pb: 1, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight="bold">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {single
              ? '他に入札が無ければ、この額であなたが落札できます。金額は1匹あたりです。'
              : '他に入札が無ければ、その額で落札できます。要らない品はチェックを外すだけ。'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="閉じる" size="small"><CloseIcon /></IconButton>
      </Box>

      {!isOpen && (
        <Box sx={{ mx: 2.5, mb: 1 }}>
          <Chip label="まとめて事前入札の受付は終了しました（1点ずつの上限設定は開始までできます）" color="default" />
        </Box>
      )}

      {!single && (
        <Box sx={{ px: 2.5, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button size="small" variant="outlined" color="inherit" onClick={() => setAll(true)} disabled={!isOpen} sx={{ fontWeight: 'bold' }}>全選択</Button>
          <Button size="small" variant="outlined" color="inherit" onClick={() => setAll(false)} disabled={!isOpen} sx={{ fontWeight: 'bold' }}>全解除</Button>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>{selectable.length}点中 {checked.length}点</Typography>
        </Box>
      )}

      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1 }}>
        {single
          ? groups[0] && row(groups[0].items[0], groups[0].step)
          : groups.map((g) => (
            <Box key={g.key} sx={{ mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
              {groupHeader(g)}
              {expanded.has(g.key) && <Box sx={{ pr: 1 }}>{g.items.map((it) => row(it, g.step))}</Box>}
            </Box>
          ))}
        {!single && others.length > 0 && (
          <Box sx={{ mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, py: 0.75, bgcolor: 'grey.50', cursor: 'pointer' }} onClick={() => toggleExpand('other')}>
              <IconButton size="small" sx={{ p: 0.25 }} aria-label={`${expanded.has('other') ? '閉じる' : '開く'} 対象外`}>
                {expanded.has('other') ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
              </IconButton>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight="bold" color="text.secondary">対象外（金魚・エビなど）</Typography>
                <Typography variant="caption" color="text.secondary">{others.length}点・上限設定から個別に入札できます</Typography>
              </Box>
            </Box>
            {expanded.has('other') && <Box sx={{ pr: 1 }}>{others.map((it) => row(it, 1))}</Box>}
          </Box>
        )}
      </Box>

      <Box sx={{ px: 2.5, pt: 1.5, pb: isPhone ? 2.5 : 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        {!single && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2">入札する点数</Typography>
            <Typography variant="body2" fontWeight="bold">{checked.length}点</Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: single ? 0.5 : 1.5 }}>
          <Typography variant="body2">上乗せ合計</Typography>
          <Typography variant="body2" fontWeight="bold">+¥{formatYen(totalDelta)}</Typography>
        </Box>
        {single && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="body2">入札額（1匹あたり）</Typography>
            <Typography variant="h6" fontWeight="bold">¥{formatYen(total)}</Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {single && onRemove && items[0].limit_price != null && (
            <Button color="error" variant="text" onClick={() => onRemove(items[0].id)} disabled={submitting} sx={{ whiteSpace: 'nowrap' }}>取り消す</Button>
          )}
          <Button fullWidth size="large" variant="contained" color="success" onClick={submit}
            disabled={!isOpen || submitting || checked.length === 0} sx={{ fontWeight: 'bold', py: 1.25 }}>
            {submitting ? <CircularProgress size={22} color="inherit" /> : buttonLabel}
          </Button>
        </Box>
      </Box>
    </Box>
  );

  if (isPhone) {
    return (
      <Drawer anchor="bottom" open={open} onClose={() => !submitting && onClose()}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '88vh' } }}>
        {body}
      </Drawer>
    );
  }
  return (
    // PC は中央のウィンドウ（背景は薄く暗く）
    <Dialog open={open} onClose={() => !submitting && onClose()}
      PaperProps={{ sx: { width: 480, maxWidth: 'calc(100vw - 32px)', borderRadius: 3, m: 2 } }}
      slotProps={{ backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.35)' } } }}>
      {body}
    </Dialog>
  );
}
