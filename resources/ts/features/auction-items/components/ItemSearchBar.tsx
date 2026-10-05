import { useEffect, useState } from 'react';
import {
  Box, Button, Chip, FormControl, InputLabel, MenuItem, Select, TextField, Typography,
} from '@mui/material';
import { StarBorder as StarBorderIcon } from '@mui/icons-material';
import axios from '../../../lib/axios';

/** 出品一覧の検索条件（F-042）。保存するとこの形のまま saved_searches.conditions に入る（F-043） */
export interface ItemSearchConditions {
  keyword: string;
  price: string;
  sort: 'default' | 'popular' | 'price_asc' | 'price_desc';
}

export const EMPTY_CONDITIONS: ItemSearchConditions = { keyword: '', price: 'all', sort: 'default' };

/** 開始価格の帯（value は「下限-上限」。上限なしは空） */
export const PRICE_RANGES: { value: string; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: '0-999', label: '〜999円' },
  { value: '1000-2999', label: '1,000〜2,999円' },
  { value: '3000-4999', label: '3,000〜4,999円' },
  { value: '5000-9999', label: '5,000〜9,999円' },
  { value: '10000-', label: '10,000円〜' },
];

const SORTS: { value: ItemSearchConditions['sort']; label: string }[] = [
  { value: 'default', label: '出品順' },
  { value: 'popular', label: '人気順（お気に入り数）' },
  { value: 'price_asc', label: '開始価格の安い順' },
  { value: 'price_desc', label: '開始価格の高い順' },
];

interface SavedSearch {
  id: number;
  name: string;
  conditions: Partial<ItemSearchConditions>;
}

const describe = (c: ItemSearchConditions) => [
  c.keyword.trim(),
  c.price !== 'all' ? PRICE_RANGES.find((r) => r.value === c.price)?.label : null,
  c.sort !== 'default' ? SORTS.find((s) => s.value === c.sort)?.label.replace('（お気に入り数）', '') : null,
].filter(Boolean).join('・');

interface Props {
  value: ItemSearchConditions;
  onChange: (next: ItemSearchConditions) => void;
}

export default function ItemSearchBar({ value, onChange }: Props) {
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [saving, setSaving] = useState(false);
  const isEmpty = describe(value) === '';

  useEffect(() => {
    axios.get('/api/participant/saved-searches', { silent: true })
      .then((res) => setSaved(res.data.data ?? []))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (isEmpty || saving) return;
    setSaving(true);
    try {
      const res = await axios.post('/api/participant/saved-searches', { name: describe(value), conditions: value });
      setSaved((prev) => [res.data.data, ...prev]);
    } catch {
      // 上限（20件）などのエラーはインターセプタがトースト表示する
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/participant/saved-searches/${id}`);
      setSaved((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // インターセプタがトースト表示する
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          label="品種名で検索"
          value={value.keyword}
          onChange={(e) => onChange({ ...value, keyword: e.target.value })}
          sx={{ minWidth: 200 }}
        />
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="item-search-price-label">価格帯</InputLabel>
          <Select labelId="item-search-price-label" label="価格帯" value={value.price} onChange={(e) => onChange({ ...value, price: e.target.value })}>
            {PRICE_RANGES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 210 }}>
          <InputLabel id="item-search-sort-label">並び順</InputLabel>
          <Select labelId="item-search-sort-label" label="並び順" value={value.sort} onChange={(e) => onChange({ ...value, sort: e.target.value as ItemSearchConditions['sort'] })}>
            {SORTS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
          </Select>
        </FormControl>
        <Button size="small" variant="outlined" startIcon={<StarBorderIcon />} onClick={handleSave} disabled={isEmpty || saving}>
          この条件を保存
        </Button>
        {!isEmpty && (
          <Button size="small" variant="text" onClick={() => onChange(EMPTY_CONDITIONS)}>条件をクリア</Button>
        )}
      </Box>
      {saved.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mt: 1.5 }}>
          <Typography variant="body2" color="text.secondary">保存した条件：</Typography>
          {saved.map((s) => (
            <Chip
              key={s.id}
              size="small"
              label={s.name}
              onClick={() => onChange({ ...EMPTY_CONDITIONS, ...s.conditions })}
              onDelete={() => handleDelete(s.id)}
              sx={{ bgcolor: '#EEF2FF', color: '#4338CA', fontWeight: 600 }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
