import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  TextField,
  Chip,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import axios from '../../lib/axios';

export interface PickerUser {
  id: number;
  name: string;
  email: string;
  trade_name?: string | null;
}

interface Props {
  value: PickerUser[];
  onChange: (users: PickerUser[]) => void;
  /** どのロールで絞るか。空なら全ロール */
  roleFilter?: 'admin' | 'seller' | 'participant' | '';
  label?: string;
  placeholder?: string;
  /** 1度に取得する候補件数（per_page） */
  perPage?: number;
}

/**
 * 名前/メールで検索してユーザーを複数選択するピッカー。
 *
 * - 入力はデバウンス（300ms）して `/api/admin/users?search=...` に投げる
 * - 選択済みは Autocomplete の Chip + 下部の選択リストでも見える化
 * - 既に選択済みのユーザーは候補一覧に出ても visually disabled にする（誤って二重選択しても uniq で吸収）
 */
export default function MultiUserPicker({
  value,
  onChange,
  roleFilter = '',
  label = 'ユーザーを検索（名前・メール）',
  placeholder = '名前またはメールアドレスで検索',
  perPage = 20,
}: Props) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<PickerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  const selectedIds = useMemo(() => new Set(value.map((u) => u.id)), [value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open) return;

    const term = inputValue.trim();
    debounceRef.current = setTimeout(async () => {
      const myReqId = ++reqIdRef.current;
      setLoading(true);
      try {
        const params = new URLSearchParams({ per_page: String(perPage) });
        if (term) params.append('search', term);
        if (roleFilter) params.append('role', roleFilter);
        const res = await axios.get(`/api/admin/users?${params.toString()}`);
        if (myReqId !== reqIdRef.current) return; // 古いレスは捨てる
        const list = (res.data?.data?.data ?? []) as Array<{ id: number; name: string; email: string; trade_name?: string | null }>;
        setOptions(list.map((u) => ({ id: u.id, name: u.name, email: u.email, trade_name: u.trade_name })));
      } catch {
        if (myReqId === reqIdRef.current) setOptions([]);
      } finally {
        if (myReqId === reqIdRef.current) setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, open, roleFilter, perPage]);

  return (
    <Box>
      <Autocomplete<PickerUser, true>
        multiple
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        value={value}
        onChange={(_, next) => {
          // id で uniq
          const map = new Map<number, PickerUser>();
          next.forEach((u) => map.set(u.id, u));
          onChange(Array.from(map.values()));
        }}
        inputValue={inputValue}
        onInputChange={(_, v) => setInputValue(v)}
        options={options}
        loading={loading}
        getOptionLabel={(o) => `${o.name} <${o.email}>`}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        filterOptions={(x) => x}
        // 入力が空でも候補を見せる
        filterSelectedOptions={false}
        getOptionDisabled={(o) => selectedIds.has(o.id)}
        renderOption={(props, option) => (
          <li {...props} key={option.id}>
            <Box>
              <Typography variant="body2">
                {option.name}
                {option.trade_name && (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    （{option.trade_name}）
                  </Typography>
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">{option.email}</Typography>
            </Box>
          </li>
        )}
        renderTags={(tagValue, getTagProps) =>
          tagValue.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
              key={option.id}
              label={`${option.name} <${option.email}>`}
              size="small"
            />
          ))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={value.length === 0 ? placeholder : ''}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={18} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
      {value.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {value.length} 人を選択中
        </Typography>
      )}
    </Box>
  );
}
