import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Link,
  TextField,
  Typography,
} from '@mui/material';
import { PictureAsPdf as PdfIcon } from '@mui/icons-material';
import axios from '../../lib/axios';
import NumberField from '../../components/NumberField';

type Status = 'draft' | 'issued' | 'revoked';

interface Certificate {
  id: number;
  certificate_number: string;
  status: Status;
  breed_name: string;
  breed_type: string | null;
  fixation_rate: string | null;
  expression: string | null;
  parent_male: Record<string, string> | null;
  parent_female: Record<string, string> | null;
  lineage: Record<string, string> | null;
  breeding_notes: string | null;
  issued_at: string | null;
  verify_url: string | null;
}

const GENERATIONS = ['1世代前', '2世代前', '3世代前'] as const;

const STATUS_CHIP: Record<Status, { label: string; color: 'default' | 'success' | 'error' }> = {
  draft: { label: '下書き', color: 'default' },
  issued: { label: '発行済み', color: 'success' },
  revoked: { label: '取消済み', color: 'error' },
};

const emptyForm = {
  breed_name: '',
  breed_type: '',
  fixation_rate: '',
  expression: '',
  parent_male: '',
  parent_female: '',
  lineage: ['', '', ''] as string[],
  breeding_notes: '',
};

/** 親魚は {name: ...} で保存する（PDF・照会ページは key: value で表示） */
const toForm = (c: Certificate) => ({
  breed_name: c.breed_name,
  breed_type: c.breed_type ?? '',
  fixation_rate: c.fixation_rate != null ? String(Number(c.fixation_rate)) : '',
  expression: c.expression ?? '',
  parent_male: c.parent_male ? Object.values(c.parent_male).join(' / ') : '',
  parent_female: c.parent_female ? Object.values(c.parent_female).join(' / ') : '',
  lineage: GENERATIONS.map((g) => c.lineage?.[g] ?? ''),
  breeding_notes: c.breeding_notes ?? '',
});

interface Props {
  open: boolean;
  itemId: number;
  defaultBreedName: string;
  onClose: () => void;
}

/**
 * 生体1件の血統証明書（登録・編集→発行→PDF→取消）。生体編集画面のボタンから開く
 */
