import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import {
  lpCvrApi,
  type LpCvrIndexResponse,
  type LpCvrPayload,
  type LpCvrSetting,
  type LpType,
} from '@/api/admin/lpCvrApi';

const LP_TABS: { value: LpType; label: string; path: string }[] = [
  { value: 'buyer', label: '買受者LP（/buyer）', path: '/buyer' },
  { value: 'seller', label: '出品者LP（/seller）', path: '/seller' },
];

const RID_REGEX = /^[A-Za-z0-9_-]+$/;

type FormState = {
  rid: string;
  cta_url: string;
  note: string;
};

const emptyForm: FormState = { rid: '', cta_url: '', note: '' };

type FieldErrors = Partial<Record<keyof FormState, string>>;

export default function LpCvrSettings() {
  const [lpType, setLpType] = useState<LpType>('buyer');
  const [data, setData] = useState<LpCvrIndexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [defaultDraft, setDefaultDraft] = useState('');
  const [defaultSaving, setDefaultSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<LpCvrSetting | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formSaving, setFormSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const load = async (target: LpType) => {
    setLoading(true);
    try {
      const res = await lpCvrApi.list(target);
      setData(res);
      setDefaultDraft(res.default_cta_url ?? '');
    } catch {
      setSnackbar({ msg: 'LP CVR設定の取得に失敗しました', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(lpType);
  }, [lpType]);

  const openNew = () => {
    setForm(emptyForm);
    setFormErrors({});
    setEditTarget('new');
  };

  const openEdit = (row: LpCvrSetting) => {
    setForm({ rid: row.rid, cta_url: row.cta_url, note: row.note ?? '' });
    setFormErrors({});
    setEditTarget(row);
  };

  const closeDialog = () => {
    if (formSaving) return;
    setEditTarget(null);
    setFormErrors({});
  };

  const validateForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!form.rid) {
      errors.rid = 'rid は必須です';
    } else if (form.rid.length > 64) {
      errors.rid = 'rid は64文字以内で入力してください';
    } else if (!RID_REGEX.test(form.rid)) {
      errors.rid = '半角英数・ハイフン・アンダースコアのみ使用できます';
    }

    if (!form.cta_url) {
      errors.cta_url = 'CTA URL は必須です';
    } else if (!/^https:\/\//.test(form.cta_url)) {
      errors.cta_url = 'https:// で始まる URL を入力してください';
    } else if (form.cta_url.length > 512) {
      errors.cta_url = 'CTA URL は512文字以内で入力してください';
    }

    if (form.note && form.note.length > 255) {
      errors.note = '備考は255文字以内で入力してください';
    }

    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload: LpCvrPayload = {
      rid: form.rid,
      cta_url: form.cta_url,
      note: form.note ? form.note : null,
    };

    setFormSaving(true);
    try {
      if (editTarget === 'new') {
        await lpCvrApi.create(lpType, payload);
        setSnackbar({ msg: '登録しました', severity: 'success' });
      } else if (editTarget) {
        await lpCvrApi.update(lpType, editTarget.id, payload);
        setSnackbar({ msg: '更新しました', severity: 'success' });
      }
      setEditTarget(null);
      await load(lpType);
    } catch (e: unknown) {
      const errResponse = (e as { response?: { data?: { errors?: Record<string, string[]> } } }).response;
      const serverErrors = errResponse?.data?.errors;
      if (serverErrors) {
        const mapped: FieldErrors = {};
        (Object.keys(serverErrors) as (keyof FormState)[]).forEach((key) => {
          mapped[key] = serverErrors[key]?.[0];
        });
        setFormErrors(mapped);
      } else {
        setSnackbar({ msg: '保存に失敗しました', severity: 'error' });
      }
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (row: LpCvrSetting) => {
    if (!confirm(`rid: ${row.rid} を削除しますか？`)) return;
    try {
      await lpCvrApi.remove(lpType, row.id);
      setSnackbar({ msg: '削除しました', severity: 'success' });
      await load(lpType);
    } catch {
      setSnackbar({ msg: '削除に失敗しました', severity: 'error' });
    }
  };

  const handleSaveDefault = async () => {
    if (defaultDraft && !/^https:\/\//.test(defaultDraft)) {
      setSnackbar({ msg: 'デフォルトCTA URL は https:// で始める必要があります', severity: 'error' });
      return;
    }
    setDefaultSaving(true);
    try {
      const res = await lpCvrApi.updateDefault(lpType, defaultDraft);
      setSnackbar({ msg: 'デフォルトCTA URL を保存しました', severity: 'success' });
      setData((prev) => (prev ? { ...prev, default_cta_url: res.default_cta_url } : prev));
    } catch {
      setSnackbar({ msg: 'デフォルトCTA URL の保存に失敗しました', severity: 'error' });
    } finally {
      setDefaultSaving(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSnackbar({ msg: 'コピーしました', severity: 'success' });
    } catch {
      setSnackbar({ msg: 'コピーに失敗しました', severity: 'error' });
    }
  };

  const previewBase = data?.preview_base_url ?? '';
  const defaultIsDirty = useMemo(
    () => (data ? defaultDraft !== (data.default_cta_url ?? '') : false),
    [data, defaultDraft],
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>LP CVR設定</Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        買受者LP（<code>/buyer</code>）と出品者LP（<code>/seller</code>）の CTA（LINE追加ボタン）の遷移先を、
        URL クエリ <code>?rid=xxx</code> 単位で出し分けるための設定です。
        rid が未指定・未登録の場合はデフォルトCTA URL にフォールバックします。
      </Alert>

      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={lpType}
          onChange={(_, v) => setLpType(v as LpType)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {LP_TABS.map((t) => (
            <Tab key={t.value} value={t.value} label={t.label} />
          ))}
        </Tabs>
      </Paper>

      {loading || !data ? (
        <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
      ) : (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              デフォルトCTA URL
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              rid が未指定または下表に未登録の訪問者に表示する CTA URL。
              空欄で保存すると、LP 側のフェイルセーフ値（<code>{data.failsafe_cta_url}</code>）が使われます。
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <TextField
                fullWidth
                size="small"
                value={defaultDraft}
                onChange={(e) => setDefaultDraft(e.target.value)}
                placeholder="https://liff.line.me/..."
              />
              <Button
                variant="contained"
                onClick={handleSaveDefault}
                disabled={defaultSaving || !defaultIsDirty}
              >
                保存
              </Button>
            </Stack>
          </Paper>

          <Paper>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                rid 別 CTA 設定（{data.items.length} 件）
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
                新規追加
              </Button>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 160 }}>rid</TableCell>
                    <TableCell>CTA URL</TableCell>
                    <TableCell sx={{ width: 200 }}>備考</TableCell>
                    <TableCell sx={{ width: 280 }}>プレビューURL</TableCell>
                    <TableCell sx={{ width: 140 }} align="right">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        登録されている rid はまだありません。
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.items.map((row) => {
                      const previewUrl = `${previewBase}?rid=${encodeURIComponent(row.rid)}`;
                      return (
                        <TableRow key={row.id}>
                          <TableCell>{row.rid}</TableCell>
                          <TableCell>
                            <Tooltip title={row.cta_url} placement="top-start">
                              <Box
                                component="a"
                                href={row.cta_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{
                                  display: 'inline-block',
                                  maxWidth: 360,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  verticalAlign: 'middle',
                                }}
                              >
                                {row.cta_url}
                              </Box>
                            </Tooltip>
                          </TableCell>
                          <TableCell>{row.note ?? ''}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Box
                                component="span"
                                sx={{
                                  display: 'inline-block',
                                  maxWidth: 200,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontSize: 12,
                                  color: 'text.secondary',
                                }}
                              >
                                {previewUrl}
                              </Box>
                              <Tooltip title="プレビューURLをコピー">
                                <IconButton size="small" onClick={() => handleCopy(previewUrl)}>
                                  <ContentCopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="新規タブで開く">
                                <IconButton
                                  size="small"
                                  component="a"
                                  href={previewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <OpenInNewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" onClick={() => openEdit(row)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={() => handleDelete(row)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      <Dialog open={editTarget !== null} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {editTarget === 'new' ? 'rid 別 CTA 設定の新規追加' : 'rid 別 CTA 設定の編集'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="rid"
              fullWidth
              value={form.rid}
              onChange={(e) => setForm({ ...form, rid: e.target.value })}
              helperText={formErrors.rid ?? '半角英数・ハイフン・アンダースコアのみ / 最大64文字'}
              error={!!formErrors.rid}
              inputProps={{ maxLength: 64 }}
            />
            <TextField
              label="CTA URL（LINE追加URL等）"
              fullWidth
              value={form.cta_url}
              onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
              helperText={formErrors.cta_url ?? 'https:// で始まる URL / 最大512文字'}
              error={!!formErrors.cta_url}
              placeholder="https://liff.line.me/..."
              inputProps={{ maxLength: 512 }}
            />
            <TextField
              label="備考"
              fullWidth
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              helperText={formErrors.note ?? '媒体名・キャンペーン名などの管理メモ（任意 / 最大255文字）'}
              error={!!formErrors.note}
              inputProps={{ maxLength: 255 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={formSaving}>キャンセル</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={formSaving}>
            {editTarget === 'new' ? '登録' : '更新'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert
            onClose={() => setSnackbar(null)}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
