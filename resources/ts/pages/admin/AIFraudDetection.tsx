import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent,
  Button, Chip, CircularProgress, Alert, Autocomplete, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import {
  Shield as ShieldIcon,
  CheckCircle as CheckIcon,
  Refresh as RefreshIcon,
  PlayArrow as RunIcon,
} from '@mui/icons-material';
import { aiFraudApi, adminDataApi } from '../../api/admin/aiApi';

interface FraudAlert {
  id: number;
  alert_type: string;
  severity: string;
  status: string;
  description: string;
  evidence: Record<string, any> | null;
  auction_id: number | null;
  user_id: number | null;
  user?: { id: number; name: string; email: string } | null;
  auction?: { id: number; title: string } | null;
  resolution_notes: string | null;
  created_at: string;
}

interface AuctionOption { id: number; title: string; event_date: string; }

/** 根拠データの項目名（画面表示用の日本語） */
const EVIDENCE_LABELS: Record<string, { label: string; format?: (v: any) => string }> = {
  user_id: { label: '対象ユーザーID' },
  seller_profile_id: { label: '出品者ID' },
  runner_up_count: { label: '最後まで競り合って落札しなかった商品数', format: (v) => `${v}件` },
  runner_up_item_ids: { label: '該当の商品ID', format: (v) => (Array.isArray(v) ? v.join('、') : String(v)) },
  seller_share: { label: 'その出品者の商品が占める割合', format: (v) => `${Math.round(Number(v) * 100)}%` },
  won_count: { label: 'その出品者からの落札数', format: (v) => `${v}件` },
  leave_count: { label: '入札から離脱した回数', format: (v) => `${v}回` },
  rapid_bid_count: { label: '直前の入札から1秒以内の入札回数', format: (v) => `${v}回` },
  winning_price: { label: '落札価格', format: (v) => `¥${Number(v).toLocaleString()}` },
  average_price: { label: '同品種の平均落札価格', format: (v) => `¥${Number(v).toLocaleString()}` },
  ratio: { label: '平均に対する倍率', format: (v) => `${v}倍` },
  species: { label: '品種' },
};

/** 根拠データを「項目名: 値」の文に直す（未知の項目は項目名をそのまま出す） */
const evidenceLines = (evidence: Record<string, any> | null): string[] =>
  Object.entries(evidence ?? {}).map(([key, value]) => {
    const def = EVIDENCE_LABELS[key];
    const text = def?.format ? def.format(value) : (typeof value === 'object' ? JSON.stringify(value) : String(value));
    return `${def?.label ?? key}: ${text}`;
  });

