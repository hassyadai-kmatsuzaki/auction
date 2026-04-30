import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Stack,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  Alert,
  Divider,
  CircularProgress,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import { Send as SendIcon, Preview as PreviewIcon, Outbox as TestIcon } from '@mui/icons-material';
import { emailCampaignApi, TargetType, CampaignTargetFilter } from '../../api/admin/emailCampaignApi';
import MultiUserPicker, { PickerUser } from '../../components/admin/MultiUserPicker';
import axios from '../../lib/axios';

/**
 * メール一斉/個別配信の作成画面。
 *
 * 起動経路:
 * - ?user_id=N           … UserDetail の「メール送信」（n=1 の個別送信）。ID から API でユーザー情報を取得して埋める
 * - ?from=user_selection … UserManagement のチェックボックス選択。`{id, name, email}[]` が sessionStorage にある
 *                          （URL に長大に乗せないため）
 *
 * 「ユーザーで指定」モードは MultiUserPicker（名前/メール検索オートコンプリート）で
 * ユーザーを直接選ぶ UI に統一している。
 */
const SESSION_KEY_INITIAL_USERS = 'email-campaign:initial-users';

export default function EmailCampaignForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [filter, setFilter] = useState<CampaignTargetFilter>({});
  const [selectedUsers, setSelectedUsers] = useState<PickerUser[]>([]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSample, setPreviewSample] = useState<{ id: number; name: string; email: string }[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // 起動時に「どのユーザーが事前選択されているか」を解決する
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // (a) sessionStorage 経由（UserManagement の複数選択から）
        if (searchParams.get('from') === 'user_selection') {
          const raw = sessionStorage.getItem(SESSION_KEY_INITIAL_USERS);
          sessionStorage.removeItem(SESSION_KEY_INITIAL_USERS);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              if (!cancelled) {
                setSelectedUsers(parsed.filter((u: any) => u && typeof u.id === 'number'));
                setTargetType('manual');
              }
              return;
            }
          }
        }

        // (b) クエリ user_id=N（UserDetail からの個別送信）。API で名前/メアドを取りに行く
        const single = searchParams.get('user_id');
        if (single) {
          const id = parseInt(single, 10);
          if (Number.isFinite(id) && id > 0) {
            const res = await axios.get(`/api/admin/users/${id}`);
            const u = res.data?.data?.user ?? res.data?.data ?? null;
            if (u && u.id && !cancelled) {
              setSelectedUsers([{ id: u.id, name: u.name, email: u.email, trade_name: u.trade_name ?? null }]);
              setTargetType('manual');
            }
          }
        }
      } catch {
        // 失敗しても致命ではない（ユーザーは検索 UI で選び直せる）
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 入力変更で件数キャッシュを毎回クリア（古い件数で誤送信させないため）
  useEffect(() => {
    setPreviewCount(null);
    setPreviewSample([]);
  }, [targetType, filter, selectedUsers]);

  const buildPayload = () => ({
    subject,
    body_markdown: body,
    target_type: targetType,
    target_filter: targetType === 'filter' ? filter : null,
    target_user_ids: targetType === 'manual' ? selectedUsers.map((u) => u.id) : null,
  });

  const handlePreview = async () => {
    setError(null);
    setInfo(null);
    setPreviewing(true);
    try {
      const data = await emailCampaignApi.preview(buildPayload());
      setPreviewCount(data.count);
      setPreviewSample(data.sample);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'プレビューに失敗しました');
    } finally {
      setPreviewing(false);
    }
  };

  const handleTestSend = async () => {
    setError(null);
    setInfo(null);
    if (!subject || !body) {
      setError('テスト送信には件名と本文が必要です');
      return;
    }
    setTestSending(true);
    try {
      const res = await emailCampaignApi.testSend(buildPayload());
      setInfo(res.message);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'テスト送信に失敗しました');
    } finally {
      setTestSending(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);
    if (previewCount === null) {
      setError('送信前に必ずプレビューで対象件数を確認してください');
      return;
    }
    const confirmMsg = `${previewCount} 件のメールを配信します。\n\n` +
      `件名: ${subject}\n\n本当に配信を開始しますか？\n` +
      `（投入後は配信中の Job をキャンセルできない場合があります）`;
    if (!window.confirm(confirmMsg)) return;

    setSubmitting(true);
    try {
      const created = await emailCampaignApi.create(buildPayload());
      navigate(`/admin/email-campaigns/${created.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '配信投入に失敗しました');
      setSubmitting(false);
    }
  };

  const isManualValid = targetType !== 'manual' || selectedUsers.length > 0;

  return (
    <Box sx={{ p: 3, maxWidth: 1080, mx: 'auto' }}>
      <Typography variant="h5" mb={2}>
        {selectedUsers.length === 1 ? 'メール個別送信'
          : selectedUsers.length > 1 ? `メール送信（${selectedUsers.length}人を選択中）`
          : 'メール配信 新規作成'}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {info && <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>件名・本文</Typography>
        <Stack spacing={2}>
          <TextField
            label="件名"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            fullWidth
            inputProps={{ maxLength: 200 }}
            helperText={`${subject.length} / 200`}
          />
          <TextField
            label="本文 (Markdown)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            fullWidth
            multiline
            minRows={10}
            inputProps={{ maxLength: 50000 }}
            helperText={`${body.length} / 50000  /  差し込み変数: {{name}} {{email}} {{trade_name}} {{company_name}}`}
          />
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>配信対象</Typography>
        <FormControl>
          <RadioGroup row value={targetType} onChange={(e) => setTargetType(e.target.value as TargetType)}>
            <FormControlLabel value="all" control={<Radio />} label="承認済みユーザー全員" />
            <FormControlLabel value="filter" control={<Radio />} label="条件で絞り込み" />
            <FormControlLabel value="manual" control={<Radio />} label="ユーザーを選んで指定" />
          </RadioGroup>
        </FormControl>

        {targetType === 'filter' && (
          <Box sx={{ mt: 2, pl: 1 }}>
            <Stack spacing={1}>
              <FormControl>
                <FormLabel sx={{ fontSize: 14 }}>ロール</FormLabel>
                <Stack direction="row" spacing={2}>
                  {['admin', 'seller', 'participant'].map((r) => (
                    <FormControlLabel
                      key={r}
                      control={
                        <Checkbox
                          checked={Array.isArray(filter.role) ? filter.role.includes(r) : filter.role === r}
                          onChange={(e) => {
                            const current = Array.isArray(filter.role) ? [...filter.role] : (filter.role ? [filter.role] : []);
                            const next = e.target.checked ? [...current, r] : current.filter((x) => x !== r);
                            setFilter({ ...filter, role: next.length ? next : undefined });
                          }}
                        />
                      }
                      label={r}
                    />
                  ))}
                </Stack>
              </FormControl>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!filter.has_won}
                    onChange={(e) => setFilter({ ...filter, has_won: e.target.checked || undefined })}
                  />
                }
                label="落札歴あり"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!filter.bank_transfer_unconfirmed}
                    onChange={(e) => setFilter({ ...filter, bank_transfer_unconfirmed: e.target.checked || undefined })}
                  />
                }
                label="銀行振込・未確認のみ"
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  label="最終ログイン: これ以降"
                  type="date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={filter.last_login_after ?? ''}
                  onChange={(e) => setFilter({ ...filter, last_login_after: e.target.value || undefined })}
                />
                <TextField
                  label="最終ログイン: これより前（休眠）"
                  type="date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={filter.last_login_before ?? ''}
                  onChange={(e) => setFilter({ ...filter, last_login_before: e.target.value || undefined })}
                />
              </Stack>
            </Stack>
          </Box>
        )}

        {targetType === 'manual' && (
          <Box sx={{ mt: 2, pl: 1 }}>
            {initializing ? (
              <Box display="flex" alignItems="center" gap={1}><CircularProgress size={16} /><Typography variant="body2">初期ユーザーを読み込み中...</Typography></Box>
            ) : (
              <MultiUserPicker
                value={selectedUsers}
                onChange={setSelectedUsers}
              />
            )}
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <Button
            variant="outlined"
            startIcon={previewing ? <CircularProgress size={16} /> : <PreviewIcon />}
            onClick={handlePreview}
            disabled={previewing || !isManualValid}
          >
            対象件数を確認
          </Button>
          <Button
            variant="outlined"
            startIcon={testSending ? <CircularProgress size={16} /> : <TestIcon />}
            onClick={handleTestSend}
            disabled={testSending || !subject || !body}
          >
            自分宛にテスト送信
          </Button>
        </Stack>

        {previewCount !== null && (
          <Card variant="outlined" sx={{ bgcolor: '#f7f9fc' }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" mb={1}>
                <Typography variant="body1">配信対象:</Typography>
                <Chip label={`${previewCount} 件`} color={previewCount > 0 ? 'primary' : 'default'} />
              </Stack>
              {previewSample.length > 0 && (
                <>
                  <Typography variant="body2" color="text.secondary">先頭サンプル:</Typography>
                  <Box component="ul" sx={{ pl: 3, my: 1 }}>
                    {previewSample.map((u) => (
                      <li key={u.id}>
                        <Typography variant="body2">
                          [{u.id}] {u.name} &lt;{u.email}&gt;
                        </Typography>
                      </li>
                    ))}
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </Paper>

      <Divider sx={{ my: 2 }} />

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button onClick={() => navigate('/admin/email-campaigns')}>キャンセル</Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={submitting ? <CircularProgress size={16} /> : <SendIcon />}
          onClick={handleSubmit}
          disabled={submitting || !subject || !body || !isManualValid || previewCount === null || previewCount === 0}
        >
          {previewCount !== null ? `${previewCount} 件に配信` : '配信開始'}
        </Button>
      </Stack>
    </Box>
  );
}
