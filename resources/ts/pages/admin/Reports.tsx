import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent,
  Button, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Avatar, Tabs, Tab, FormControl, InputLabel, Select, MenuItem,
  CircularProgress, Alert,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Pets as PetsIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import axios from '../../lib/axios';

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

export default function Reports() {
  const [tabValue, setTabValue] = useState(0);
  const [reportType, setReportType] = useState<'weekly' | 'monthly'>('weekly');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const fetchReport = async (type: 'weekly' | 'monthly') => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`/api/admin/reports/${type}`);
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

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await axios.post('/api/admin/reports/generate', { type: reportType });
      await fetchReport(reportType);
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>期間</InputLabel>
            <Select value={reportType} label="期間" onChange={(e) => setReportType(e.target.value as any)}>
              <MenuItem value="weekly">週次</MenuItem>
              <MenuItem value="monthly">月次</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
            onClick={handleGenerate}
            disabled={generating}
          >
            再生成
          </Button>
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
              label={report.report_type === 'weekly' ? '週次レポート' : '月次レポート'}
              color="primary"
            />
            <Typography variant="body2">
              {report.period.start} 〜 {report.period.end}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              生成: {new Date(report.generated_at).toLocaleString('ja-JP')}
            </Typography>
          </Paper>

          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
            <Tab label="サマリー" icon={<AssessmentIcon />} iconPosition="start" />
            <Tab label="品種別分析" icon={<PetsIcon />} iconPosition="start" />
            <Tab label="ユーザー統計" icon={<PersonIcon />} iconPosition="start" />
          </Tabs>

          {/* サマリータブ */}
          {tabValue === 0 && (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={6} md={3}>
                  <Card>
                    <CardContent sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">総売上</Typography>
                      <Typography variant="h5" fontWeight={700}>
                        ¥{(ts?.total_sales ?? 0).toLocaleString()}
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
                        ¥{(ts?.average_price ?? 0).toLocaleString()}
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
                          ¥{(ts?.highest_price ?? 0).toLocaleString()}
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
                              <TableCell align="right">¥{Math.round(s.total_amount).toLocaleString()}</TableCell>
                              <TableCell align="right">¥{Math.round(s.avg_price).toLocaleString()}</TableCell>
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
