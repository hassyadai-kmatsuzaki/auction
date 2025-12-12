import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Block as BlockIcon,
} from '@mui/icons-material';

// Mock データ
const user = {
  id: 1,
  name: '田中太郎',
  email: 'tanaka@example.com',
  phone: '090-1234-5678',
  postal_code: '123-4567',
  address: '東京都渋谷区...',
  status: 'pending',
  created_at: '2025-11-10T10:00:00Z',
};

const wonHistory = [
  { id: 1, auction: '2025年10月オークション', item: '幹之メダカ', amount: 6000, date: '2025-10-15' },
  { id: 2, auction: '2025年9月オークション', item: '楊貴妃メダカ', amount: 3500, date: '2025-09-12' },
];

export default function UserDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/users')}
          sx={{ mr: 2 }}
        >
          戻る
        </Button>
        <Typography variant="h4">ユーザー詳細</Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">基本情報</Typography>
              <Chip
                label={user.status === 'pending' ? '承認待ち' : '承認済み'}
                color={user.status === 'pending' ? 'warning' : 'success'}
              />
            </Box>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">
                  氏名
                </Typography>
              </Grid>
              <Grid item xs={8}>
                <Typography variant="body1">{user.name}</Typography>
              </Grid>

              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">
                  メール
                </Typography>
              </Grid>
              <Grid item xs={8}>
                <Typography variant="body1">{user.email}</Typography>
              </Grid>

              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">
                  電話番号
                </Typography>
              </Grid>
              <Grid item xs={8}>
                <Typography variant="body1">{user.phone}</Typography>
              </Grid>

              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">
                  郵便番号
                </Typography>
              </Grid>
              <Grid item xs={8}>
                <Typography variant="body1">{user.postal_code}</Typography>
              </Grid>

              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">
                  住所
                </Typography>
              </Grid>
              <Grid item xs={8}>
                <Typography variant="body1">{user.address}</Typography>
              </Grid>

              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">
                  登録日
                </Typography>
              </Grid>
              <Grid item xs={8}>
                <Typography variant="body1">
                  {new Date(user.created_at).toLocaleString('ja-JP')}
                </Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {user.status === 'pending' && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                >
                  承認する
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  startIcon={<BlockIcon />}
                >
                  却下する
                </Button>
              </Box>
            )}

            {user.status === 'approved' && (
              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<BlockIcon />}
              >
                アカウント停止
              </Button>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              落札履歴
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>オークション</TableCell>
                    <TableCell>商品</TableCell>
                    <TableCell align="right">金額</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {wonHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.auction}<br />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(item.date).toLocaleDateString('ja-JP')}
                        </Typography>
                      </TableCell>
                      <TableCell>{item.item}</TableCell>
                      <TableCell align="right">
                        ¥{item.amount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

