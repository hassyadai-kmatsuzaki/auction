import { useState } from 'react';
import {
  Card, CardContent, Typography, Switch, FormControlLabel, Alert, Box, Grid,
  TextField, Button, Divider, IconButton, Chip, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, MenuItem, CircularProgress, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Refresh as RefreshIcon,
  Send as SendIcon, NetworkCheck as NetworkCheckIcon, Replay as ReplayIcon,
} from '@mui/icons-material';
import axios from '../../../lib/axios';

export interface EneCrmFieldDef { name: string; value: string }
export interface EneCrmEventConfig {
  enabled: boolean;
  trigger_automation: boolean;
  fields: EneCrmFieldDef[];
}
export type EneCrmEventMap = Record<string, EneCrmEventConfig>;

/**
 * 送信イベントの定義。key は EneCrmRequest の EVENT_* 定数と一致させること。
 */
const EVENTS: { key: string; label: string; description: string }[] = [
  {
    key: 'password_set',
    label: 'パスワード設定完了',
    description: '会員がパスワード設定リンクから初回パスワードを設定した直後',
  },
  {
    key: 'subscription_paid',
    label: '決済登録完了（カード）',
    description: 'カード登録と初回課金が成功した直後',
  },
  {
    key: 'bank_transfer_requested',
    label: '銀行振込の申請',
    description: '振込での加入を申請した時点（入金確認前）',
  },
];

/** 値に埋め込めるプレースホルダ（EneCrmPushService::placeholders と対応） */
const PLACEHOLDERS = [
  'date', 'datetime', 'user_name', 'email', 'ene_id',
  'plan_name', 'plan_code', 'amount', 'payment_method',
];

export const DEFAULT_ENE_CRM_EVENT_MAP: EneCrmEventMap = EVENTS.reduce((acc, e) => {
  acc[e.key] = { enabled: false, trigger_automation: false, fields: [] };
  return acc;
}, {} as EneCrmEventMap);

/** 接続テストで取得した、対象会員のCRM現在値 */
interface EneCrmRemoteField {
  name: string;
  label: string;
  type: string;
  display_value: string;
}

/**
 * GET /fields で取得する E-NE の項目カタログ。
 * name（field_xxxxxxxx）も choices[].value（opt_xxxxxxxx）も自動採番の機械キーなので、
 * 人が手で入力することは想定せず、必ずここから選ばせる。
 */
interface EneCrmCatalogField {
  name: string;
  label: string;
  type: string;
  is_required?: boolean;
  choices?: { value: string; label: string }[];
}

const CHOICE_TYPES = ['select', 'multi_select'];

