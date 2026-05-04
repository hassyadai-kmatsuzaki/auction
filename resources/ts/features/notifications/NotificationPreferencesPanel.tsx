import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  Switch,
  IconButton,
  Tooltip,
  Paper,
  Stack,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Save as SaveIcon,
  Send as SendIcon,
  Email as EmailIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  CheckCircle as CheckIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { lineApi, LineNotificationSetting, LineStatus } from '@/api/line/lineApi';

export type NotificationCategory = 'transaction' | 'auction' | 'reminder';

export type NotificationRow = {
  /** カテゴリ */
  category: NotificationCategory;
  /** 表示名 */
  label: string;
  /** 説明（1-2行） */
  description: string;
  /** メール通知のキー (notification_settings JSON のキー) */
  emailKey?: string;
  /** メールテスト送信のtype */
  emailTestType?: string;
  /** LINE通知の type */
  lineType?: string;
};

const CATEGORY_META: Record<NotificationCategory, { label: string; color: string; bgcolor: string }> = {
  transaction: { label: '取引に関する通知', color: '#059669', bgcolor: '#ECFDF5' },
  auction: { label: 'オークションに関する通知', color: '#3B82F6', bgcolor: '#EFF6FF' },
  reminder: { label: 'リマインダー・アラート', color: '#F59E0B', bgcolor: '#FFFBEB' },
};

interface Props {
  /** 役割（LINE連携完了後の戻り先切替に使用） */
  role: 'participant' | 'seller';
  /** 通知行の定義 */
  rows: NotificationRow[];
  /** 現在のメール通知設定値 */
  emailSettings: Record<string, boolean>;
  /** メール通知設定の更新エンドポイント（PUT） */
  emailUpdateUrl: string;
  /** メールテスト送信エンドポイント（POST） */
  emailTestUrl: string;
  /** 設定変更を親に通知（保存後に親のstateと同期したい場合） */
  onSaved?: (next: Record<string, boolean>) => void;
  /** エラー/成功をトーストで出したい場合 */
  onNotify?: (msg: string, severity: 'success' | 'error') => void;
}

const LINE_STATUS_KEY = ['line-status'] as const;
const LINE_NOTIFICATIONS_KEY = ['line-notifications'] as const;

