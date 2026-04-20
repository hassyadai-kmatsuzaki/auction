import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, FormControlLabel, Switch, Stack, CircularProgress,
  Alert, Tooltip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import axios from '../../lib/axios';

interface Plan {
  id: number;
  code: string;
  name: string;
  description: string | null;
  amount: number;
  allows_bid: boolean;
  allows_sell: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface PlanFormState {
  id: number | null;
  code: string;
  name: string;
  description: string;
  amount: string;
  allows_bid: boolean;
  allows_sell: boolean;
  is_active: boolean;
  sort_order: string;
}

const emptyForm: PlanFormState = {
  id: null,
  code: '',
  name: '',
  description: '',
  amount: '',
  allows_bid: false,
  allows_sell: false,
  is_active: true,
  sort_order: '0',
};

const formatYen = (n: number) => new Intl.NumberFormat('ja-JP').format(n);

export default function PlanManagement() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<PlanFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/admin/plans');
      setPlans(res.data.data.plans);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setForm({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description ?? '',
      amount: String(plan.amount),
      allows_bid: plan.allows_bid,
      allows_sell: plan.allows_sell,
      is_active: plan.is_active,
      sort_order: String(plan.sort_order),
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    setFormErrors({});
    try {
      const payload = {
        code: form.code,
        name: form.name,
        description: form.description || null,
        amount: Number(form.amount),
        allows_bid: form.allows_bid,
        allows_sell: form.allows_sell,
        is_active: form.is_active,
        sort_order: Number(form.sort_order || 0),
      };
      if (form.id) {
        await axios.put(`/api/admin/plans/${form.id}`, payload);
      } else {
        await axios.post('/api/admin/plans', payload);
      }
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      const errs = e?.response?.data?.errors ?? null;
      if (errs) {
        const flat: Record<string, string> = {};
        Object.entries(errs).forEach(([k, v]) => { flat[k] = Array.isArray(v) ? (v as string[])[0] : String(v); });
        setFormErrors(flat);
      } else {
        setError(e?.response?.data?.message ?? '保存に失敗しました');
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (plan: Plan) => {
    if (!window.confirm(`プラン「${plan.name}」を削除します。よろしいですか？`)) return;
    try {
      await axios.delete(`/api/admin/plans/${plan.id}`);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? '削除に失敗しました');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>プラン管理（年会費）</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>プラン追加</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>コード</TableCell>
                  <TableCell>プラン名</TableCell>
                  <TableCell align="right">年会費</TableCell>
                  <TableCell>権限</TableCell>
                  <TableCell>状態</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {plans.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 4 }}>プランが登録されていません</TableCell></TableRow>
                )}
                {plans.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell><code>{p.code}</code></TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell align="right">¥{formatYen(p.amount)}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {p.allows_bid && <Chip size="small" label="落札" color="primary" />}
                        {p.allows_sell && <Chip size="small" label="出品" color="secondary" />}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={p.is_active ? '有効' : '無効'} color={p.is_active ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="編集">
                        <IconButton size="small" onClick={() => openEdit(p)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="削除">
                        <IconButton size="small" onClick={() => remove(p)}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? 'プラン編集' : 'プラン追加'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="コード *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
              helperText={formErrors.code ?? '例: bid_only / sell_only / both'} error={!!formErrors.code} fullWidth disabled={!!form.id} />
            <TextField label="プラン名 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              helperText={formErrors.name} error={!!formErrors.name} fullWidth />
            <TextField label="説明" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              multiline rows={2} fullWidth />
            <TextField label="年会費（円）*" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9]/g, '') })}
              helperText={formErrors.amount ?? '税込の年額（円）'} error={!!formErrors.amount} fullWidth inputProps={{ inputMode: 'numeric' }} />
            <FormControlLabel control={<Switch checked={form.allows_bid} onChange={(e) => setForm({ ...form, allows_bid: e.target.checked })} />} label="落札（入札）を許可" />
            <FormControlLabel control={<Switch checked={form.allows_sell} onChange={(e) => setForm({ ...form, allows_sell: e.target.checked })} />} label="出品を許可" />
            <FormControlLabel control={<Switch checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />} label="新規加入を受け付ける" />
            <TextField label="表示順" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value.replace(/[^0-9]/g, '') })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={submit} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
