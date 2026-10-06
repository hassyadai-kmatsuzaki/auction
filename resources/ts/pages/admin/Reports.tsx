import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent,
  Button, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Avatar, Tabs, Tab, FormControl, InputLabel, Select, MenuItem,
  CircularProgress, Alert, TextField,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Pets as PetsIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
  AttachMoney as MoneyIcon,
  History as HistoryIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import axios from '../../lib/axios';
import { formatYen } from '../../lib/formatPrice';

interface ReportData {
  report_type: string;
  period: { start: string; end: string };
  generated_at: string;
  auction_summary: { total_auctions: number; completed_auctions: number };
  transaction_summary: {
    total_transactions: number;
    total_sales: number;
    average_price: number;
    highest_price: number;
    lowest_price: number;
  };
  species_ranking: Array<{
    species_name: string;
    count: number;
    total_amount: number;
    avg_price: number;
  }>;
  user_stats: {
    new_registrations: number;
    active_bidders: number;
    active_sellers: number;
  };
  payment_rate: number;
}

type ReportType = 'weekly' | 'monthly' | 'custom';

/** ローカル日付を YYYY-MM-DD に */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface SavedReport {
  filename: string;
  type: 'weekly' | 'monthly';
  start: string;
  end: string;
  generated_at: string | null;
}