export default function PedigreeCertificateDialog({ open, itemId, defaultBreedName, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  // 連打ガード。state の busy は再描画まで反映されないため、同一フレームの2回目のタップは ref で止める
  const busyRef = useRef(false);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirm, setConfirm] = useState<'issue' | 'revoke' | null>(null);
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setMessage(null);
    setConfirm(null);
    axios.get(`/api/admin/pedigree/${itemId}`)
      .then((res) => {
        const c: Certificate | null = res.data.data;
        setCertificate(c);
        setForm(c ? toForm(c) : { ...emptyForm, breed_name: defaultBreedName });
      })
      .finally(() => setLoading(false));
  }, [open, itemId]);

  const editable = !certificate || certificate.status === 'draft';
  const isDraft = certificate?.status === 'draft';
  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const payload = () => {
    const lineage = Object.fromEntries(
      GENERATIONS.map((g, i) => [g, form.lineage[i].trim()]).filter(([, v]) => v !== ''),
    );
    return {
      breed_name: form.breed_name,
      breed_type: form.breed_type || null,
      fixation_rate: form.fixation_rate === '' ? null : Number(form.fixation_rate),
      expression: form.expression || null,
      parent_male: form.parent_male.trim() ? { name: form.parent_male.trim() } : null,
      parent_female: form.parent_female.trim() ? { name: form.parent_female.trim() } : null,
      lineage: Object.keys(lineage).length ? lineage : null,
      breeding_notes: form.breeding_notes || null,
    };
  };

  const run = async (action: () => Promise<{ data: { data: Certificate } }>, done: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const res = await action();
      setCertificate(res.data.data);
      setForm(toForm(res.data.data));
      setMessage({ severity: 'success', text: done });
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      const first = errors ? (Object.values(errors)[0] as string[])[0] : null;
      setMessage({ severity: 'error', text: first || err.response?.data?.message || '処理に失敗しました' });
    } finally {
      busyRef.current = false;
      setBusy(false);
      setConfirm(null);
    }
  };

  const handleSave = () => certificate
    ? run(() => axios.put(`/api/admin/pedigree/${certificate.id}`, payload()), '下書きを保存しました')
    : run(() => axios.post('/api/admin/pedigree', { item_id: itemId, ...payload() }), '下書きを作成しました');

  // 画面上の未保存の編集も含めて発行する
  const handleIssue = () => certificate &&
    run(async () => {
      await axios.put(`/api/admin/pedigree/${certificate.id}`, payload());
      return axios.post(`/api/admin/pedigree/${certificate.id}/issue`);
    }, '証明書を発行しました');

  const handleRevoke = () => certificate &&
    run(() => axios.post(`/api/admin/pedigree/${certificate.id}/revoke`), '証明書を取り消しました');

  const handleDownload = async () => {
    if (!certificate) return;
    const res = await axios.get(`/api/admin/pedigree/${certificate.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = isDraft ? `pedigree_draft_${certificate.id}.pdf` : `pedigree_${certificate.certificate_number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        血統証明書
        {certificate && (
          <Chip size="small" label={STATUS_CHIP[certificate.status].label} color={STATUS_CHIP[certificate.status].color} />
        )}
        {certificate && (
          <Typography variant="body2" sx={{ color: 'text.secondary', ml: 'auto' }}>
            {isDraft ? '証明書番号は発行時に付与' : certificate.certificate_number}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {message && <Alert severity={message.severity} sx={{ mb: 2 }}>{message.text}</Alert>}

            {!certificate && (
              <Alert severity="info" sx={{ mb: 2 }}>
                この生体の血統証明書はまだありません。内容を入力して下書きを作成してください。
              </Alert>
            )}
            {certificate?.status === 'issued' && certificate.verify_url && (
              <Alert severity="success" sx={{ mb: 2 }}>
                発行済みのため内容は変更できません。照会ページ：
                <Link href={certificate.verify_url} target="_blank" rel="noopener" sx={{ ml: 0.5, wordBreak: 'break-all' }}>
                  {certificate.verify_url}
                </Link>
              </Alert>
            )}
            {certificate?.status === 'revoked' && (
              <Alert severity="error" sx={{ mb: 2 }}>
                取消済みです。照会ページでは「取り消されています」と表示されます。
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth required size="small" label="品種名" value={form.breed_name} onChange={set('breed_name')} disabled={!editable} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="品種タイプ" placeholder="体外光、ラメ等" value={form.breed_type} onChange={set('breed_type')} disabled={!editable} />
              </Grid>
              <Grid item xs={12} md={4}>
                <NumberField
                  fullWidth
                  size="small"
                  label="固定率"
                  value={form.fixation_rate}
                  onValueChange={(v) => setForm({ ...form, fixation_rate: v })}
                  disabled={!editable}
                  InputProps={{ endAdornment: <Typography sx={{ color: 'text.secondary' }}>%</Typography> }}
                  inputProps={{ min: 0, max: 100 }}
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <TextField fullWidth size="small" label="表現型" value={form.expression} onChange={set('expression')} disabled={!editable} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="父魚（オス）" value={form.parent_male} onChange={set('parent_male')} disabled={!editable} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="母魚（メス）" value={form.parent_female} onChange={set('parent_female')} disabled={!editable} />
              </Grid>
              {GENERATIONS.map((g, i) => (
                <Grid item xs={12} md={4} key={g}>
                  <TextField
                    fullWidth
                    size="small"
                    label={`血統（${g}）`}
                    value={form.lineage[i]}
                    onChange={(e) => setForm({ ...form, lineage: form.lineage.map((v, j) => (j === i ? e.target.value : v)) })}
                    disabled={!editable}
                  />
                </Grid>
              ))}
              <Grid item xs={12}>
                <TextField fullWidth size="small" multiline rows={2} label="備考（PDFに記載・照会ページには出ません）" value={form.breeding_notes} onChange={set('breeding_notes')} disabled={!editable} />
              </Grid>
            </Grid>

            {confirm && (
              <Alert
                severity={confirm === 'issue' ? 'warning' : 'error'}
                sx={{ mt: 2 }}
                action={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" color="inherit" onClick={() => setConfirm(null)} disabled={busy}>やめる</Button>
                    <Button size="small" variant="contained" color={confirm === 'issue' ? 'primary' : 'error'} onClick={confirm === 'issue' ? handleIssue : handleRevoke} disabled={busy}>
                      {confirm === 'issue' ? '発行する' : '取り消す'}
                    </Button>
                  </Box>
                }
              >
                {confirm === 'issue'
                  ? '発行すると証明書番号が付与され、内容は変更できなくなります。照会ページでは「有効」と表示されます。'
                  : '取り消すと元に戻せません。照会ページで「取り消されています」と表示されます。'}
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {certificate && (
          <Button startIcon={<PdfIcon />} onClick={handleDownload} disabled={busy} sx={{ mr: 'auto' }}>
            PDF{certificate.status === 'draft' ? '（下書き）' : ''}
          </Button>
        )}
        <Button onClick={onClose} disabled={busy}>閉じる</Button>
        {editable && (
          <Button variant="outlined" onClick={handleSave} disabled={busy || loading || !form.breed_name.trim()}>
            {certificate ? '下書きを保存' : '下書きを作成'}
          </Button>
        )}
        {certificate?.status === 'draft' && (
          <Button variant="contained" onClick={() => setConfirm('issue')} disabled={busy}>発行</Button>
        )}
        {certificate?.status === 'issued' && (
          <Button variant="outlined" color="error" onClick={() => setConfirm('revoke')} disabled={busy}>取消</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
