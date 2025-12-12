import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIndicatorIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';

const items = [
  { id: 1, item_number: 1, species_name: '幹之メダカ', quantity: 5, start_price: 500, is_premium: true, status: 'registered', lane_number: 1 },
  { id: 2, item_number: 2, species_name: '楊貴妃メダカ', quantity: 3, start_price: 300, is_premium: false, status: 'registered', lane_number: 2 },
  { id: 3, item_number: 3, species_name: 'オロチメダカ', quantity: 4, start_price: 800, is_premium: true, status: 'registered', lane_number: 3 },
];

export default function ItemManagement() {
  const navigate = useNavigate();
  const { auctionId } = useParams();

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/auctions')}
          sx={{ mr: 2 }}
        >
          戻る
        </Button>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          生体管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate(`/admin/auctions/${auctionId}/items/create`)}
        >
          新規登録
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined">レーン自動割り当て</Button>
          <Button variant="outlined">CSVインポート</Button>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={50}></TableCell>
              <TableCell>No.</TableCell>
              <TableCell>品種名</TableCell>
              <TableCell align="center">匹数</TableCell>
              <TableCell align="right">開始価格</TableCell>
              <TableCell align="center">プレミアム</TableCell>
              <TableCell align="center">レーン</TableCell>
              <TableCell align="center">ステータス</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  <DragIndicatorIcon sx={{ cursor: 'grab', color: 'text.secondary' }} />
                </TableCell>
                <TableCell>{item.item_number}</TableCell>
                <TableCell>{item.species_name}</TableCell>
                <TableCell align="center">{item.quantity}</TableCell>
                <TableCell align="right">¥{item.start_price.toLocaleString()}</TableCell>
                <TableCell align="center">
                  {item.is_premium && <Chip label="プレミアム" color="warning" size="small" />}
                </TableCell>
                <TableCell align="center">
                  <Chip label={`レーン${item.lane_number}`} size="small" />
                </TableCell>
                <TableCell align="center">
                  <Chip label="登録済み" color="primary" size="small" />
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => navigate(`/admin/auctions/${auctionId}/items/${item.id}/edit`)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

