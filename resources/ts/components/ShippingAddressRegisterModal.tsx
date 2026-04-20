import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack,
  TextField, MenuItem, Alert, CircularProgress, Typography, Box,
} from '@mui/material';
import axios from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  open: boolean;
  onCompleted: () => void;
}

const PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県',
  '岐阜県','静岡県','愛知県','三重県',
  '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
  '鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県',
  '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県',
];

interface Form {
  name: string;
  phone: string;
  postal_code: string;
  prefecture: string;
  city: string;
  address_line1: string;
  address_line2: string;
}

export default function ShippingAddressRegisterModal({ open, onCompleted }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<Form>({
    name: '',
    phone: '',
    postal_code: '',
    prefecture: '',
    city: '',
    address_line1: '',
    address_line2: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      setForm({
        name: user.name ?? '',
        phone: user.phone ?? '',
        postal_code: user.postal_code ?? '',
        prefecture: user.prefecture ?? '',
        city: user.city ?? '',
        address_line1: user.address_line1 ?? '',
        address_line2: user.address_line2 ?? '',
      });
    }
  }, [open, user]);

  const setField = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [k]: e.target.value }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!form.name.trim()) e.name = '氏名を入力してください';
    if (!form.phone.trim()) e.phone = '電話番号を入力してください';
    else if (form.phone.length > 20) e.phone = '20文字以内で入力してください';
    if (!form.postal_code.trim()) e.postal_code = '郵便番号を入力してください';
    else if (!/^\d{3}-?\d{4}$/.test(form.postal_code)) e.postal_code = '郵便番号の形式が正しくありません（例: 100-0001）';
    if (!form.prefecture) e.prefecture = '都道府県を選択してください';
    if (!form.city.trim()) e.city = '市区町村を入力してください';
    else if (form.city.length > 100) e.city = '100文字以内で入力してください';
    if (!form.address_line1.trim()) e.address_line1 = '番地・建物名を入力してください';
    else if (form.address_line1.length > 255) e.address_line1 = '255文字以内で入力してください';
    if (form.address_line2 && form.address_line2.length > 255) e.address_line2 = '255文字以内で入力してください';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    setApiError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await axios.put('/api/participant/settings/profile', form);
      onCompleted();
    } catch (e: any) {
      const errs = e?.response?.data?.errors;
      if (errs && typeof errs === 'object') {
        const mapped: Partial<Record<keyof Form, string>> = {};
        for (const [k, v] of Object.entries(errs)) {
          mapped[k as keyof Form] = Array.isArray(v) ? (v[0] as string) : String(v);
        }
        setErrors(mapped);
      }
      setApiError(e?.response?.data?.message ?? '配送先住所の登録に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => { /* 閉じさせない */ }}
      fullWidth
      maxWidth="sm"
      disableEscapeKeyDown
      // 背景はブラー（システム全体の操作をブロック）
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
          },
        },
      }}
      // 画面外クリックでも閉じない（onClose を空関数にしている上で念のため）
    >
      <DialogTitle sx={{ pb: 1 }}>配送先住所の登録</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="warning">
            落札商品の発送に必要なため、サービスを利用する前に配送先住所のご登録をお願いします。
          </Alert>

          {apiError && <Alert severity="error">{apiError}</Alert>}

          <TextField
            label="お名前（受取人）"
            value={form.name}
            onChange={setField('name')}
            error={!!errors.name}
            helperText={errors.name}
            required
            fullWidth
            disabled={submitting}
          />
          <TextField
            label="電話番号"
            value={form.phone}
            onChange={setField('phone')}
            error={!!errors.phone}
            helperText={errors.phone}
            required
            fullWidth
            placeholder="例: 09012345678"
            disabled={submitting}
          />
          <TextField
            label="郵便番号"
            value={form.postal_code}
            onChange={setField('postal_code')}
            error={!!errors.postal_code}
            helperText={errors.postal_code}
            required
            placeholder="例: 100-0001"
            sx={{ maxWidth: 220 }}
            disabled={submitting}
          />
          <TextField
            select
            label="都道府県"
            value={form.prefecture}
            onChange={setField('prefecture')}
            error={!!errors.prefecture}
            helperText={errors.prefecture}
            required
            fullWidth
            disabled={submitting}
          >
            <MenuItem value=""><em>選択してください</em></MenuItem>
            {PREFECTURES.map((p) => (
              <MenuItem key={p} value={p}>{p}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="市区町村"
            value={form.city}
            onChange={setField('city')}
            error={!!errors.city}
            helperText={errors.city}
            required
            fullWidth
            disabled={submitting}
          />
          <TextField
            label="番地"
            value={form.address_line1}
            onChange={setField('address_line1')}
            error={!!errors.address_line1}
            helperText={errors.address_line1}
            required
            fullWidth
            disabled={submitting}
          />
          <TextField
            label="建物名・部屋番号（任意）"
            value={form.address_line2}
            onChange={setField('address_line2')}
            error={!!errors.address_line2}
            helperText={errors.address_line2}
            fullWidth
            disabled={submitting}
          />

          <Box>
            <Typography variant="caption" color="text.secondary">
              ※ 登録後も「設定 → プロフィール」から変更できます。
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} /> : undefined}
          fullWidth
          size="large"
        >
          {submitting ? '登録中…' : '配送先住所を登録する'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