export default function NotificationPreferencesPanel({
  role,
  rows,
  emailSettings,
  emailUpdateUrl,
  emailTestUrl,
  onSaved,
  onNotify,
}: Props) {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [localEmail, setLocalEmail] = useState<Record<string, boolean>>(emailSettings);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState<string | null>(null);
  const [lineTestSending, setLineTestSending] = useState<string | null>(null);

  React.useEffect(() => {
    setLocalEmail(emailSettings);
  }, [emailSettings]);

  const lineStatusQuery = useQuery<LineStatus>({
    queryKey: LINE_STATUS_KEY,
    queryFn: lineApi.getStatus,
    staleTime: 60_000,
  });

  const lineNotificationsQuery = useQuery<LineNotificationSetting[]>({
    queryKey: LINE_NOTIFICATIONS_KEY,
    queryFn: lineApi.getNotifications,
    staleTime: 60_000,
  });

  const lineLinked = !!lineStatusQuery.data?.linked && !!lineStatusQuery.data?.is_active;

  const lineByType = useMemo(() => {
    const map: Record<string, LineNotificationSetting> = {};
    (lineNotificationsQuery.data ?? []).forEach((n) => {
      map[n.type] = n;
    });
    return map;
  }, [lineNotificationsQuery.data]);

  const linkMutation = useMutation({
    mutationFn: async () => {
      const returnTo = role === 'seller' ? '/seller/profile' : '/participant/settings';
      const url = await lineApi.getRedirectUrl(returnTo);
      window.location.href = url;
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: lineApi.unlink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LINE_STATUS_KEY });
      onNotify?.('LINE連携を解除しました', 'success');
    },
    onError: () => onNotify?.('LINE連携の解除に失敗しました', 'error'),
  });

  const lineToggleMutation = useMutation({
    mutationFn: (settings: { type: string; is_enabled: boolean }[]) =>
      lineApi.updateNotifications(settings),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: LINE_NOTIFICATIONS_KEY });
      const prev = queryClient.getQueryData<LineNotificationSetting[]>(LINE_NOTIFICATIONS_KEY);
      if (prev) {
        const nextByType = Object.fromEntries(next.map((n) => [n.type, n.is_enabled]));
        queryClient.setQueryData<LineNotificationSetting[]>(
          LINE_NOTIFICATIONS_KEY,
          prev.map((n) => (nextByType[n.type] !== undefined ? { ...n, is_enabled: nextByType[n.type] } : n)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(LINE_NOTIFICATIONS_KEY, ctx.prev);
      onNotify?.('LINE通知設定の更新に失敗しました', 'error');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: LINE_NOTIFICATIONS_KEY }),
  });

  const handleToggleEmail = (key: string, value: boolean) => {
    setLocalEmail((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggleLine = (type: string, value: boolean) => {
    const current = lineNotificationsQuery.data ?? [];
    const next = current.map((n) => ({
      type: n.type,
      is_enabled: n.type === type ? value : n.is_enabled,
    }));
    lineToggleMutation.mutate(next);
  };

  const handleSaveEmail = async () => {
    setSaving(true);
    try {
      await axios.put(emailUpdateUrl, localEmail);
      onSaved?.(localEmail);
      onNotify?.('メール通知設定を保存しました', 'success');
    } catch (err: any) {
      onNotify?.(err?.response?.data?.message ?? '保存に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async (type: string) => {
    setTestSending(type);
    try {
      const res = await axios.post(emailTestUrl, { type });
      if (res.data.success) {
        onNotify?.('テストメールを送信しました', 'success');
      }
    } catch (err: any) {
      onNotify?.(err?.response?.data?.message ?? 'テストメールの送信に失敗しました', 'error');
    } finally {
      setTestSending(null);
    }
  };

  const handleTestLine = async (type: string) => {
    setLineTestSending(type);
    try {
      const res = await lineApi.sendTest(type);
      if (res.success) {
        onNotify?.('LINEテスト通知を送信しました', 'success');
      } else {
        onNotify?.(res.message ?? 'LINEテスト通知の送信に失敗しました', 'error');
      }
    } catch (err: any) {
      onNotify?.(err?.response?.data?.message ?? 'LINEテスト通知の送信に失敗しました', 'error');
    } finally {
      setLineTestSending(null);
    }
  };

  const grouped = useMemo(() => {
    const g: Record<NotificationCategory, NotificationRow[]> = {
      transaction: [],
      auction: [],
      reminder: [],
    };
    rows.forEach((r) => g[r.category].push(r));
    return g;
  }, [rows]);

  const emailDirty = JSON.stringify(localEmail) !== JSON.stringify(emailSettings);

  return (
    <Stack spacing={3}>
      {/* LINE連携バナー */}
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderColor: lineLinked ? '#06C755' : 'divider',
          bgcolor: lineLinked ? '#F0FDF4' : 'transparent',
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            bgcolor: '#06C755',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          LINE
        </Box>
        {lineStatusQuery.isLoading ? (
          <CircularProgress size={20} />
        ) : lineLinked ? (
          <>
            {lineStatusQuery.data?.picture_url && (
              <Avatar src={lineStatusQuery.data.picture_url} sx={{ width: 36, height: 36 }} />
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {lineStatusQuery.data?.display_name || 'LINEユーザー'}
                </Typography>
                <Chip
                  size="small"
                  icon={<CheckIcon sx={{ fontSize: 14 }} />}
                  label="連携済み"
                  sx={{ bgcolor: '#06C755', color: '#fff', fontWeight: 600 }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                連携日:{' '}
                {lineStatusQuery.data?.linked_at
                  ? new Date(lineStatusQuery.data.linked_at).toLocaleDateString('ja-JP')
                  : '-'}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<LinkOffIcon />}
              onClick={() => unlinkMutation.mutate()}
              disabled={unlinkMutation.isPending}
            >
              連携解除
            </Button>
          </>
        ) : (
          <>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                LINEと連携してプッシュ通知を受け取る
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                連携すると、重要な通知をLINEですぐに受け取れます
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<LinkIcon />}
              onClick={() => linkMutation.mutate()}
              disabled={linkMutation.isPending}
              sx={{ bgcolor: '#06C755', '&:hover': { bgcolor: '#05B04C' } }}
            >
              {linkMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'LINEと連携する'}
            </Button>
          </>
        )}
      </Paper>

      {/* マトリクス表 */}
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {/* ヘッダー行（PCのみ） */}
        {!isMobile && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 90px 90px 100px',
              alignItems: 'center',
              px: 2.5,
              py: 1.5,
              bgcolor: '#F8FAFC',
              borderBottom: 1,
              borderColor: 'divider',
              fontWeight: 600,
              fontSize: '0.8125rem',
              color: 'text.secondary',
            }}
          >
            <Box>通知内容</Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
              <EmailIcon sx={{ fontSize: 16 }} />
              メール
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: 0.5,
                  bgcolor: '#06C755',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                L
              </Box>
              LINE
            </Box>
            <Box sx={{ textAlign: 'center' }}>テスト</Box>
          </Box>
        )}

        {(Object.keys(grouped) as NotificationCategory[]).map((cat) => {
          const items = grouped[cat];
          if (items.length === 0) return null;
          const meta = CATEGORY_META[cat];
          return (
            <Box key={cat}>
              {/* カテゴリヘッダー */}
              <Box
                sx={{
                  px: 2.5,
                  py: 1,
                  bgcolor: meta.bgcolor,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, color: meta.color, letterSpacing: 0.5 }}>
                  {meta.label}
                </Typography>
              </Box>
              {items.map((row, idx) => {
                const emailOn = row.emailKey ? !!localEmail[row.emailKey] : false;
                const lineSetting = row.lineType ? lineByType[row.lineType] : undefined;
                const lineDisabled = !lineLinked || !row.lineType;
                const lineOn = !!lineSetting?.is_enabled;

                const emailSwitchEl = row.emailKey ? (
                  <Switch
                    size="small"
                    checked={emailOn}
                    onChange={(e) => handleToggleEmail(row.emailKey!, e.target.checked)}
                  />
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                );

                const emailTestEl = row.emailTestType ? (
                  <Tooltip title="メール テスト送信" placement="top">
                    <span>
                      <IconButton
                        size="small"
                        disabled={!emailOn || testSending !== null}
                        onClick={() => handleTestEmail(row.emailTestType!)}
                        sx={{ color: '#3B82F6' }}
                      >
                        {testSending === row.emailTestType ? (
                          <CircularProgress size={14} />
                        ) : (
                          <EmailIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : null;

                const lineSwitchEl = row.lineType ? (
                  <Tooltip
                    title={!lineLinked ? 'LINE連携が必要です' : ''}
                    placement="top"
                    disableHoverListener={lineLinked}
                  >
                    <span>
                      <Switch
                        size="small"
                        color="success"
                        checked={lineLinked && lineOn}
                        disabled={lineDisabled}
                        onChange={(e) => handleToggleLine(row.lineType!, e.target.checked)}
                      />
                    </span>
                  </Tooltip>
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                );

                const lineTestEl = row.lineType ? (
                  <Tooltip
                    title={!lineLinked ? 'LINE連携が必要です' : 'LINE テスト送信'}
                    placement="top"
                  >
                    <span>
                      <IconButton
                        size="small"
                        disabled={!lineLinked || !lineOn || lineTestSending !== null}
                        onClick={() => handleTestLine(row.lineType!)}
                        sx={{ color: '#06C755' }}
                      >
                        {lineTestSending === row.lineType ? (
                          <CircularProgress size={14} />
                        ) : (
                          <SendIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : null;

                if (isMobile) {
                  return (
                    <Box
                      key={`${cat}-${row.label}-${idx}`}
                      sx={{
                        px: 2,
                        py: 1.75,
                        borderBottom: 1,
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 0 },
                      }}
                    >
                      <Box sx={{ mb: 1.25 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
                          {row.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          {row.description}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={0.25}
                          sx={{ flex: 1, minWidth: 0 }}
                        >
                          <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                          <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.25 }}>
                            メール
                          </Typography>
                          {emailSwitchEl}
                          {emailTestEl}
                        </Stack>
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={0.25}
                          sx={{ flex: 1, minWidth: 0 }}
                        >
                          <Box
                            sx={{
                              width: 14,
                              height: 14,
                              borderRadius: 0.5,
                              bgcolor: '#06C755',
                              color: '#fff',
                              fontSize: 9,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            L
                          </Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.25 }}>
                            LINE
                          </Typography>
                          {lineSwitchEl}
                          {lineTestEl}
                        </Stack>
                      </Stack>
                    </Box>
                  );
                }

                return (
                  <Box
                    key={`${cat}-${row.label}-${idx}`}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 90px 90px 100px',
                      alignItems: 'center',
                      px: 2.5,
                      py: 1.75,
                      borderBottom: 1,
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 0 },
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
                        {row.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {row.description}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      {emailSwitchEl}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      {lineSwitchEl}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                      {emailTestEl ?? <Box sx={{ width: 30 }} />}
                      {lineTestEl ?? <Box sx={{ width: 30 }} />}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Paper>

      <Alert severity="info" icon={<InfoIcon fontSize="small" />} sx={{ py: 0.5 }}>
        <Typography variant="caption">
          重要なお知らせ（落札確定・支払い期限など）は設定に関わらず送信されます。LINE通知はトグルで即座に反映されます。
        </Typography>
      </Alert>

      <Divider />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Typography variant="caption" sx={{ color: emailDirty ? 'warning.main' : 'text.secondary' }}>
          {emailDirty ? '※ メール通知設定に未保存の変更があります' : 'メール通知設定は保存されています'}
        </Typography>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          onClick={handleSaveEmail}
          disabled={saving || !emailDirty}
        >
          メール設定を保存
        </Button>
      </Stack>
    </Stack>
  );
}
