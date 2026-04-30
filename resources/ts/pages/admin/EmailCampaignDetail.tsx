import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Grid,
} from '@mui/material';
import { Cancel as CancelIcon, ArrowBack } from '@mui/icons-material';
import { emailCampaignApi, EmailCampaign, CampaignRecipient, CampaignStatus } from '../../api/admin/emailCampaignApi';

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: '下書き',
  queued: '投入済',
  sending: '配信中',
  sent: '完了',
  cancelled: '中止',
  failed: '失敗',
};

const RECIPIENT_STATUS_LABEL: Record<string, string> = {
  queued: '送信待ち',
  sent: '送信済',
  failed: '失敗',
  bounced: 'バウンス',
  complained: '苦情',
  skipped: 'スキップ',
};

export default function EmailCampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<EmailCampaign | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await emailCampaignApi.get(parseInt(id, 10));
      setCampaign(data.campaign);
      setRecipients(data.recipients_sample);
      setSummary(data.recipients_summary ?? {});
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'キャンペーン情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // 配信中ステータスの場合、5秒ごとに更新
    const interval = setInterval(() => {
      if (campaign?.status === 'sending' || campaign?.status === 'queued') {
        fetchData();
      }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, campaign?.status]);

  const handleCancel = async () => {
    if (!campaign) return;
    if (!window.confirm('このキャンペーンをキャンセルしますか？')) return;
    try {
      await emailCampaignApi.cancel(campaign.id);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'キャンセルに失敗しました');
    }
  };

  if (loading && !campaign) {
    return <Box sx={{ p: 3 }}><CircularProgress /></Box>;
  }
  if (!campaign) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{error ?? 'キャンペーンが見つかりません'}</Alert></Box>;
  }

  const isCancellable = campaign.status === 'draft' || campaign.status === 'queued';

  return (
    <Box sx={{ p: 3, maxWidth: 1080, mx: 'auto' }}>
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin/email-campaigns')}>戻る</Button>
        <Typography variant="h5" sx={{ flex: 1 }}>キャンペーン詳細 #{campaign.id}</Typography>
        {isCancellable && (
          <Button color="error" variant="outlined" startIcon={<CancelIcon />} onClick={handleCancel}>
            キャンセル
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Typography variant="caption" color="text.secondary">件名</Typography>
            <Typography variant="body1" gutterBottom>{campaign.subject}</Typography>
          </Grid>
          <Grid item xs={6} md={2}>
            <Typography variant="caption" color="text.secondary">ステータス</Typography>
            <Box mt={0.5}><Chip label={STATUS_LABEL[campaign.status]} size="small" /></Box>
          </Grid>
          <Grid item xs={6} md={2}>
            <Typography variant="caption" color="text.secondary">対象タイプ</Typography>
            <Typography variant="body2" mt={0.5}>{campaign.target_type}</Typography>
          </Grid>

          <Grid item xs={4} md={2}>
            <Typography variant="caption" color="text.secondary">対象数</Typography>
            <Typography variant="h6">{campaign.total_recipients}</Typography>
          </Grid>
          <Grid item xs={4} md={2}>
            <Typography variant="caption" color="text.secondary">送信済</Typography>
            <Typography variant="h6" color="success.main">{campaign.sent_count}</Typography>
          </Grid>
          <Grid item xs={4} md={2}>
            <Typography variant="caption" color="text.secondary">失敗</Typography>
            <Typography variant="h6" color="error.main">{campaign.failed_count}</Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="caption" color="text.secondary">作成日時</Typography>
            <Typography variant="body2" mt={0.5}>{new Date(campaign.created_at).toLocaleString('ja-JP')}</Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="caption" color="text.secondary">完了日時</Typography>
            <Typography variant="body2" mt={0.5}>{campaign.completed_at ? new Date(campaign.completed_at).toLocaleString('ja-JP') : '-'}</Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Typography variant="caption" color="text.secondary">本文</Typography>
        <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: '#fafafa', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
          {campaign.body_markdown}
        </Paper>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <Typography variant="subtitle1">受信者（先頭100件）</Typography>
          {Object.entries(summary).map(([k, v]) => (
            <Chip key={k} label={`${RECIPIENT_STATUS_LABEL[k] ?? k}: ${v}`} size="small" />
          ))}
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ユーザー</TableCell>
                <TableCell>メールアドレス</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell>送信日時</TableCell>
                <TableCell>エラー</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recipients.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center">受信者がまだ展開されていません</TableCell></TableRow>
              ) : recipients.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.user?.name ?? `#${r.user_id}`}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>{RECIPIENT_STATUS_LABEL[r.status] ?? r.status}</TableCell>
                  <TableCell>{r.sent_at ? new Date(r.sent_at).toLocaleString('ja-JP') : '-'}</TableCell>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.error ?? '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
