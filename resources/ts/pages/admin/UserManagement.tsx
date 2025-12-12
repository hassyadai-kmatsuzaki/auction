import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Button,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';

const users = [
  { id: 1, name: '田中太郎', email: 'tanaka@example.com', status: 'pending', created_at: '2025-11-10T10:00:00Z' },
  { id: 2, name: '佐藤花子', email: 'sato@example.com', status: 'approved', created_at: '2025-11-05T15:00:00Z' },
  { id: 3, name: '鈴木一郎', email: 'suzuki@example.com', status: 'approved', created_at: '2025-10-28T11:00:00Z' },
  { id: 4, name: '高橋美咲', email: 'takahashi@example.com', status: 'pending', created_at: '2025-11-11T09:00:00Z' },
];

export default function UserManagement() {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = React.useState(0);

  const filteredUsers = users.filter((user) => {
    if (tabValue === 0) return user.status === 'pending';
    if (tabValue === 1) return user.status === 'approved';
    if (tabValue === 2) return user.status === 'suspended';
    return true;
  });

  const pendingCount = users.filter((u) => u.status === 'pending').length;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        ユーザー管理
      </Typography>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label={`承認待ち (${pendingCount})`} />
          <Tab label="有効ユーザー" />
          <Tab label="停止ユーザー" />
        </Tabs>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>氏名</TableCell>
              <TableCell>メールアドレス</TableCell>
              <TableCell align="center">ステータス</TableCell>
              <TableCell>登録日</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell align="center">
                  <Chip
                    label={
                      user.status === 'pending'
                        ? '承認待ち'
                        : user.status === 'approved'
                        ? '承認済み'
                        : '停止中'
                    }
                    color={
                      user.status === 'pending'
                        ? 'warning'
                        : user.status === 'approved'
                        ? 'success'
                        : 'error'
                    }
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleString('ja-JP')}
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => navigate(`/admin/users/${user.id}`)}
                  >
                    <VisibilityIcon />
                  </IconButton>
                  {user.status === 'pending' && (
                    <>
                      <IconButton size="small" color="success">
                        <CheckCircleIcon />
                      </IconButton>
                      <IconButton size="small" color="error">
                        <CancelIcon />
                      </IconButton>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

