import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  CircularProgress,
  Alert,
  Stack,
  Tooltip,
  IconButton,
} from '@mui/material';
import { Add as AddIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { emailCampaignApi, EmailCampaign, CampaignStatus } from '../../api/admin/emailCampaignApi';

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: '下書き',
  queued: '投入済',
  sending: '配信中',
  sent: '完了',
  cancelled: '中止',
  failed: '失敗',
};

const STATUS_COLOR: Record<CampaignStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  draft: 'default',
  queued: 'info',
  sending: 'warning',
  sent: 'success',
  cancelled: 'default',
  failed: 'error',
};

const TARGET_LABEL: Record<string, string> = {
  all: '全員',
  filter: '条件指定',
  manual: '手動選択',
};

export default function EmailCampaignManagement() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await emailCampaignApi.list({
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        per_page: 20,
      });
      setCampaigns(data.campaigns);
      setLastPage(data.pagination.last_page);
      setTotal(data.pagination.total);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'キャンペーン一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCancel = async (id: number) => {
    if (!window.confirm('このキャンペーンをキャンセルしますか？\n配信中の場合、投入済の Job は走り切ることがあります。')) return;
    try {
      await emailCampaignApi.cancel(id);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'キャンセルに失敗しました');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">メール配信</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/admin/email-campaigns/create')}>
          新規作成
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>ステータス</InputLabel>
          <Select
            label="ステータス"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <MenuItem value="all">すべて</MenuItem>
            <MenuItem value="draft">下書き</MenuItem>
            <MenuItem value="queued">投入済</MenuItem>
            <MenuItem value="sending">配信中</MenuItem>
            <MenuItem value="sent">完了</MenuItem>
            <MenuItem value="cancelled">中止</MenuItem>
            <MenuItem value="failed">失敗</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary">合計 {total} 件</Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>件名</TableCell>
                <TableCell>対象</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell align="right">対象数</TableCell>
                <TableCell align="right">送信済</TableCell>
                <TableCell align="right">失敗</TableCell>
                <TableCell>作成者</TableCell>
                <TableCell>作成日時</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : campaigns.length === 0 ? (
                <TableRow><TableCell colSpan={9} align="center">キャンペーンがありません</TableCell></TableRow>
              ) : campaigns.map((c) => (
                <TableRow
                  key={c.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/admin/email-campaigns/${c.id}`)}
                >
                  <TableCell sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.subject}
                  </TableCell>
                  <TableCell>{TARGET_LABEL[c.target_type] ?? c.target_type}</TableCell>
                  <TableCell><Chip label={STATUS_LABEL[c.status]} color={STATUS_COLOR[c.status]} size="small" /></TableCell>
                  <TableCell align="right">{c.total_recipients}</TableCell>
                  <TableCell align="right">{c.sent_count}</TableCell>
                  <TableCell align="right">{c.failed_count > 0 ? <span style={{ color: '#DC2626' }}>{c.failed_count}</span> : 0}</TableCell>
                  <TableCell>{c.creator?.name ?? '-'}</TableCell>
                  <TableCell>{new Date(c.created_at).toLocaleString('ja-JP')}</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    {(c.status === 'draft' || c.status === 'queued') && (
                      <Tooltip title="キャンセル">
                        <IconButton size="small" onClick={() => handleCancel(c.id)}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {lastPage > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination count={lastPage} page={page} onChange={(_, p) => setPage(p)} color="primary" />
        </Box>
      )}
    </Box>
  );
}