export default function AIFraudDetection() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  // 検知実行用
  const [auctions, setAuctions] = useState<AuctionOption[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<AuctionOption | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState('');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterSeverity !== 'all') params.severity = filterSeverity;
      if (filterStatus !== 'all') params.status = filterStatus;
      const data = await aiFraudApi.getAlerts(params);
      setAlerts(data?.data ?? []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [filterSeverity, filterStatus]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);
  useEffect(() => { adminDataApi.getAuctions().then(setAuctions).catch(() => {}); }, []);

  const handleRunDetection = async () => {
    if (!selectedAuction) return;
    setRunning(true);
    setRunResult('');
    try {
      const data = await aiFraudApi.runDetection(selectedAuction.id);
      setRunResult(`検知完了: ${data.new_alerts}件の新規アラートを検出しました`);
      fetchAlerts();
    } catch (err: any) {
      setRunResult('検知実行に失敗しました: ' + (err.response?.data?.message || err.message));
    } finally {
      setRunning(false);
    }
  };

  const handleResolve = async (status: 'resolved' | 'false_positive') => {
    if (!selectedAlert) return;
    setResolving(true);
    try {
      await aiFraudApi.resolveAlert(selectedAlert.id, { status, notes: resolveNotes });
      setSelectedAlert(null);
      setResolveNotes('');
      fetchAlerts();
    } catch {
      // ignore
    } finally {
      setResolving(false);
    }
  };

  const severityLabel = (s: string) => s === 'critical' ? '緊急' : s === 'high' ? '高' : s === 'medium' ? '中' : '低';
  const severityColor = (s: string): 'error' | 'warning' | 'info' | 'default' =>
    s === 'critical' || s === 'high' ? 'error' : s === 'medium' ? 'warning' : 'info';
  const statusLabel = (s: string) =>
    s === 'open' ? '未対応' : s === 'investigating' ? '調査中' : s === 'resolved' ? '解決済' : '誤検知';
  const typeLabel = (t: string) =>
    t === 'shill_bidding' ? 'サクラ入札' : t === 'bid_pattern' ? '入札パターン異常' :
    t === 'price_manipulation' ? '価格操作' : t === 'account_abuse' ? 'アカウント不正' : t;

  const stats = {
    total: alerts.length,
    open: alerts.filter(a => a.status === 'open').length,
    high: alerts.filter(a => ['critical', 'high'].includes(a.severity)).length,
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <ShieldIcon sx={{ fontSize: 32, color: '#EF4444' }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>AI不正検知</Typography>
          <Typography variant="body2" color="text.secondary">
            入札パターンを分析し、サクラ入札・価格操作などの不正行為を自動検出します
          </Typography>
        </Box>
      </Box>

      {/* 統計カード */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" fontWeight={700}>{stats.total}</Typography>
              <Typography variant="caption" color="text.secondary">アラート総数</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card sx={{ bgcolor: stats.open > 0 ? 'error.50' : 'success.50' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" fontWeight={700} color={stats.open > 0 ? 'error.main' : 'success.main'}>
                {stats.open}
              </Typography>
              <Typography variant="caption" color="text.secondary">未対応</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" fontWeight={700} color="warning.main">{stats.high}</Typography>
              <Typography variant="caption" color="text.secondary">高リスク</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 検知実行 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Autocomplete
              options={auctions}
              getOptionLabel={(o) => `${o.title}（${String(o.event_date ?? '').slice(0, 10)}）`}
              value={selectedAuction}
              onChange={(_, v) => setSelectedAuction(v)}
              renderInput={(params) => <TextField {...params} label="検知対象オークション" size="small" />}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <Button
              variant="contained"
              color="error"
              fullWidth
              startIcon={running ? <CircularProgress size={18} color="inherit" /> : <RunIcon />}
              onClick={handleRunDetection}
              disabled={!selectedAuction || running}
            >
              検知実行
            </Button>
          </Grid>
          <Grid item xs={6} md={3}>
            <Button variant="outlined" fullWidth startIcon={<RefreshIcon />} onClick={fetchAlerts}>
              更新
            </Button>
          </Grid>
        </Grid>
        {runResult && <Alert severity="info" sx={{ mt: 2 }}>{runResult}</Alert>}
      </Paper>

      {/* フィルタ */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" fontWeight={600}>重要度:</Typography>
        <ToggleButtonGroup size="small" value={filterSeverity} exclusive onChange={(_, v) => v && setFilterSeverity(v)}>
          <ToggleButton value="all">全て</ToggleButton>
          <ToggleButton value="critical">緊急</ToggleButton>
          <ToggleButton value="high">高</ToggleButton>
          <ToggleButton value="medium">中</ToggleButton>
          <ToggleButton value="low">低</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="body2" fontWeight={600} sx={{ ml: 2 }}>ステータス:</Typography>
        <ToggleButtonGroup size="small" value={filterStatus} exclusive onChange={(_, v) => v && setFilterStatus(v)}>
          <ToggleButton value="all">全て</ToggleButton>
          <ToggleButton value="open">未対応</ToggleButton>
          <ToggleButton value="investigating">調査中</ToggleButton>
          <ToggleButton value="resolved">解決済</ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {/* アラート一覧 */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
      ) : alerts.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 1 }} />
          <Typography variant="h6">アラートはありません</Typography>
          <Typography variant="body2" color="text.secondary">
            オークションを選択して「検知実行」をクリックすると、入札パターンの分析を開始します
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>重要度</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>種類</TableCell>
                <TableCell>説明</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>対象ユーザー</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>ステータス</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>検知日時</TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>
                    <Chip label={severityLabel(alert.severity)} color={severityColor(alert.severity)} size="small" />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{typeLabel(alert.alert_type)}</TableCell>
                  <TableCell sx={{ minWidth: 320 }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {alert.description}
                    </Typography>
                    {alert.auction?.title && (
                      <Typography variant="caption" color="text.secondary" component="div">
                        対象オークション: {alert.auction.title}
                      </Typography>
                    )}
                    {evidenceLines(alert.evidence).map((line) => (
                      <Typography key={line} variant="caption" color="text.secondary" component="div" sx={{ wordBreak: 'break-word' }}>
                        {line}
                      </Typography>
                    ))}
                  </TableCell>
                  <TableCell>{alert.user?.name ?? `ID:${alert.user_id}`}</TableCell>
                  <TableCell>
                    <Chip label={statusLabel(alert.status)} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{new Date(alert.created_at).toLocaleString('ja-JP')}</Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Button size="small" onClick={() => setSelectedAlert(alert)}>
                      {alert.status === 'open' ? '対応' : '詳細'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 対応ダイアログ */}
      <Dialog open={!!selectedAlert} onClose={() => setSelectedAlert(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedAlert?.status === 'open' ? 'アラート対応' : 'アラート詳細'}</DialogTitle>
        <DialogContent>
          {selectedAlert && (
            <Box>
              <Chip label={severityLabel(selectedAlert.severity)} color={severityColor(selectedAlert.severity)} sx={{ mb: 2 }} />
              <Typography variant="subtitle1" fontWeight={600}>{typeLabel(selectedAlert.alert_type)}</Typography>
              <Typography variant="body2" sx={{ my: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {selectedAlert.description}
              </Typography>
              <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'grey.50' }}>
                <Typography variant="caption" fontWeight={600} component="div" sx={{ mb: 0.5 }}>検知の根拠</Typography>
                <Typography variant="body2" component="div">
                  対象ユーザー: {selectedAlert.user?.name ?? (selectedAlert.user_id ? `ID:${selectedAlert.user_id}` : '-')}
                </Typography>
                {selectedAlert.auction?.title && (
                  <Typography variant="body2" component="div">対象オークション: {selectedAlert.auction.title}</Typography>
                )}
                <Typography variant="body2" component="div">
                  検知日時: {new Date(selectedAlert.created_at).toLocaleString('ja-JP')}
                </Typography>
                {evidenceLines(selectedAlert.evidence).map((line) => (
                  <Typography key={line} variant="body2" component="div" sx={{ wordBreak: 'break-word' }}>{line}</Typography>
                ))}
              </Paper>
              {selectedAlert.status === 'open' ? (
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="対応メモ"
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                />
              ) : (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {`状態: ${statusLabel(selectedAlert.status)}${selectedAlert.resolution_notes ? `\n対応メモ: ${selectedAlert.resolution_notes}` : ''}`}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedAlert(null)}>{selectedAlert?.status === 'open' ? 'キャンセル' : '閉じる'}</Button>
          {selectedAlert?.status === 'open' && (
            <>
              <Button
                color="warning"
                onClick={() => handleResolve('false_positive')}
                disabled={resolving}
              >
                誤検知として処理
              </Button>
              <Button
                variant="contained"
                onClick={() => handleResolve('resolved')}
                disabled={resolving}
              >
                解決済みにする
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
