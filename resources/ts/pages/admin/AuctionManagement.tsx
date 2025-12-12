import React from 'react';
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
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Pets as PetsIcon,
  PlayArrow as PlayArrowIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';

const auctions = [
  {
    id: 1,
    title: '2025年11月オークション',
    event_date: '2025-11-12',
    status: 'finished',
    total_items: 120,
    total_sold: 110,
    total_sales: 1850000,
    can_edit: false,
  },
  {
    id: 2,
    title: '2025年12月オークション',
    event_date: '2025-12-10',
    status: 'preparing',
    total_items: 85,
    can_edit: true,
  },
];

export default function AuctionManagement() {
  const navigate = useNavigate();

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'preparing': return '準備中';
      case 'live': return '開催中';
      case 'finished': return '終了';
      case 'cancelled': return 'キャンセル';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'preparing': return 'warning';
      case 'live': return 'success';
      case 'finished': return 'default';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">オークション管理</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/auctions/create')}
        >
          新規作成
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>タイトル</TableCell>
              <TableCell>開催日</TableCell>
              <TableCell align="center">ステータス</TableCell>
              <TableCell align="right">生体数</TableCell>
              <TableCell align="right">落札数</TableCell>
              <TableCell align="right">売上</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {auctions.map((auction) => (
              <TableRow key={auction.id} hover>
                <TableCell>{auction.title}</TableCell>
                <TableCell>{new Date(auction.event_date).toLocaleDateString('ja-JP')}</TableCell>
                <TableCell align="center">
                  <Chip
                    label={getStatusLabel(auction.status)}
                    color={getStatusColor(auction.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">{auction.total_items}</TableCell>
                <TableCell align="right">{auction.total_sold || '-'}</TableCell>
                <TableCell align="right">
                  {auction.total_sales ? `¥${auction.total_sales.toLocaleString()}` : '-'}
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                    {auction.can_edit && (
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => navigate(`/admin/auctions/${auction.id}/edit`)}
                      >
                        <EditIcon />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => navigate(`/admin/auctions/${auction.id}/items`)}
                    >
                      <PetsIcon />
                    </IconButton>
                    {auction.status === 'live' && (
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => navigate(`/admin/auctions/${auction.id}/live`)}
                      >
                        <PlayArrowIcon />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      color="default"
                      onClick={() => navigate(`/admin/auctions/${auction.id}/won-items`)}
                    >
                      <ReceiptIcon />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

