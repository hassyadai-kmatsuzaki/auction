import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, Checkbox, FormGroup,
  Tabs, Tab, Alert, CircularProgress, Snackbar,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Settings as SettingsIcon } from '@mui/icons-material';
import {
  adminSpeciesTypeApi,
  type SpeciesType, type BagSpec, type BoxCapacity, type BagMixRestriction, type QuantityUnit,
} from '@/api/admin/speciesTypeApi';

const UNIT_OPTIONS: { value: QuantityUnit; label: string }[] = [
  { value: 'fish', label: '匹' },
  { value: 'kg', label: 'kg' },
  { value: 'bag', label: '袋' },
];

const BOX_SIZES = [80, 100, 140];

export default function SpeciesTypeManagement() {
  const [types, setTypes] = useState<SpeciesType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<SpeciesType | 'new' | null>(null);
  const [detailTarget, setDetailTarget] = useState<SpeciesType | null>(null);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setTypes(await adminSpeciesTypeApi.list());
    } catch (e: unknown) {
      setSnackbar({ msg: '種別の取得に失敗しました', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('この種別を無効化しますか？')) return;
    try {
      await adminSpeciesTypeApi.remove(id);
      setSnackbar({ msg: '無効化しました', severity: 'success' });
      load();
    } catch {
      setSnackbar({ msg: '削除に失敗しました', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>種別マスタ管理</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditTarget('new')}>
          新規作成
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        メダカや水草・金魚などの生体カテゴリをここで管理します。<br />
        「auto」種別は袋・箱・混載マスタに基づき送料を自動計算。「manual」種別（その他）は管理者が送料を手動入力します。
      </Alert>

      <Paper>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>並び順</TableCell>
                  <TableCell>コード</TableCell>
                  <TableCell>表示名</TableCell>
                  <TableCell>計算方式</TableCell>
                  <TableCell>許容単位</TableCell>
                  <TableCell>デフォルト</TableCell>
                  <TableCell>混載可</TableCell>
                  <TableCell>有効</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {types.map((t) => (
                  <TableRow key={t.id} hover>
                    <TableCell>{t.sort_order}</TableCell>
                    <TableCell><code>{t.code}</code></TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>
                      <Chip label={t.calculation_mode} color={t.calculation_mode === 'auto' ? 'primary' : 'default'} size="small" />
                    </TableCell>
                    <TableCell>
                      {(t.allowed_quantity_units ?? []).map((u) => UNIT_OPTIONS.find((o) => o.value === u)?.label).join(' / ')}
                    </TableCell>
                    <TableCell>{t.is_default ? '★' : ''}</TableCell>
                    <TableCell>{t.is_mixable ? '✓' : ''}</TableCell>
                    <TableCell>{t.is_active ? '✓' : <Chip label="無効" size="small" />}</TableCell>
                    <TableCell align="right">
                      {t.calculation_mode === 'auto' && (
                        <IconButton size="small" onClick={() => setDetailTarget(t)} title="袋・箱・混載">
                          <SettingsIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton size="small" onClick={() => setEditTarget(t)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(t.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {editTarget && (
        <SpeciesTypeEditDialog
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load(); setSnackbar({ msg: '保存しました', severity: 'success' }); }}
          onError={(msg) => setSnackbar({ msg, severity: 'error' })}
        />
      )}

      {detailTarget && (
        <SpeciesMastersDialog
          species={detailTarget}
          onClose={() => setDetailTarget(null)}
          onSaved={() => setSnackbar({ msg: '更新しました', severity: 'success' })}
        />
      )}

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        message={snackbar?.msg}
      />
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────
// 種別本体の作成・編集
// ─────────────────────────────────────────────────────────────

interface EditDialogProps {
  target: SpeciesType | 'new';
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}

function SpeciesTypeEditDialog({ target, onClose, onSaved, onError }: EditDialogProps) {
  const isNew = target === 'new';
  const initial: Partial<SpeciesType> = isNew
    ? {
        code: '', name: '', calculation_mode: 'auto', is_mixable: false,
        is_default: false, is_active: true, allowed_quantity_units: ['fish'], sort_order: 99,
      }
    : { ...target };

  const [form, setForm] = useState<Partial<SpeciesType>>(initial);
  const [saving, setSaving] = useState(false);

  const toggleUnit = (u: QuantityUnit) => {
    const units = new Set(form.allowed_quantity_units ?? []);
    if (units.has(u)) units.delete(u); else units.add(u);
    setForm({ ...form, allowed_quantity_units: Array.from(units) as QuantityUnit[] });
  };

  const handleSave = async () => {
    if (!form.code || !form.name) {
      onError('コードと表示名は必須です');
      return;
    }
    if (!(form.allowed_quantity_units ?? []).length) {
      onError('許容単位を 1 つ以上選択してください');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await adminSpeciesTypeApi.create(form);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { code, ...rest } = form;
        await adminSpeciesTypeApi.update((target as SpeciesType).id, rest);
      }
      onSaved();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msg = err.response?.data?.message
        ?? Object.values(err.response?.data?.errors ?? {}).flat().join(' ')
        ?? '保存に失敗しました';
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isNew ? '種別を新規作成' : `種別「${(target as SpeciesType).name}」を編集`}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="コード（半角英数・アンダースコア、保存後は変更不可）"
            value={form.code ?? ''}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            disabled={!isNew}
            fullWidth
          />
          <TextField
            label="表示名"
            value={form.name ?? ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>計算方式</InputLabel>
            <Select
              label="計算方式"
              value={form.calculation_mode ?? 'auto'}
              onChange={(e) => setForm({ ...form, calculation_mode: e.target.value as 'auto' | 'manual' })}
            >
              <MenuItem value="auto">auto（袋・箱マスタから自動計算）</MenuItem>
              <MenuItem value="manual">manual（手動で送料入力）</MenuItem>
            </Select>
          </FormControl>
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>許容する数量単位</Typography>
            <FormGroup row>
              {UNIT_OPTIONS.map((o) => (
                <FormControlLabel
                  key={o.value}
                  control={
                    <Checkbox
                      checked={(form.allowed_quantity_units ?? []).includes(o.value)}
                      onChange={() => toggleUnit(o.value)}
                    />
                  }
                  label={o.label}
                />
              ))}
            </FormGroup>
          </Box>
          <TextField
            label="並び順"
            type="number"
            value={form.sort_order ?? 0}
            onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value, 10) })}
          />
          <FormControlLabel
            control={<Switch checked={!!form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />}
            label="出品フォームの初期値に使う"
          />
          <FormControlLabel
            control={<Switch checked={!!form.is_mixable} onChange={(e) => setForm({ ...form, is_mixable: e.target.checked })} />}
            label="他の auto 種別と同一箱に混載可"
          />
          <FormControlLabel
            control={<Switch checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />}
            label="有効（出品セレクトに表示）"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={20} /> : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// 袋・箱・混載 の編集タブ
// ─────────────────────────────────────────────────────────────

interface MastersDialogProps {
  species: SpeciesType;
  onClose: () => void;
  onSaved: () => void;
}

function SpeciesMastersDialog({ species, onClose, onSaved }: MastersDialogProps) {
  const [tab, setTab] = useState(0);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{species.name}（{species.code}）の配送マスタ</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="袋マスタ" />
          <Tab label="箱入数" />
          <Tab label="混載制約" />
        </Tabs>
        {tab === 0 && <BagSpecsTab speciesId={species.id} onSaved={onSaved} />}
        {tab === 1 && <BoxCapacitiesTab speciesId={species.id} onSaved={onSaved} />}
        {tab === 2 && <MixRestrictionsTab speciesId={species.id} onSaved={onSaved} />}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>閉じる</Button></DialogActions>
    </Dialog>
  );
}

function BagSpecsTab({ speciesId, onSaved }: { speciesId: number; onSaved: () => void }) {
  const [rows, setRows] = useState<BagSpec[]>([]);
  const [draft, setDraft] = useState({ bag_size: '', model: '', min_qty: '', max_qty: '', weight_kg: '' });
  const load = async () => setRows(await adminSpeciesTypeApi.bagSpecs.list(speciesId));
  useEffect(() => { load(); }, [speciesId]);

  const handleAdd = async () => {
    if (!draft.bag_size || !draft.min_qty || !draft.weight_kg) return;
    await adminSpeciesTypeApi.bagSpecs.create(speciesId, {
      bag_size: draft.bag_size,
      model: draft.model || null,
      min_qty: parseInt(draft.min_qty, 10),
      max_qty: draft.max_qty ? parseInt(draft.max_qty, 10) : null,
      weight_kg: parseFloat(draft.weight_kg),
    });
    setDraft({ bag_size: '', model: '', min_qty: '', max_qty: '', weight_kg: '' });
    await load(); onSaved();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('削除しますか？')) return;
    await adminSpeciesTypeApi.bagSpecs.remove(speciesId, id);
    await load(); onSaved();
  };

  return (
    <Box>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>袋サイズ</TableCell>
              <TableCell>品番</TableCell>
              <TableCell>最小数量</TableCell>
              <TableCell>最大数量</TableCell>
              <TableCell>重量(kg)</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.bag_size}</TableCell>
                <TableCell>{r.model ?? ''}</TableCell>
                <TableCell>{r.min_qty}</TableCell>
                <TableCell>{r.max_qty ?? '∞'}</TableCell>
                <TableCell>{r.weight_kg}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleDelete(r.id)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell><TextField size="small" value={draft.bag_size} onChange={(e) => setDraft({ ...draft, bag_size: e.target.value })} /></TableCell>
              <TableCell><TextField size="small" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} /></TableCell>
              <TableCell><TextField size="small" type="number" value={draft.min_qty} onChange={(e) => setDraft({ ...draft, min_qty: e.target.value })} /></TableCell>
              <TableCell><TextField size="small" type="number" value={draft.max_qty} onChange={(e) => setDraft({ ...draft, max_qty: e.target.value })} /></TableCell>
              <TableCell><TextField size="small" type="number" inputProps={{ step: 0.1 }} value={draft.weight_kg} onChange={(e) => setDraft({ ...draft, weight_kg: e.target.value })} /></TableCell>
              <TableCell align="right"><Button size="small" onClick={handleAdd}>追加</Button></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function BoxCapacitiesTab({ speciesId, onSaved }: { speciesId: number; onSaved: () => void }) {
  const [rows, setRows] = useState<BoxCapacity[]>([]);
  const [bagSizes, setBagSizes] = useState<string[]>([]);
  const load = async () => {
    const [caps, specs] = await Promise.all([
      adminSpeciesTypeApi.boxCapacities.list(speciesId),
      adminSpeciesTypeApi.bagSpecs.list(speciesId),
    ]);
    setRows(caps);
    setBagSizes(specs.map((s) => s.bag_size));
  };
  useEffect(() => { load(); }, [speciesId]);

  const countOf = (box: number, bag: string): number =>
    rows.find((r) => r.box_size === box && r.bag_size === bag)?.max_count ?? 0;

  const [draft, setDraft] = useState<Record<string, string>>({});
  const handleSave = async () => {
    const updates = [] as { box_size: number; bag_size: string; max_count: number }[];
    for (const box of BOX_SIZES) {
      for (const bag of bagSizes) {
        const key = `${box}_${bag}`;
        if (draft[key] !== undefined) {
          updates.push({ box_size: box, bag_size: bag, max_count: parseInt(draft[key], 10) || 0 });
        }
      }
    }
    if (updates.length === 0) return;
    await adminSpeciesTypeApi.boxCapacities.upsert(speciesId, updates);
    setDraft({});
    await load(); onSaved();
  };

  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1 }}>各箱サイズに入る袋の最大個数を入力。空欄は 0 扱いです。</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>箱\袋</TableCell>
              {bagSizes.map((b) => <TableCell key={b} align="center">{b}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {BOX_SIZES.map((box) => (
              <TableRow key={box}>
                <TableCell>{box}号</TableCell>
                {bagSizes.map((bag) => {
                  const key = `${box}_${bag}`;
                  const current = countOf(box, bag);
                  return (
                    <TableCell key={bag} align="center">
                      <TextField
                        size="small"
                        type="number"
                        defaultValue={current}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ mt: 2, textAlign: 'right' }}>
        <Button variant="contained" onClick={handleSave}>保存</Button>
      </Box>
    </Box>
  );
}

function MixRestrictionsTab({ speciesId, onSaved }: { speciesId: number; onSaved: () => void }) {
  const [rows, setRows] = useState<BagMixRestriction[]>([]);
  const [draft, setDraft] = useState({ box_size: '', bag_size_a: '', bag_size_b: '' });
  const load = async () => setRows(await adminSpeciesTypeApi.mixRestrictions.list(speciesId));
  useEffect(() => { load(); }, [speciesId]);

  const handleAdd = async () => {
    if (!draft.bag_size_a || !draft.bag_size_b) return;
    await adminSpeciesTypeApi.mixRestrictions.create(speciesId, {
      box_size: draft.box_size ? parseInt(draft.box_size, 10) : null,
      bag_size_a: draft.bag_size_a,
      bag_size_b: draft.bag_size_b,
    });
    setDraft({ box_size: '', bag_size_a: '', bag_size_b: '' });
    await load(); onSaved();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('削除しますか？')) return;
    await adminSpeciesTypeApi.mixRestrictions.remove(speciesId, id);
    await load(); onSaved();
  };

  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1 }}>
        同一箱に入れてはいけない袋ペアを登録します。箱サイズ空欄 = 全箱で禁止。
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>箱サイズ</TableCell>
              <TableCell>袋A</TableCell>
              <TableCell>袋B</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.box_size ?? '全箱'}</TableCell>
                <TableCell>{r.bag_size_a}</TableCell>
                <TableCell>{r.bag_size_b}</TableCell>
                <TableCell align="right"><IconButton size="small" onClick={() => handleDelete(r.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell><TextField size="small" type="number" placeholder="全箱" value={draft.box_size} onChange={(e) => setDraft({ ...draft, box_size: e.target.value })} /></TableCell>
              <TableCell><TextField size="small" value={draft.bag_size_a} onChange={(e) => setDraft({ ...draft, bag_size_a: e.target.value })} /></TableCell>
              <TableCell><TextField size="small" value={draft.bag_size_b} onChange={(e) => setDraft({ ...draft, bag_size_b: e.target.value })} /></TableCell>
              <TableCell align="right"><Button size="small" onClick={handleAdd}>追加</Button></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