/** 保存値（'["opt_x"]' 形式の文字列）を配列に戻す */
const parseArrayValue = (raw: string): string[] => {
  const trimmed = (raw ?? '').trim();
  if (!trimmed.startsWith('[')) return trimmed ? [trimmed] : [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

interface LogRow {
  id: number;
  event_label: string;
  user_name: string | null;
  user_email: string | null;
  status: string;
  http_status: number | null;
  error: string | null;
  attempts: number;
  created_at: string | null;
}

interface Props {
  enabled: boolean;
  baseUrl: string;
  tenantId: string;
  apiKey: string;
  eventMap: EneCrmEventMap;
  onChangeSetting: (key: 'ene_crm_push_enabled', value: boolean) => void;
  onChangeText: (key: 'ene_crm_base_url' | 'ene_crm_tenant_id' | 'ene_crm_api_key', value: string) => void;
  onChangeEventMap: (map: EneCrmEventMap) => void;
}

const STATUS_LABEL: Record<string, { label: string; color: 'success' | 'error' | 'warning' | 'default' }> = {
  success: { label: '成功', color: 'success' },
  failed:  { label: '失敗', color: 'error' },
  pending: { label: '送信待ち', color: 'warning' },
  skipped: { label: 'スキップ', color: 'default' },
};

/**
 * auction → E-NE（Cal-Connect）CRM更新 の設定カード。
 *
 * 接続情報・イベントごとの送信内容をここで設定し、接続テスト／手動送信／送信ログの確認まで行う。
 * 設定値そのものは親（管理画面「設定」）の保存ボタンでまとめて PUT される。
 */
export default function EneCrmPushCard({
  enabled, baseUrl, tenantId, apiKey, eventMap,
  onChangeSetting, onChangeText, onChangeEventMap,
}: Props) {
  const [testUserId, setTestUserId] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; fields?: EneCrmRemoteField[] } | null>(null);

  const [sendEvent, setSendEvent] = useState(EVENTS[0].key);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [catalog, setCatalog] = useState<EneCrmCatalogField[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const catalogField = (name: string): EneCrmCatalogField | undefined =>
    catalog?.find((f) => f.name === name);

  const fetchCatalog = async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await axios.get('/api/admin/ene-crm/fields');
      setCatalog(res.data?.data?.fields ?? []);
    } catch (e: any) {
      setCatalog(null);
      setCatalogError(e?.response?.data?.message ?? '項目の読み込みに失敗しました。');
    }
    setCatalogLoading(false);
  };

  const config = (key: string): EneCrmEventConfig =>
    eventMap?.[key] ?? { enabled: false, trigger_automation: false, fields: [] };

  const updateEvent = (key: string, patch: Partial<EneCrmEventConfig>) => {
    onChangeEventMap({ ...eventMap, [key]: { ...config(key), ...patch } });
  };

  const updateField = (key: string, index: number, patch: Partial<EneCrmFieldDef>) => {
    const fields = config(key).fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    updateEvent(key, { fields });
  };

  const addField = (key: string) => {
    updateEvent(key, { fields: [...config(key).fields, { name: '', value: '' }] });
  };

  const removeField = (key: string, index: number) => {
    updateEvent(key, { fields: config(key).fields.filter((_, i) => i !== index) });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await axios.post('/api/admin/ene-crm/test', { user_id: Number(testUserId) });
      setTestResult({
        ok: true,
        message: res.data?.message ?? '接続に成功しました。',
        fields: res.data?.data?.fields ?? [],
      });
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.response?.data?.message ?? '接続に失敗しました。' });
    }
    setTesting(false);
  };

  const handleSend = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const res = await axios.post('/api/admin/ene-crm/send', {
        user_id: Number(testUserId),
        event: sendEvent,
      });
      setSendResult({ ok: true, message: res.data?.message ?? '送信をキューに登録しました。' });
      fetchLogs();
    } catch (e: any) {
      setSendResult({ ok: false, message: e?.response?.data?.message ?? '送信に失敗しました。' });
    }
    setSending(false);
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await axios.get('/api/admin/ene-crm/logs', { params: { per_page: 20 } });
      setLogs(res.data?.data?.data ?? []);
    } catch {
      setLogs([]);
    }
    setLogsLoading(false);
  };

  /** 項目名の入力欄。カタログがあればプルダウン、無ければ従来の自由入力 */
  const renderNameInput = (eventKey: string, index: number, field: EneCrmFieldDef) => {
    if (!catalog) {
      return (
        <TextField fullWidth size="small" label="CRMフィールド名（field_xxxx）" value={field.name}
          onChange={(e) => updateField(eventKey, index, { name: e.target.value })}
          helperText="「E-NEの項目を読み込む」を押すと一覧から選べます" />
      );
    }

    const missing = field.name !== '' && !catalogField(field.name);
    return (
      <TextField select fullWidth size="small" label="CRM項目" value={field.name} error={missing}
        helperText={missing ? 'E-NE に存在しない項目です' : undefined}
        // 項目を変えると型が変わるので値はクリアする（select の opt_ が残ると事故る）
        onChange={(e) => updateField(eventKey, index, { name: e.target.value, value: '' })}>
        {missing && <MenuItem value={field.name}>{field.name}（E-NEに存在しません）</MenuItem>}
        {catalog.map((f) => (
          <MenuItem key={f.name} value={f.name}>
            {f.label}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              {f.type}
            </Typography>
          </MenuItem>
        ))}
      </TextField>
    );
  };

  /** 値の入力欄。E-NE の型に応じて選択肢／真偽／自由入力を出し分ける */
  const renderValueInput = (eventKey: string, index: number, field: EneCrmFieldDef) => {
    const def = catalogField(field.name);

    if (def && CHOICE_TYPES.includes(def.type)) {
      const multiple = def.type === 'multi_select';
      const selected = parseArrayValue(field.value);
      const labelOf = (v: string) => def.choices?.find((c) => c.value === v)?.label ?? v;

      return (
        <TextField select fullWidth size="small" label="値（選択肢から選ぶ）"
          SelectProps={{
            multiple,
            ...(multiple ? { renderValue: (sel: unknown) => (sel as string[]).map(labelOf).join('、') } : {}),
          }}
          value={multiple ? selected : (selected[0] ?? '')}
          onChange={(e) => {
            const raw = e.target.value as unknown as string | string[];
            updateField(eventKey, index, { value: JSON.stringify(Array.isArray(raw) ? raw : [raw]) });
          }}>
          {(def.choices ?? []).map((ch) => (
            <MenuItem key={ch.value} value={ch.value}>{ch.label}</MenuItem>
          ))}
        </TextField>
      );
    }

    if (def?.type === 'checkbox') {
      return (
        <TextField select fullWidth size="small" label="値" value={field.value}
          onChange={(e) => updateField(eventKey, index, { value: e.target.value })}>
          <MenuItem value="true">チェックを付ける</MenuItem>
          <MenuItem value="false">チェックを外す</MenuItem>
        </TextField>
      );
    }

    return (
      <TextField fullWidth size="small" label="値" value={field.value}
        onChange={(e) => updateField(eventKey, index, { value: e.target.value })}
        helperText={def ? `型: ${def.type}` : undefined} />
    );
  };

  const handleRetry = async (id: number) => {
    try {
      await axios.post(`/api/admin/ene-crm/logs/${id}/retry`);
    } catch { /* 一覧の再取得で結果は見える */ }
    fetchLogs();
  };

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          E-NE へのCRM更新（送信）
        </Typography>
        <Alert severity="info" sx={{ mb: 3 }}>
          パスワード設定・決済登録のタイミングで、E-NE の顧客CRMを更新します。送信は非同期（notifyキュー）で行われ、
          E-NE 側が応答しなくても会員の操作は止まりません。<strong>顧客の特定は LINEユーザーID</strong> で行うため、
          E-NE 由来でない会員（管理画面で手動作成した会員など）には送信されません。
        </Alert>

        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => onChangeSetting('ene_crm_push_enabled', e.target.checked)} />}
            label="E-NEへのCRM更新を有効にする" />
          <Typography variant="body2" color="text.secondary">
            OFFの間は、下のイベント設定に関わらず一切送信しません。
          </Typography>
        </Box>

        <Grid container spacing={3} sx={{ mb: 1 }}>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="ベースURL" value={baseUrl}
              onChange={(e) => onChangeText('ene_crm_base_url', e.target.value)}
              placeholder="https://anken.cloud" helperText="末尾スラッシュ不要" />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth label="テナントID" value={tenantId}
              onChange={(e) => onChangeText('ene_crm_tenant_id', e.target.value)}
              placeholder="5" helperText="E-NE管理者から共有される番号" />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField fullWidth label="APIキー" value={apiKey}
              onChange={(e) => onChangeText('ene_crm_api_key', e.target.value)}
              placeholder="cc_live_…"
              helperText="crm:read + crm:write スコープが必要。保存済みのキーは先頭のみ表示され、空のまま保存しても消えません" />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>イベントごとの送信内容</Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />}
            onClick={fetchCatalog} disabled={catalogLoading}>
            {catalogLoading ? '読み込み中…' : 'E-NEの項目を読み込む'}
          </Button>
          {catalog && (
            <Typography variant="body2" color="text.secondary">
              {catalog.length} 項目を読み込みました。項目名・選択肢がプルダウンで選べます。
            </Typography>
          )}
        </Box>

        {catalogError && <Alert severity="error" sx={{ mb: 2 }}>{catalogError}</Alert>}
        {!catalog && !catalogError && (
          <Alert severity="info" sx={{ mb: 2 }}>
            E-NE 側の項目名（<code>field_xxxxxxxx</code>）と選択肢の値（<code>opt_xxxxxxxx</code>）は
            自動採番のため手入力できません。まず「E-NEの項目を読み込む」を押してください。
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          テキスト・日付などの自由入力欄では、次のプレースホルダが使えます:
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
          {PLACEHOLDERS.map((p) => <Chip key={p} size="small" label={`{{${p}}}`} />)}
        </Stack>

        {EVENTS.map((event) => {
          const c = config(event.key);
          return (
            <Box key={event.key} sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <FormControlLabel
                  control={<Switch checked={c.enabled} onChange={(e) => updateEvent(event.key, { enabled: e.target.checked })} />}
                  label={<Typography sx={{ fontWeight: 600 }}>{event.label}</Typography>} />
                <Tooltip title="ONにすると、E-NE側のCRMワークフロー・ステップ配信・Slack通知も発火します（画面で手動変更したのと同じ挙動）">
                  <FormControlLabel
                    control={<Switch size="small" checked={c.trigger_automation}
                      onChange={(e) => updateEvent(event.key, { trigger_automation: e.target.checked })} />}
                    label={<Typography variant="body2">E-NE側の自動処理も動かす</Typography>} />
                </Tooltip>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{event.description}</Typography>

              {c.fields.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  送信する項目が未設定です（このままでは送信されません）。
                </Typography>
              )}

              {c.fields.map((field, index) => (
                <Grid container spacing={2} key={index} sx={{ mb: 1 }} alignItems="center">
                  <Grid item xs={12} sm={5}>
                    {renderNameInput(event.key, index, field)}
                  </Grid>
                  <Grid item xs={11} sm={6}>
                    {renderValueInput(event.key, index, field)}
                  </Grid>
                  <Grid item xs={1}>
                    <IconButton size="small" onClick={() => removeField(event.key, index)} aria-label="項目を削除">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}

              <Button size="small" startIcon={<AddIcon />} onClick={() => addField(event.key)}>項目を追加</Button>
            </Box>
          );
        })}

        <Alert severity="info" sx={{ mb: 3 }}>
          自由入力欄の値は型を自動判定して送ります。数値・金額は <code>11000</code> のように数字だけを入れると
          数値型のまま、それ以外はテキストとして送られます。
        </Alert>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>接続テスト / 手動送信</Typography>
        <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth size="small" label="会員ID（users.id）" value={testUserId}
              onChange={(e) => setTestUserId(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <Button fullWidth variant="outlined" startIcon={<NetworkCheckIcon />}
              disabled={!testUserId || testing} onClick={handleTest}>
              {testing ? '確認中…' : '接続テスト（取得のみ）'}
            </Button>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField select fullWidth size="small" label="送信するイベント" value={sendEvent}
              onChange={(e) => setSendEvent(e.target.value)}>
              {EVENTS.map((e) => <MenuItem key={e.key} value={e.key}>{e.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Button fullWidth variant="contained" startIcon={<SendIcon />}
              disabled={!testUserId || sending} onClick={handleSend}>
              {sending ? '送信中…' : 'この会員に手動送信'}
            </Button>
          </Grid>
        </Grid>

        {testResult && (
          <Alert severity={testResult.ok ? 'success' : 'error'} sx={{ mb: 2 }}>
            {testResult.message}
            {testResult.ok && !!testResult.fields?.length && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  E-NE 側のCRM項目一覧です。<strong>「CRMフィールド名」欄には “システム名” 列の値
                  （<code>field_xxxx</code>）をそのまま入力してください</strong>。表示名を入れると
                  E-NE 側で無視され、更新されません。
                </Typography>
                <TableContainer sx={{ maxHeight: 320, overflow: 'auto', bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>表示名</TableCell>
                        <TableCell>システム名（これを入力）</TableCell>
                        <TableCell>型</TableCell>
                        <TableCell>現在値</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {testResult.fields.map((f) => (
                        <TableRow key={f.name} hover>
                          <TableCell>{f.label}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{f.name}</TableCell>
                          <TableCell>{f.type}</TableCell>
                          <TableCell sx={{ maxWidth: 200, wordBreak: 'break-all' }}>
                            <Typography variant="caption" color="text.secondary">{f.display_value || '-'}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Alert>
        )}
        {sendResult && (
          <Alert severity={sendResult.ok ? 'success' : 'error'} sx={{ mb: 2 }}>{sendResult.message}</Alert>
        )}

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>送信ログ（直近20件）</Typography>
          <Button size="small" startIcon={<RefreshIcon />} onClick={fetchLogs} disabled={logsLoading}>更新</Button>
        </Box>

        {logsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
        ) : logs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            ログはありません（「更新」を押すと最新を取得します）。
          </Typography>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>日時</TableCell>
                  <TableCell>イベント</TableCell>
                  <TableCell>会員</TableCell>
                  <TableCell>結果</TableCell>
                  <TableCell>詳細</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => {
                  const status = STATUS_LABEL[log.status] ?? { label: log.status, color: 'default' as const };
                  return (
                    <TableRow key={log.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{log.created_at}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{log.event_label}</TableCell>
                      <TableCell>{log.user_name ?? '-'}<br /><Typography variant="caption" color="text.secondary">{log.user_email}</Typography></TableCell>
                      <TableCell>
                        <Chip size="small" color={status.color} label={status.label} />
                        {log.http_status ? <Typography variant="caption" sx={{ ml: 1 }}>{log.http_status}</Typography> : null}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280, wordBreak: 'break-all' }}>
                        <Typography variant="caption" color="text.secondary">{log.error ?? '-'}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        {log.status !== 'success' && log.status !== 'skipped' && (
                          <Button size="small" startIcon={<ReplayIcon />} onClick={() => handleRetry(log.id)}>再送</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