/** レポートを CSV（Excel で開けるよう BOM 付き）にしてダウンロード */
const downloadReportCsv = (r: ReportData, filename: string) => {
  const t = r.transaction_summary;
  const rows: (string | number)[][] = [
    ['項目', '値'],
    ['種類', REPORT_TYPE_LABELS[r.report_type] ?? r.report_type],
    ['期間（開始）', r.period.start],
    ['期間（終了）', r.period.end],
    ['生成日時', r.generated_at],
    ['開催数', r.auction_summary.total_auctions],
    ['完了した開催数', r.auction_summary.completed_auctions],
    ['取引件数', t.total_transactions],
    ['総売上（税抜）', t.total_sales],
    ['平均落札単価', Math.round(Number(t.average_price) || 0)],
    ['最高落札単価', t.highest_price],
    ['最低落札単価', t.lowest_price],
    ['入金率（%）', r.payment_rate],
    ['新規登録', r.user_stats.new_registrations],
    ['アクティブ入札者', r.user_stats.active_bidders],
    ['アクティブ出品者', r.user_stats.active_sellers],
    [],
    ['品種名', '取引件数', '合計金額', '平均単価'],
    ...r.species_ranking.map((x) => [x.species_name, x.count, x.total_amount, Math.round(Number(x.avg_price) || 0)]),
  ];
  const csv = rows.map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // すぐに破棄するとブラウザによってはダウンロードが始まらないため少し待つ
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// 「保存済みレポート」タブ（自動生成分の一覧）。当面は非表示（true で表示）
const SHOW_SAVED_REPORTS = false;

const REPORT_TYPE_LABELS: Record<string, string> = {
  weekly: '週次レポート',
  monthly: '月次レポート',
  custom: '期間指定レポート',
};

export default function Reports() {
  const [tabValue, setTabValue] = useState(0);
  const [reportType, setReportType] = useState<ReportType>('weekly');
  // 期間指定（初期値: 今月1日〜今日）
  const [startDate, setStartDate] = useState(() => ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [endDate, setEndDate] = useState(() => ymd(new Date()));
  // 自動生成で保存されたレポート
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [viewingSaved, setViewingSaved] = useState<SavedReport | null>(null);

  const fetchSavedReports = () => {
    if (!SHOW_SAVED_REPORTS) return;
    axios.get('/api/admin/reports/history')
      .then((res) => setSavedReports(res.data.data.reports ?? []))
      .catch(() => setSavedReports([]));
  };

  useEffect(() => { fetchSavedReports(); }, []);

  const loadSavedReport = async (saved: SavedReport): Promise<ReportData | null> => {
    try {
      const res = await axios.get(`/api/admin/reports/history/${saved.filename}`);
      return res.data.data;
    } catch (err: any) {
      setError(err.response?.data?.message || '保存済みレポートの取得に失敗しました');
      return null;
    }
  };

  const showSavedReport = async (saved: SavedReport) => {
    const data = await loadSavedReport(saved);
    if (data) {
      setReport(data);
      setViewingSaved(saved);
      setTabValue(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const downloadSavedReport = async (saved: SavedReport) => {
    const data = await loadSavedReport(saved);
    if (data) downloadReportCsv(data, saved.filename.replace(/\.json$/, '.csv'));
  };
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const fetchReport = async (type: ReportType) => {
    setLoading(true);
    setError('');
    setViewingSaved(null);
    try {
      const res = type === 'custom'
        ? await axios.get('/api/admin/reports/custom', { params: { start_date: startDate, end_date: endDate } })
        : await axios.get(`/api/admin/reports/${type}`);
      setReport(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'レポートの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(reportType);
  }, [reportType]);

  const customRangeInvalid = !startDate || !endDate || startDate > endDate;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await axios.post('/api/admin/reports/generate', { type: reportType });
      await fetchReport(reportType);
      fetchSavedReports();
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  };

  const ts = report?.transaction_summary;
  const as_ = report?.auction_summary;
  const us = report?.user_stats;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>レポート</Typography>
          <Typography variant="body2" color="text.secondary">
            取引データの集計・分析レポート（週次/月次で自動生成）
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>期間</InputLabel>
            <Select value={reportType} label="期間" onChange={(e) => setReportType(e.target.value as ReportType)}>
              <MenuItem value="weekly">週次</MenuItem>
              <MenuItem value="monthly">月次</MenuItem>
              <MenuItem value="custom">期間指定</MenuItem>
            </Select>
          </FormControl>
          {reportType === 'custom' ? (
            <>
              <TextField
                type="date"
                size="small"
                label="開始日"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                type="date"
                size="small"
                label="終了日"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                error={!!startDate && !!endDate && startDate > endDate}
              />
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AssessmentIcon />}
                onClick={() => fetchReport('custom')}
                disabled={loading || customRangeInvalid}
              >
                表示
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
              onClick={handleGenerate}
              disabled={generating}
            >
              再生成
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
      ) : !report ? (
        <Alert severity="info">レポートデータがありません</Alert>
      ) : (
        <>
          {/* 期間表示 */}
          <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={REPORT_TYPE_LABELS[report.report_type] ?? 'レポート'}
              color="primary"
            />
            {viewingSaved && <Chip label="保存済み（自動生成）" color="secondary" variant="outlined" size="small" />}
            <Typography variant="body2">
              {report.period.start} 〜 {report.period.end}
            </Typography>
            {viewingSaved && (
              <Button size="small" onClick={() => fetchReport(reportType)}>最新の集計に戻る</Button>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              生成: {new Date(report.generated_at).toLocaleString('ja-JP')}
            </Typography>
          </Paper>

          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
            <Tab label="サマリー" icon={<AssessmentIcon />} iconPosition="start" />
            <Tab label="品種別分析" icon={<PetsIcon />} iconPosition="start" />
            <Tab label="ユーザー統計" icon={<PersonIcon />} iconPosition="start" />
            {SHOW_SAVED_REPORTS && <Tab label="保存済みレポート" icon={<HistoryIcon />} iconPosition="start" />}
          </Tabs>

          {/* 保存済みレポート（自動生成）タブ */}
          {SHOW_SAVED_REPORTS && tabValue === 3 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>保存済みレポート</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                毎週月曜 09:00（前週分）・毎月1日 09:00（前月分）に自動生成されたレポートです。
              </Typography>
              {savedReports.length === 0 ? (
                <Alert severity="info">保存済みのレポートはまだありません。</Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>種類</TableCell>
                        <TableCell>期間</TableCell>
                        <TableCell>生成日時</TableCell>
                        <TableCell align="right">操作</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {savedReports.map((r) => (
                        <TableRow key={r.filename}>
                          <TableCell>
                            <Chip label={REPORT_TYPE_LABELS[r.type]} size="small" color={r.type === 'monthly' ? 'primary' : 'default'} />
                          </TableCell>
                          <TableCell>{r.start} 〜 {r.end}</TableCell>
                          <TableCell>{r.generated_at ? new Date(r.generated_at).toLocaleString('ja-JP') : '-'}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Button size="small" onClick={() => showSavedReport(r)}>表示</Button>
                            <Button size="small" startIcon={<DownloadIcon />} onClick={() => downloadSavedReport(r)}>CSV</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          )}

          {/* サマリータブ */}
          {tabValue === 0 && (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={6} md={3}>
                  <Card>
                    <CardContent sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">総売上</Typography>
                      <Typography variant="h5" fontWeight={700}>
                        ¥{formatYen(ts?.total_sales ?? 0)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card>
                    <CardContent sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">取引件数</Typography>
                      <Typography variant="h5" fontWeight={700}>
                        {ts?.total_transactions ?? 0}件
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card>
                    <CardContent sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">平均落札価格</Typography>
                      <Typography variant="h5" fontWeight={700}>
                        ¥{formatYen(ts?.average_price ?? 0)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card>
                    <CardContent sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">入金率</Typography>
                      <Typography variant="h5" fontWeight={700} color={report.payment_rate >= 80 ? 'success.main' : 'warning.main'}>
                        {report.payment_rate}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>オークション統計</Typography>
                    <Box sx={{ display: 'flex', gap: 4 }}>
                      <Box>
                        <Typography variant="h4" fontWeight={700}>{as_?.total_auctions ?? 0}</Typography>
                        <Typography variant="body2" color="text.secondary">開催数</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h4" fontWeight={700}>{as_?.completed_auctions ?? 0}</Typography>
                        <Typography variant="body2" color="text.secondary">完了数</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h4" fontWeight={700}>
                          ¥{formatYen(ts?.highest_price ?? 0)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">最高落札価格</Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>ユーザー活動</Typography>
                    <Box sx={{ display: 'flex', gap: 4 }}>
                      <Box>
                        <Typography variant="h4" fontWeight={700}>{us?.new_registrations ?? 0}</Typography>
                        <Typography variant="body2" color="text.secondary">新規登録</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h4" fontWeight={700}>{us?.active_bidders ?? 0}</Typography>
                        <Typography variant="body2" color="text.secondary">入札者数</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h4" fontWeight={700}>{us?.active_sellers ?? 0}</Typography>
                        <Typography variant="body2" color="text.secondary">出品者数</Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* 品種別分析タブ */}
          {tabValue === 1 && (
            <Box>
              {(report.species_ranking?.length ?? 0) === 0 ? (
                <Alert severity="info">この期間の品種別データはありません</Alert>
              ) : (
                <>
                  <Paper sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>品種別取引件数</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={report.species_ranking}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="species_name" fontSize={11} />
                        <YAxis />
                        <RechartsTooltip />
                        <Bar dataKey="count" name="取引件数" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>

                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>品種別詳細</Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>品種名</TableCell>
                            <TableCell align="right">取引件数</TableCell>
                            <TableCell align="right">合計金額</TableCell>
                            <TableCell align="right">平均単価</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {report.species_ranking.map((s, i) => (
                            <TableRow key={i} hover>
                              <TableCell>{s.species_name}</TableCell>
                              <TableCell align="right">{s.count}件</TableCell>
                              <TableCell align="right">¥{formatYen(s.total_amount)}</TableCell>
                              <TableCell align="right">¥{formatYen(s.avg_price)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </>
              )}
            </Box>
          )}

          {/* ユーザー統計タブ */}
          {tabValue === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56, mx: 'auto', mb: 2 }}>
                      <PersonIcon />
                    </Avatar>
                    <Typography variant="h3" fontWeight={700}>{us?.new_registrations ?? 0}</Typography>
                    <Typography variant="body2" color="text.secondary">新規登録ユーザー</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Avatar sx={{ bgcolor: 'success.main', width: 56, height: 56, mx: 'auto', mb: 2 }}>
                      <TrendingUpIcon />
                    </Avatar>
                    <Typography variant="h3" fontWeight={700}>{us?.active_bidders ?? 0}</Typography>
                    <Typography variant="body2" color="text.secondary">アクティブ入札者</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Avatar sx={{ bgcolor: 'warning.main', width: 56, height: 56, mx: 'auto', mb: 2 }}>
                      <MoneyIcon />
                    </Avatar>
                    <Typography variant="h3" fontWeight={700}>{us?.active_sellers ?? 0}</Typography>
                    <Typography variant="body2" color="text.secondary">アクティブ出品者</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>自動生成スケジュール</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                        <Typography variant="subtitle2">週次レポート</Typography>
                        <Typography variant="body2" color="text.secondary">
                          毎週月曜日 09:00 に自動生成
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                        <Typography variant="subtitle2">月次レポート</Typography>
                        <Typography variant="body2" color="text.secondary">
                          毎月1日 09:00 に自動生成
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          )}
        </>
      )}
    </Box>
  );
}
