import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControlLabel, Switch, Alert, CircularProgress, Snackbar, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  ArrowUpward as UpIcon, ArrowDownward as DownIcon,
} from '@mui/icons-material';
import { adminSpeciesNameApi, type SpeciesName } from '@/api/admin/speciesNameApi';

type EditState = { id: number | null; name: string; is_active: boolean };

export default function SpeciesNameManagement() {
  const [names, setNames] = useState<SpeciesName[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setNames(await adminSpeciesNameApi.list());
    } catch {
      setSnackbar({ msg: '品種名の取得に失敗しました', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => setEdit({ id: null, name: '', is_active: true });
  const openEdit = (n: SpeciesName) => setEdit({ id: n.id, name: n.name, is_active: n.is_active });

  const handleSave = async () => {
    if (!edit) return;
    const name = edit.name.trim();
    if (!name) {
      setSnackbar({ msg: '品種名を入力してください', severity: 'error' });
      return;
    }
    setSaving(true);
    try {
      if (edit.id === null) {
        await adminSpeciesNameApi.create({ name, is_active: edit.is_active });
        setSnackbar({ msg: '品種名を追加しました', severity: 'success' });
      } else {
        await adminSpeciesNameApi.update(edit.id, { name, is_active: edit.is_active });
        setSnackbar({ msg: '品種名を更新しました', severity: 'success' });
      }
      setEdit(null);
      load();
    } catch (e: any) {
      const errors = e?.response?.data?.errors;
      const msg = errors ? Object.values(errors).flat().join('\n') : '保存に失敗しました（重複している可能性があります）';
      setSnackbar({ msg, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (n: SpeciesName) => {
    if (!confirm(`「${n.name}」を削除しますか？`)) return;
    try {
      await adminSpeciesNameApi.remove(n.id);
      setSnackbar({ msg: '削除しました', severity: 'success' });
      load();
    } catch {
      setSnackbar({ msg: '削除に失敗しました', severity: 'error' });
    }
  };

  // 並び替え（隣と sort_order を入れ替えて reorder 送信）
  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= names.length) return;
    const reordered = [...names];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setNames(reordered);
    try {
      await adminSpeciesNameApi.reorder(reordered.map((n, i) => ({ id: n.id, sort_order: i })));
    } catch {
      setSnackbar({ msg: '並び替えに失敗しました', severity: 'error' });
      load();
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>品種名（生体名）マスタ管理</Typography>
          <Typography variant="body2" color="text.secondary">
            出品申込フォームの品種名入力で表示される変換候補を管理します。出品者は候補を選んでも、自由に編集することもできます。
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>品種名を追加</Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : names.length === 0 ? (
        <Alert severity="info">品種名がまだ登録されていません。「品種名を追加」から登録してください。</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600, width: 80 }}>並び順</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>品種名</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 100 }}>状態</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 120 }} align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {names.map((n, index) => (
                <TableRow key={n.id} hover>
                  <TableCell>
                    <IconButton size="small" disabled={index === 0} onClick={() => move(index, -1)} aria-label="上へ">
                      <UpIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" disabled={index === names.length - 1} onClick={() => move(index, 1)} aria-label="下へ">
                      <DownIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{n.name}</TableCell>
                  <TableCell>
                    {n.is_active
                      ? <Chip label="有効" size="small" color="success" />
                      : <Chip label="無効" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="編集">
                      <IconButton size="small" onClick={() => openEdit(n)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="削除">
                      <IconButton size="small" sx={{ color: 'error.main' }} onClick={() => handleDelete(n)}><DeleteIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 追加・編集ダイアログ */}
      <Dialog open={edit !== null} onClose={() => setEdit(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{edit?.id === null ? '品種名を追加' : '品種名を編集'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="品種名"
            value={edit?.name ?? ''}
            onChange={(e) => setEdit((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
            placeholder="例: 紅白ラメ、幹之フルボディ"
            sx={{ mt: 2 }}
          />
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Switch
                checked={edit?.is_active ?? true}
                onChange={(e) => setEdit((prev) => (prev ? { ...prev, is_active: e.target.checked } : prev))}
              />
            }
            label="有効（出品フォームの候補に表示する）"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEdit(null)}>キャンセル</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>保存</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar !== null}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)} sx={{ whiteSpace: 'pre-line' }}>{snackbar.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
