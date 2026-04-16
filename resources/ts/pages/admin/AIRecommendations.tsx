import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent,
  Button, CircularProgress, Alert, Autocomplete, TextField, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Avatar,
} from '@mui/material';
import {
  Recommend as RecommendIcon,
  Person as PersonIcon,
  PlayArrow as RunIcon,
  Favorite as FavoriteIcon,
} from '@mui/icons-material';
import { aiRecommendApi, aiDashboardApi } from '../../api/admin/aiApi';
import axios from '../../lib/axios';

interface UserOption { id: number; name: string; email: string; }
interface Recommendation {
  id: number;
  item_id: number;
  score: number;
  reason: string | null;
  source: string;
  item?: {
    id: number;
    species_name: string;
    start_price: number;
    thumbnail_path: string | null;
  };
}

export default function AIRecommendations() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [generating, setGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<{ recommendations_generated: number } | null>(null);

  useEffect(() => {
    // 参加者ロールのユーザー一覧を取得
    axios.get('/api/admin/users', { params: { per_page: 200, role: 'participant' } }).then((res) => {
      // Laravel paginator: res.data.data は { data: [...], current_page, ... }
      const paginated = res.data.data;
      const userList = Array.isArray(paginated) ? paginated : (paginated?.data ?? []);
      setUsers(userList);
    }).catch(() => {});

    // 統計取得
    aiDashboardApi.getSummary().then(setStats).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!selectedUser) return;
    setGenerating(true);
    setError('');
    setRecommendations([]);
    try {
      const data = await aiRecommendApi.generate(selectedUser.id);
      setRecommendations(data.recommendations ?? []);
      if ((data.recommendations ?? []).length === 0) {
        setError('このユーザーの行動データが不足しているため、レコメンドを生成できませんでした。お気に入りや落札履歴が蓄積されると精度が向上します。');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'レコメンド生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  const sourceLabel = (s: string) =>
    s === 'collaborative' ? '協調フィルタリング' :
    s === 'content_based' ? 'コンテンツベース' :
    s === 'hybrid' ? 'ハイブリッド' :
    s === 'trending' ? 'トレンド' : s;

  const sourceColor = (s: string): 'primary' | 'secondary' | 'success' | 'warning' =>
    s === 'collaborative' ? 'primary' :
    s === 'content_based' ? 'secondary' :
    s === 'hybrid' ? 'success' : 'warning';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <RecommendIcon sx={{ fontSize: 32, color: '#8B5CF6' }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>AIレコメンド</Typography>
          <Typography variant="body2" color="text.secondary">
            ユーザーの行動履歴からおすすめ商品を生成します（協調フィルタリング + コンテンツベース + トレンド）
          </Typography>
        </Box>
      </Box>

      {/* 統計 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" fontWeight={700} color="primary.main">
                {stats?.recommendations_generated ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">生成済みレコメンド数</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" fontWeight={700}>{users.length}</Typography>
              <Typography variant="caption" color="text.secondary">対象ユーザー数</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ユーザー選択 + 生成 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>レコメンド生成</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={7}>
            <Autocomplete
              options={users}
              getOptionLabel={(o) => `${o.name}（${o.email}）`}
              value={selectedUser}
              onChange={(_, v) => { setSelectedUser(v); setRecommendations([]); setError(''); }}
              renderInput={(params) => <TextField {...params} label="対象ユーザー" size="small" placeholder="ユーザーを検索..." />}
              renderOption={(props, option) => (
                <li {...props}>
                  <Avatar sx={{ width: 28, height: 28, mr: 1, fontSize: '0.75rem' }}>{option.name[0]}</Avatar>
                  <Box>
                    <Typography variant="body2">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{option.email}</Typography>
                  </Box>
                </li>
              )}
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <Button
              variant="contained"
              fullWidth
              color="secondary"
              startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <RunIcon />}
              onClick={handleGenerate}
              disabled={!selectedUser || generating}
            >
              {generating ? '生成中...' : 'レコメンド生成'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="info" sx={{ mb: 3 }}>{error}</Alert>}

      {/* レコメンド結果 */}
      {recommendations.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            {selectedUser?.name} さんへのおすすめ（{recommendations.length}件）
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>商品</TableCell>
                  <TableCell>スコア</TableCell>
                  <TableCell>推薦理由</TableCell>
                  <TableCell>アルゴリズム</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recommendations.map((rec, i) => (
                  <TableRow key={i} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {rec.item?.thumbnail_path ? (
                          <Avatar variant="rounded" src={rec.item.thumbnail_path} sx={{ width: 40, height: 40 }} />
                        ) : (
                          <Avatar variant="rounded" sx={{ width: 40, height: 40, bgcolor: 'grey.200' }}>
                            <FavoriteIcon sx={{ color: 'grey.400', fontSize: 20 }} />
                          </Avatar>
                        )}
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {rec.item?.species_name ?? `商品ID: ${rec.item_id}`}
                          </Typography>
                          {rec.item?.start_price && (
                            <Typography variant="caption" color="text.secondary">
                              ¥{rec.item.start_price.toLocaleString()}〜
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                          width: 60, height: 6, bgcolor: 'grey.200', borderRadius: 3, overflow: 'hidden',
                        }}>
                          <Box sx={{
                            width: `${rec.score * 100}%`, height: '100%',
                            bgcolor: rec.score > 0.7 ? 'success.main' : rec.score > 0.4 ? 'warning.main' : 'error.main',
                          }} />
                        </Box>
                        <Typography variant="body2">{(rec.score * 100).toFixed(0)}%</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
                        {rec.reason ?? '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={sourceLabel(rec.source)}
                        color={sourceColor(rec.source)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {!generating && recommendations.length === 0 && !error && (
        <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          <PersonIcon sx={{ fontSize: 64, mb: 1, opacity: 0.3 }} />
          <Typography>ユーザーを選択して「レコメンド生成」をクリックしてください</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            お気に入り・落札履歴に基づいて、協調フィルタリング・コンテンツベース・トレンドの3方式でおすすめを算出します
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
