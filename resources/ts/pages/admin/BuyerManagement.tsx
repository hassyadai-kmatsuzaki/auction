import React, { useState } from 'react';
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
  Button,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Avatar,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Person as PersonIcon,
  Add as AddIcon,
  FileDownload as ExportIcon,
  ShoppingCart as CartIcon,
} from '@mui/icons-material';

// Mock データ
const buyers = [
  {
    id: 1,
    name: '山田一郎',
    nickname: 'やまちゃん',
    email: 'yamada@example.com',
    phone: '090-1111-2222',
    address: '東京都渋谷区xxx',
    status: 'approved',
    total_purchases: 15,
    total_amount: 380000,
    created_at: '2025-09-10T10:00:00Z',
  },
  {
    id: 2,
    name: '伊藤美穂',
    nickname: 'メダカ好き美穂',
    email: 'ito@example.com',
    phone: '090-2222-3333',
    address: '大阪府大阪市xxx',
    status: 'pending',
    total_purchases: 0,
    total_amount: 0,
    created_at: '2025-11-12T14:00:00Z',
  },
  {
    id: 3,
    name: '渡辺健太',
    nickname: 'けんた',
    email: 'watanabe@example.com',
    phone: '090-3333-4444',
    address: '愛知県名古屋市xxx',
    status: 'approved',
    total_purchases: 28,
    total_amount: 720000,
    created_at: '2025-05-20T11:00:00Z',
  },
  {
    id: 4,
    name: '中村さくら',
    nickname: 'さくら',
    email: 'nakamura@example.com',
    phone: '090-4444-5555',
    address: '福岡県福岡市xxx',
    status: 'approved',
    total_purchases: 8,
    total_amount: 150000,
    created_at: '2025-07-15T09:00:00Z',
  },
  {
    id: 5,
    name: '小林誠',
    nickname: 'まこと',
    email: 'kobayashi@example.com',
    phone: '090-5555-6666',
    address: '北海道札幌市xxx',
    status: 'suspended',
    total_purchases: 5,
    total_amount: 85000,
    created_at: '2025-08-01T16:00:00Z',
  },
  {
    id: 6,
    name: '加藤優子',
    nickname: 'ゆうこ',
    email: 'kato@example.com',
    phone: '090-6666-7777',
    address: '京都府京都市xxx',
    status: 'pending',
    total_purchases: 0,
    total_amount: 0,
    created_at: '2025-11-11T10:30:00Z',
  },
];

// KPIカードコンポーネント
function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: `${color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: color,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function BuyerManagement() {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedBuyer, setSelectedBuyer] = useState<typeof buyers[0] | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);

  const filteredBuyers = buyers.filter((buyer) => {
    const matchesSearch =
      buyer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      buyer.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      buyer.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (tabValue === 0) return matchesSearch;
    if (tabValue === 1) return matchesSearch && buyer.status === 'pending';
    if (tabValue === 2) return matchesSearch && buyer.status === 'approved';
    if (tabValue === 3) return matchesSearch && buyer.status === 'suspended';
    return matchesSearch;
  });

  const pendingCount = buyers.filter((b) => b.status === 'pending').length;
  const approvedCount = buyers.filter((b) => b.status === 'approved').length;
  const suspendedCount = buyers.filter((b) => b.status === 'suspended').length;

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, buyer: typeof buyers[0]) => {
    setAnchorEl(event.currentTarget);
    setSelectedBuyer(buyer);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleApprove = () => {
    setApproveDialogOpen(true);
    handleMenuClose();
  };

  const getStatusChip = (status: string) => {
    const config = {
      pending: { label: '承認待ち', color: '#F59E0B', bgcolor: '#FEF3C7' },
      approved: { label: '有効', color: '#059669', bgcolor: '#ECFDF5' },
      suspended: { label: '停止中', color: '#DC2626', bgcolor: '#FEF2F2' },
    }[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };

    return (
      <Chip
        size="small"
        label={config.label}
        sx={{
          bgcolor: config.bgcolor,
          color: config.color,
          fontWeight: 600,
          fontSize: '0.75rem',
        }}
      />
    );
  };

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            買受者登録一覧
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            買受者（入札参加者）の登録情報を管理します
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="outlined" startIcon={<ExportIcon />}>
            エクスポート
          </Button>
          <Button variant="contained" startIcon={<AddIcon />}>
            新規登録
          </Button>
        </Box>
      </Box>

      {/* KPIカード */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3, mb: 4 }}>
        <StatCard title="総買受者数" value={buyers.length} icon={<PersonIcon />} color="#3B82F6" />
        <StatCard title="承認待ち" value={pendingCount} icon={<CheckCircleIcon />} color="#F59E0B" />
        <StatCard title="有効" value={approvedCount} icon={<CheckCircleIcon />} color="#059669" />
        <StatCard title="停止中" value={suspendedCount} icon={<CancelIcon />} color="#DC2626" />
      </Box>

      {/* フィルター・検索 */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label={`すべて (${buyers.length})`} />
            <Tab label={`承認待ち (${pendingCount})`} />
            <Tab label={`有効 (${approvedCount})`} />
            <Tab label={`停止中 (${suspendedCount})`} />
          </Tabs>
        </Box>
        <Box sx={{ p: 2 }}>
          <TextField
            size="small"
            placeholder="氏名、ニックネーム、メールアドレスで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ width: 350 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Card>

      {/* テーブル */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>氏名</TableCell>
                <TableCell>ニックネーム</TableCell>
                <TableCell>連絡先</TableCell>
                <TableCell align="right">落札数</TableCell>
                <TableCell align="right">総購入額</TableCell>
                <TableCell>登録日</TableCell>
                <TableCell align="center">ステータス</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBuyers.map((buyer) => (
                <TableRow key={buyer.id} hover sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          bgcolor: '#EFF6FF',
                          color: '#3B82F6',
                          fontSize: '0.875rem',
                        }}
                      >
                        {buyer.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {buyer.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          ID: {buyer.id}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{buyer.nickname}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{buyer.email}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {buyer.phone}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                      <CartIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {buyer.total_purchases}件
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      ¥{buyer.total_amount.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(buyer.created_at).toLocaleDateString('ja-JP')}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">{getStatusChip(buyer.status)}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/admin/buyers/${buyer.id}`)}
                    >
                      <VisibilityIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/admin/buyers/${buyer.id}/edit`)}
                    >
                      <EditIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <IconButton size="small" onClick={(e) => handleMenuOpen(e, buyer)}>
                      <MoreVertIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* アクションメニュー */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        {selectedBuyer?.status === 'pending' && (
          <MenuItem onClick={handleApprove}>
            <CheckCircleIcon sx={{ mr: 1, fontSize: 18, color: 'success.main' }} />
            承認する
          </MenuItem>
        )}
        {selectedBuyer?.status === 'approved' && (
          <MenuItem onClick={handleMenuClose}>
            <CancelIcon sx={{ mr: 1, fontSize: 18, color: 'error.main' }} />
            停止する
          </MenuItem>
        )}
        {selectedBuyer?.status === 'suspended' && (
          <MenuItem onClick={handleMenuClose}>
            <CheckCircleIcon sx={{ mr: 1, fontSize: 18, color: 'success.main' }} />
            再有効化
          </MenuItem>
        )}
      </Menu>

      {/* 承認ダイアログ */}
      <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)}>
        <DialogTitle>買受者を承認</DialogTitle>
        <DialogContent>
          <Typography>
            「{selectedBuyer?.name}」を承認しますか？承認後、オークションに参加できるようになります。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)}>キャンセル</Button>
          <Button variant="contained" color="success" onClick={() => setApproveDialogOpen(false)}>
            承認する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

